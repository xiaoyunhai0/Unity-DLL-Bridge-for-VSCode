import * as fs from 'fs/promises';
import * as path from 'path';
import { ResolvedBridgeConfig } from '../config/types';
import { sha256File } from '../utils/hash';
import { ensureDirectory, fileExists, formatTimestampForFileName, getRelativePath, resolveConfigPath } from '../utils/pathUtils';
import { writeSyncLog } from './syncLog';

export interface SyncOnlyResult {
  syncedProjects: number;
  warnings: string[];
  logPath: string;
}

interface SyncedFile {
  sourcePath: string;
  targetPath: string;
  name: string;
  sha256: string;
  size: number;
}

export async function syncOnly(resolvedConfig: ResolvedBridgeConfig, validationWarnings: string[], leadingLines: string[] = []): Promise<SyncOnlyResult> {
  const warnings = [...validationWarnings];
  const lines: string[] = [...leadingLines];
  const timestamp = new Date();
  const timestampForFileName = formatTimestampForFileName(timestamp);

  log(lines, `Load config: ${resolvedConfig.configPath}`);
  log(lines, 'Mode: syncOnly');
  log(lines, `Configuration: ${resolvedConfig.activeConfiguration}`);

  let syncedProjects = 0;

  for (const project of resolvedConfig.config.projects) {
    const configuration = project.configurations[resolvedConfig.activeConfiguration];
    const outputDir = resolveConfigPath(resolvedConfig.configDir, configuration.outputDir);
    const targetDir = resolveConfigPath(resolvedConfig.configDir, project.targetPluginPath);
    const filesToCopy = await collectFilesToCopy(project.assemblyName, outputDir, configuration, resolvedConfig.configDir, warnings);

    log(lines, `Project: ${project.name}`);
    await ensureDirectory(targetDir);

    if (configuration.backupBeforeOverwrite === true) {
      await backupExistingFiles(targetDir, filesToCopy.map((file) => file.name), timestampForFileName, lines);
    }

    const syncedFiles: SyncedFile[] = [];

    for (const file of filesToCopy) {
      const targetPath = path.join(targetDir, file.name);
      log(lines, `Copy ${file.sourcePath} -> ${targetPath}`);
      await fs.copyFile(file.sourcePath, targetPath);

      const stat = await fs.stat(targetPath);
      syncedFiles.push({
        sourcePath: file.sourcePath,
        targetPath,
        name: file.name,
        sha256: await sha256File(targetPath),
        size: stat.size
      });
    }

    await writeManifest(resolvedConfig, project.name, project.assemblyName, project.sourceProject, targetDir, syncedFiles, timestamp);
    log(lines, `Write manifest: ${path.join(targetDir, 'manifest.json')}`);
    syncedProjects += 1;
  }

  log(lines, 'Done');
  const logPath = await writeSyncLog(resolvedConfig.workspaceRoot, lines, timestampForFileName);

  return {
    syncedProjects,
    warnings,
    logPath
  };
}

async function collectFilesToCopy(
  assemblyName: string,
  outputDir: string,
  configuration: { copyPdb?: boolean; copyXml?: boolean; dependencies?: string[] },
  configDir: string,
  warnings: string[]
): Promise<Array<{ sourcePath: string; name: string }>> {
  const files = [
    {
      sourcePath: path.join(outputDir, `${assemblyName}.dll`),
      name: `${assemblyName}.dll`
    }
  ];

  if (configuration.copyPdb === true) {
    await addOptionalArtifact(files, path.join(outputDir, `${assemblyName}.pdb`), `${assemblyName}.pdb`, warnings);
  }

  if (configuration.copyXml === true) {
    await addOptionalArtifact(files, path.join(outputDir, `${assemblyName}.xml`), `${assemblyName}.xml`, warnings);
  }

  for (const dependency of configuration.dependencies ?? []) {
    const dependencyPath = resolveConfigPath(configDir, dependency);

    if (path.extname(dependencyPath).toLowerCase() !== '.dll') {
      warnings.push(`依赖文件不是 DLL，已跳过：${dependency}`);
      continue;
    }

    if (!(await fileExists(dependencyPath))) {
      warnings.push(`依赖 DLL 不存在，已跳过：${dependency}`);
      continue;
    }

    const dependencyName = path.basename(dependencyPath);
    if (files.some((file) => file.name.toLowerCase() === dependencyName.toLowerCase())) {
      warnings.push(`依赖 DLL 文件名重复，已跳过：${dependency}`);
      continue;
    }

    files.push({
      sourcePath: dependencyPath,
      name: dependencyName
    });
  }

  return files;
}

async function addOptionalArtifact(
  files: Array<{ sourcePath: string; name: string }>,
  sourcePath: string,
  name: string,
  warnings: string[]
): Promise<void> {
  if (await fileExists(sourcePath)) {
    files.push({ sourcePath, name });
  } else {
    warnings.push(`可选产物不存在，已跳过：${sourcePath}`);
  }
}

async function backupExistingFiles(targetDir: string, fileNames: string[], timestampForFileName: string, lines: string[]): Promise<void> {
  const backupDir = path.join(targetDir, '.dllbridge-backup', timestampForFileName);
  let createdBackupDir = false;

  for (const fileName of fileNames) {
    const targetPath = path.join(targetDir, fileName);

    if (!(await fileExists(targetPath))) {
      continue;
    }

    if (!createdBackupDir) {
      await ensureDirectory(backupDir);
      createdBackupDir = true;
    }

    const backupPath = path.join(backupDir, fileName);
    log(lines, `Backup ${targetPath} -> ${backupPath}`);
    await fs.copyFile(targetPath, backupPath);
  }
}

async function writeManifest(
  resolvedConfig: ResolvedBridgeConfig,
  projectName: string,
  assemblyName: string,
  sourceProject: string | undefined,
  targetDir: string,
  files: SyncedFile[],
  timestamp: Date
): Promise<void> {
  const hideAbsolutePaths = resolvedConfig.config.privacy?.hideAbsolutePathsInManifest === true;
  const manifestSourceProject = getManifestSourceProject(resolvedConfig.configDir, sourceProject, hideAbsolutePaths);
  const manifest = {
    tool: 'Unity DLL Bridge for VSCode',
    manifestVersion: 1,
    name: projectName,
    assemblyName: `${assemblyName}.dll`,
    configuration: resolvedConfig.activeConfiguration,
    syncTime: timestamp.toISOString(),
    sourceProject: manifestSourceProject,
    targetPath: getRelativePath(resolveConfigPath(resolvedConfig.configDir, resolvedConfig.config.unityProject), path.join(targetDir, `${assemblyName}.dll`)),
    privacy: {
      absolutePathsHidden: hideAbsolutePaths
    },
    files: files.map((file) => ({
      name: file.name,
      sha256: file.sha256,
      size: file.size
    })),
    git: null
  };

  await fs.writeFile(path.join(targetDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function getManifestSourceProject(configDir: string, sourceProject: string | undefined, hideAbsolutePaths: boolean): string | null {
  if (!sourceProject) {
    return null;
  }

  return hideAbsolutePaths ? sourceProject : resolveConfigPath(configDir, sourceProject);
}

function log(lines: string[], message: string): void {
  const time = new Date().toISOString().slice(11, 19);
  lines.push(`[${time}] ${message}`);
}
