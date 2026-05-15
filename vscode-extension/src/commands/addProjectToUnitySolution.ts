import * as cp from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { loadBridgeConfig } from '../config/loadConfig';
import { BridgeProject, BridgeProjectConfiguration } from '../config/types';
import { findFilesInRoots, getNearbySearchRoots, readCsprojInfo } from '../discovery/projectDiscovery';
import { DotnetResolveResult, resolveDotnetCommand, shouldUseShell } from '../dotnet/dotnetLocator';
import { solutionContainsProject } from '../solution/solutionParser';
import { getRelativePath, isPlainObject, resolveConfigPath } from '../utils/pathUtils';

interface SolutionCandidate extends vscode.QuickPickItem {
  path: string;
}

interface ProjectCandidate extends vscode.QuickPickItem {
  path: string;
}

interface CommandResult {
  exitCode: number | null;
  lines: string[];
  dotnet: DotnetResolveResult;
}

interface ConfigDefaults {
  configDir: string;
  configPath?: string;
  config?: Record<string, unknown>;
  unityProject?: string;
  solutionPath?: string;
  projectPath?: string;
  dotnetPath?: string;
}

export function registerAddProjectToUnitySolutionCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.addProjectToUnitySolution', async () => {
    const output = vscode.window.createOutputChannel('Unity DLL Bridge');

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('当前没有打开 VSCode 工作区。');
        return;
      }

      const defaults = await getConfigDefaults(workspaceFolder.uri.fsPath);
      const unityProject = defaults.unityProject ?? (await chooseUnityProject(workspaceFolder.uri.fsPath));
      if (!unityProject) {
        return;
      }

      const solutionPath = await chooseSolutionPath(unityProject, defaults.solutionPath);
      if (!solutionPath) {
        return;
      }

      const projectPath = await chooseProjectPath(workspaceFolder.uri.fsPath, defaults.projectPath);
      if (!projectPath) {
        return;
      }

      if (await solutionContainsProject(solutionPath, projectPath)) {
        const configPath = await upsertSolutionWorkflowConfig(workspaceFolder.uri.fsPath, workspaceFolder.name, defaults, unityProject, solutionPath, projectPath);
        await vscode.commands.executeCommand('unityDllBridge.refreshActionsView');
        vscode.window.showInformationMessage(`Unity 解决方案已包含 ${path.basename(projectPath)}，已写入 ${path.basename(configPath)}，现在可以直接点击“生成”。`);
        return;
      }

      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Unity DLL Bridge: 添加工程到 Unity 解决方案',
          cancellable: false
        },
        async () => {
          const dotnet = await resolveDotnetCommand(defaults.configDir, defaults.dotnetPath);
          return runDotnetSlnAdd(solutionPath, projectPath, dotnet);
        }
      );

      showCommandOutput(output, solutionPath, projectPath, result);

      if (result.exitCode !== 0) {
        output.show(true);
        vscode.window.showErrorMessage(`添加工程失败，退出码：${result.exitCode ?? 'unknown'}。请查看 Unity DLL Bridge 输出。`);
        return;
      }

      const configPath = await upsertSolutionWorkflowConfig(workspaceFolder.uri.fsPath, workspaceFolder.name, defaults, unityProject, solutionPath, projectPath);
      await vscode.commands.executeCommand('unityDllBridge.refreshActionsView');
      vscode.window.showInformationMessage(`已添加 ${path.basename(projectPath)} 到 ${path.basename(solutionPath)}，并写入 ${path.basename(configPath)}。现在可以直接点击“生成”。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.appendLine(`添加工程到 Unity 解决方案失败：${message}`);
      output.show(true);
      const selection = await vscode.window.showErrorMessage(`添加工程到 Unity 解决方案失败：${message}`, '配置 dotnet 路径');
      if (selection === '配置 dotnet 路径') {
        await vscode.commands.executeCommand('unityDllBridge.configureDotnetPath');
      }
    }
  });

  context.subscriptions.push(disposable);
}

async function getConfigDefaults(workspaceRoot: string): Promise<ConfigDefaults> {
  try {
    const loaded = await loadBridgeConfig();
    const config = isPlainObject(loaded.config) ? loaded.config : {};
    const unityProject = typeof config.unityProject === 'string' ? resolveConfigPath(loaded.configDir, config.unityProject) : undefined;
    const solutionPath = isPlainObject(config.build) && typeof config.build.solutionPath === 'string'
      ? resolveConfigPath(loaded.configDir, config.build.solutionPath)
      : undefined;
    const configuredProject: string | undefined =
      isPlainObject(config.build) && typeof config.build.projectPath === 'string'
        ? config.build.projectPath
        : Array.isArray(config.projects)
          ? getFirstConfiguredSourceProject(config.projects)
          : undefined;
    const projectPath = configuredProject ? resolveConfigPath(loaded.configDir, configuredProject) : undefined;

    return {
      configDir: loaded.configDir,
      configPath: loaded.configPath,
      config,
      unityProject: unityProject && (await directoryExists(unityProject)) ? unityProject : undefined,
      solutionPath: solutionPath && (await fileExists(solutionPath)) ? solutionPath : undefined,
      projectPath: projectPath && (await fileExists(projectPath)) ? projectPath : undefined,
      dotnetPath: isPlainObject(config.build) && typeof config.build.dotnetPath === 'string' ? config.build.dotnetPath : undefined
    };
  } catch {
    return { configDir: workspaceRoot };
  }
}

async function chooseUnityProject(workspaceRoot: string): Promise<string | undefined> {
  const selected = await vscode.window.showOpenDialog({
    title: '选择 Unity 工程根目录，也就是包含 Assets 的目录',
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: vscode.Uri.file(workspaceRoot)
  });

  return selected?.[0]?.fsPath;
}

async function chooseSolutionPath(unityProject: string, configuredSolutionPath: string | undefined): Promise<string | undefined> {
  const candidates = await findSolutionCandidates(unityProject);
  const allCandidates = unique([configuredSolutionPath, ...candidates].filter((candidate): candidate is string => Boolean(candidate)));

  if (allCandidates.length > 0) {
    const selected = await vscode.window.showQuickPick<SolutionCandidate>(
      [
        ...allCandidates.map((candidate) => ({
          label: path.basename(candidate),
          description: getRelativePath(unityProject, candidate),
          detail: candidate === configuredSolutionPath ? '当前配置的 Unity 解决方案' : undefined,
          path: candidate
        })),
        {
          label: '浏览选择其他 .sln...',
          description: 'Unity 解决方案不在工程根目录时使用',
          path: ''
        }
      ],
      { placeHolder: '选择 Unity 生成的 .sln 解决方案' }
    );

    if (!selected) {
      return undefined;
    }

    if (selected.path) {
      return selected.path;
    }
  }

  const selected = await vscode.window.showOpenDialog({
    title: '选择 Unity 生成的 .sln 解决方案',
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    defaultUri: vscode.Uri.file(unityProject),
    filters: {
      'Solution': ['sln']
    }
  });

  return selected?.[0]?.fsPath;
}

async function chooseProjectPath(workspaceRoot: string, configuredProjectPath: string | undefined): Promise<string | undefined> {
  const candidates = await findFilesInRoots(getNearbySearchRoots(workspaceRoot), '.csproj', { maxDepth: 6, maxResults: 120 });
  const allCandidates = unique([configuredProjectPath, ...candidates].filter((candidate): candidate is string => Boolean(candidate)));

  if (allCandidates.length > 0) {
    const selected = await vscode.window.showQuickPick<ProjectCandidate>(
      [
        ...allCandidates.map((candidate) => ({
          label: path.basename(candidate),
          description: getRelativePath(workspaceRoot, candidate),
          detail: candidate === configuredProjectPath ? '当前配置的外部 C# 工程' : path.dirname(candidate),
          path: candidate
        })),
        {
          label: '浏览选择其他 .csproj...',
          description: '.csproj 代表整个外部 C# 工程',
          path: ''
        }
      ],
      { placeHolder: '选择要加入 Unity 解决方案的外部 C# 工程' }
    );

    if (!selected) {
      return undefined;
    }

    if (selected.path) {
      return selected.path;
    }
  }

  const selected = await vscode.window.showOpenDialog({
    title: '选择要加入 Unity 解决方案的外部 C# 工程（.csproj）',
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    defaultUri: vscode.Uri.file(workspaceRoot),
    filters: {
      'C# Project': ['csproj']
    }
  });

  return selected?.[0]?.fsPath;
}

async function upsertSolutionWorkflowConfig(
  workspaceRoot: string,
  workspaceName: string,
  defaults: ConfigDefaults,
  unityProject: string,
  solutionPath: string,
  projectPath: string
): Promise<string> {
  const configPath = defaults.configPath ?? path.join(workspaceRoot, 'dllbridge.json');
  const configDir = defaults.configPath ? defaults.configDir : workspaceRoot;
  const config = defaults.config ? { ...defaults.config } : createEmptyConfig(workspaceName);
  const projectInfo = await readCsprojInfo(projectPath);
  const assemblyName = projectInfo.assemblyName ?? path.basename(projectPath, '.csproj');
  const targetFramework = projectInfo.targetFrameworks[0];
  const debugOutputDir = inferOutputDir(projectPath, 'Debug', targetFramework);
  const releaseOutputDir = inferOutputDir(projectPath, 'Release', targetFramework);
  const projectEntry = createProjectEntry(configDir, unityProject, projectPath, assemblyName, debugOutputDir, releaseOutputDir);

  config.version = 1;
  config.name = typeof config.name === 'string' ? config.name : workspaceName;
  config.unityProject = getRelativePath(configDir, unityProject);
  config.defaultConfiguration = typeof config.defaultConfiguration === 'string' ? config.defaultConfiguration : 'Debug';
  config.privacy = isPlainObject(config.privacy) ? { ...config.privacy, hideAbsolutePathsInManifest: true } : { hideAbsolutePathsInManifest: true };
  config.watch = isPlainObject(config.watch) ? config.watch : { enabled: false, debounceSeconds: 2 };
  config.build = createBuildConfig(configDir, config.build, solutionPath, projectPath);
  config.projects = upsertProject(configDir, Array.isArray(config.projects) ? config.projects : [], projectEntry);

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return configPath;
}

function createEmptyConfig(workspaceName: string): Record<string, unknown> {
  return {
    version: 1,
    name: workspaceName,
    defaultConfiguration: 'Debug',
    privacy: {
      hideAbsolutePathsInManifest: true
    },
    watch: {
      enabled: false,
      debounceSeconds: 2
    },
    projects: []
  };
}

function getFirstConfiguredSourceProject(projects: unknown[]): string | undefined {
  for (const project of projects) {
    if (isPlainObject(project) && typeof project.sourceProject === 'string') {
      return project.sourceProject;
    }
  }

  return undefined;
}

function createBuildConfig(configDir: string, existingBuild: unknown, solutionPath: string, projectPath: string): Record<string, unknown> {
  const build = isPlainObject(existingBuild) ? { ...existingBuild } : {};
  build.mode = 'dotnet';
  build.solutionPath = getRelativePath(configDir, solutionPath);
  build.projectPath = getRelativePath(configDir, projectPath);
  build.timeoutSeconds = Number.isFinite(build.timeoutSeconds) && Number(build.timeoutSeconds) > 0 ? build.timeoutSeconds : 120;
  return build;
}

function createProjectEntry(
  configDir: string,
  unityProject: string,
  projectPath: string,
  assemblyName: string,
  debugOutputDir: string,
  releaseOutputDir: string
): BridgeProject {
  return {
    id: toKebabCase(assemblyName),
    name: assemblyName,
    assemblyName,
    sourceProject: getRelativePath(configDir, projectPath),
    targetPluginPath: getRelativePath(configDir, path.join(unityProject, 'Assets', 'Plugins', assemblyName, 'Runtime')),
    allowSourceCopy: false,
    configurations: {
      Debug: createProjectConfiguration(configDir, debugOutputDir, true, true),
      Release: createProjectConfiguration(configDir, releaseOutputDir, false, false)
    }
  };
}

function createProjectConfiguration(configDir: string, outputDir: string, copyPdb: boolean, copyXml: boolean): BridgeProjectConfiguration {
  return {
    outputDir: getRelativePath(configDir, outputDir),
    copyPdb,
    copyXml,
    backupBeforeOverwrite: true,
    dependencies: []
  };
}

function upsertProject(configDir: string, projects: unknown[], nextProject: BridgeProject): BridgeProject[] {
  const sourceProjectPath = nextProject.sourceProject ? resolveConfigPath(configDir, nextProject.sourceProject) : undefined;
  let didUpdate = false;

  const normalizedProjects = projects.filter(isPlainObject).map((project) => {
    if (!isSameProject(configDir, project, nextProject.assemblyName, sourceProjectPath)) {
      return project as unknown as BridgeProject;
    }

    didUpdate = true;
    return {
      ...project,
      ...nextProject,
      targetPluginPath: typeof project.targetPluginPath === 'string' ? project.targetPluginPath : nextProject.targetPluginPath
    } as unknown as BridgeProject;
  });

  if (!didUpdate) {
    normalizedProjects.push(nextProject);
  }

  return normalizedProjects;
}

function isSameProject(configDir: string, project: Record<string, unknown>, assemblyName: string, sourceProjectPath: string | undefined): boolean {
  if (sourceProjectPath && typeof project.sourceProject === 'string') {
    return resolveConfigPath(configDir, project.sourceProject) === sourceProjectPath;
  }

  return typeof project.assemblyName === 'string' && project.assemblyName.toLowerCase() === assemblyName.toLowerCase();
}

function inferOutputDir(projectPath: string, configuration: 'Debug' | 'Release', targetFramework: string | undefined): string {
  const projectDir = path.dirname(projectPath);
  return targetFramework ? path.join(projectDir, 'bin', configuration, targetFramework) : path.join(projectDir, 'bin', configuration);
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'project';
}

async function findSolutionCandidates(unityProject: string): Promise<string[]> {
  const files = await findFiles(unityProject, '.sln', 1, 20);
  return files.filter((filePath) => !filePath.split(path.sep).includes('Library'));
}

async function findFiles(root: string, extension: string, maxDepth: number, maxResults: number): Promise<string[]> {
  const results: string[] = [];

  async function visit(directory: string, depth: number): Promise<void> {
    if (results.length >= maxResults || depth > maxDepth) {
      return;
    }

    let entries: Array<import('fs').Dirent>;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) {
        return;
      }

      if (shouldSkipDirectory(entry.name)) {
        continue;
      }

      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
        results.push(entryPath);
      }
    }
  }

  await visit(root, 0);
  return results.sort();
}

function runDotnetSlnAdd(solutionPath: string, projectPath: string, dotnet: DotnetResolveResult): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    const child = cp.spawn(dotnet.command, ['sln', solutionPath, 'add', projectPath], {
      cwd: path.dirname(solutionPath),
      shell: shouldUseShell(dotnet.command)
    });

    child.stdout.on('data', (chunk) => appendOutput(lines, chunk));
    child.stderr.on('data', (chunk) => appendOutput(lines, chunk));
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ exitCode, lines, dotnet }));
  });
}

function showCommandOutput(output: vscode.OutputChannel, solutionPath: string, projectPath: string, result: CommandResult): void {
  output.clear();
  output.appendLine('Unity DLL Bridge 添加外部工程到 Unity 解决方案');
  output.appendLine('');
  output.appendLine(`Solution: ${solutionPath}`);
  output.appendLine(`Project: ${projectPath}`);
  output.appendLine(`Dotnet: ${result.dotnet.label}${result.dotnet.version ? ` (${result.dotnet.version})` : ''}`);
  output.appendLine(`Command: ${result.dotnet.command} sln "${solutionPath}" add "${projectPath}"`);
  output.appendLine('');

  for (const line of result.lines) {
    output.appendLine(line);
  }

  output.appendLine('');
  output.appendLine(`Exit code: ${result.exitCode}`);
}

function appendOutput(lines: string[], chunk: Buffer): void {
  const text = chunk.toString('utf8').replace(/\r/g, '');
  for (const line of text.split('\n')) {
    if (line.length > 0) {
      lines.push(line);
    }
  }
}

function shouldSkipDirectory(name: string): boolean {
  return ['.git', '.vs', '.vscode', 'Library', 'Temp', 'Obj', 'obj', 'node_modules', 'out', 'releases'].includes(name);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function directoryExists(directoryPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(directoryPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
