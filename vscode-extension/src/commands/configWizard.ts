import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { BridgeBuildConfig, BridgeConfig, BridgeProjectConfiguration } from '../config/types';
import { getRelativePath } from '../utils/pathUtils';

type SourceMode = 'csproj' | 'dllOutput';
type BuildMode = 'syncOnly' | 'dotnet';

interface SelectedSource {
  mode: SourceMode;
  sourceProject?: string;
  sourceDirectory: string;
  assemblyName: string;
  debugOutputDir: string;
  releaseOutputDir: string;
  targetFramework?: string;
  hasDebugDll: boolean;
  hasReleaseDll: boolean;
}

interface QuickPickChoice<T extends string> extends vscode.QuickPickItem {
  value: T;
}

const CONFIG_FILE_NAME = 'dllbridge.json';

export function registerConfigWizardCommand(context: vscode.ExtensionContext, onDidCreateConfig?: () => void): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.configWizard', async () => {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

      if (!workspaceFolder) {
        vscode.window.showErrorMessage('当前没有打开 VSCode 工作区。请先打开外部 C# 工程或工具配置目录。');
        return;
      }

      const workspaceRoot = workspaceFolder.uri.fsPath;
      const targetPath = path.join(workspaceRoot, CONFIG_FILE_NAME);
      const canWrite = await confirmConfigOverwrite(targetPath);
      if (!canWrite) {
        return;
      }

      const unityProject = await chooseUnityProject(workspaceRoot);
      if (!unityProject) {
        return;
      }

      const source = await chooseSource(workspaceRoot);
      if (!source) {
        return;
      }

      const targetPluginPath = await chooseTargetPluginPath(unityProject, source.assemblyName);
      if (!targetPluginPath) {
        return;
      }

      const buildMode = await chooseBuildMode(source);
      if (!buildMode) {
        return;
      }

      const config = createConfig(workspaceRoot, workspaceFolder.name, unityProject, source, targetPluginPath, buildMode);
      await fs.writeFile(targetPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

      const document = await vscode.workspace.openTextDocument(targetPath);
      await vscode.window.showTextDocument(document);
      onDidCreateConfig?.();

      const validate = await vscode.window.showInformationMessage('已通过向导生成 dllbridge.json。建议立即校验路径和 DLL 产物。', '立即校验', '稍后');
      if (validate === '立即校验') {
        await vscode.commands.executeCommand('unityDllBridge.validateConfiguration');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`配置向导失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}

async function confirmConfigOverwrite(configPath: string): Promise<boolean> {
  if (!(await fileExists(configPath))) {
    return true;
  }

  const selection = await vscode.window.showWarningMessage('工作区已经存在 dllbridge.json。是否用向导重新生成并覆盖？', '覆盖', '取消');
  return selection === '覆盖';
}

async function chooseUnityProject(workspaceRoot: string): Promise<string | undefined> {
  const candidates = await findUnityProjectCandidates(workspaceRoot);

  if (candidates.length > 0) {
    const selected = await vscode.window.showQuickPick(
      [
        ...candidates.map((candidate) => ({
          label: path.basename(candidate),
          description: candidate,
          detail: '检测到 Assets/ProjectSettings 目录',
          path: candidate
        })),
        {
          label: '浏览选择 Unity 工程...',
          description: '选择包含 Assets 目录的 Unity 项目根目录',
          detail: '适合 Unity 工程不在当前 VSCode 工作区附近时使用',
          path: undefined
        }
      ],
      { placeHolder: '选择 Unity 工程根目录' }
    );

    if (!selected) {
      return undefined;
    }

    if (selected.path) {
      return selected.path;
    }
  }

  const selectedFolder = await showFolderPicker('选择 Unity 工程根目录，也就是包含 Assets 的目录', workspaceRoot);
  if (!selectedFolder) {
    return undefined;
  }

  if (!(await directoryExists(path.join(selectedFolder, 'Assets')))) {
    const proceed = await vscode.window.showWarningMessage('所选目录下没有 Assets 文件夹。仍然作为 Unity 工程路径使用吗？', '继续使用', '重新选择');
    if (proceed !== '继续使用') {
      return chooseUnityProject(workspaceRoot);
    }
  }

  return selectedFolder;
}

async function chooseSource(workspaceRoot: string): Promise<SelectedSource | undefined> {
  const mode = await vscode.window.showQuickPick<QuickPickChoice<SourceMode>>(
    [
      {
        label: '选择 C# 项目文件（推荐）',
        description: '选择 .csproj，自动推断程序集名和 Debug/Release 输出目录',
        value: 'csproj'
      },
      {
        label: '选择已有 DLL 输出目录',
        description: '没有 .csproj 或只想同步现成 DLL 时使用',
        value: 'dllOutput'
      }
    ],
    { placeHolder: '外部 C# 代码现在以哪种方式提供给 Unity？' }
  );

  if (!mode) {
    return undefined;
  }

  if (mode.value === 'csproj') {
    return chooseCsprojSource(workspaceRoot);
  }

  return chooseDllOutputSource(workspaceRoot);
}

async function chooseCsprojSource(workspaceRoot: string): Promise<SelectedSource | undefined> {
  const candidates = await findFilesInRoots(getNearbySearchRoots(workspaceRoot), '.csproj', 5, 80);
  let csprojPath: string | undefined;

  if (candidates.length > 0) {
    const selected = await vscode.window.showQuickPick(
      [
        ...candidates.map((candidate) => ({
          label: path.basename(candidate),
          description: getRelativePath(workspaceRoot, candidate),
          detail: path.dirname(candidate),
          path: candidate
        })),
        {
          label: '浏览选择其他 .csproj...',
          description: '从文件系统选择 C# 项目文件',
          detail: '',
          path: undefined
        }
      ],
      { placeHolder: '选择外部 C# 项目文件' }
    );

    if (!selected) {
      return undefined;
    }

    csprojPath = selected.path;
  }

  if (!csprojPath) {
    const selectedFile = await showFilePicker('选择外部 C# 项目文件（.csproj）', workspaceRoot, {
      'C# Project': ['csproj']
    });
    if (!selectedFile) {
      return undefined;
    }
    csprojPath = selectedFile;
  }

  const projectInfo = await readCsprojInfo(csprojPath);
  const assemblyName = await askAssemblyName(projectInfo.assemblyName ?? path.basename(csprojPath, '.csproj'));
  if (!assemblyName) {
    return undefined;
  }

  const targetFramework = await chooseTargetFramework(projectInfo.targetFrameworks);
  if (!targetFramework) {
    return undefined;
  }

  const sourceDirectory = path.dirname(csprojPath);
  const debugOutputDir = path.join(sourceDirectory, 'bin', 'Debug', targetFramework);
  const releaseOutputDir = path.join(sourceDirectory, 'bin', 'Release', targetFramework);

  return {
    mode: 'csproj',
    sourceProject: csprojPath,
    sourceDirectory,
    assemblyName,
    debugOutputDir,
    releaseOutputDir,
    targetFramework,
    hasDebugDll: await fileExists(path.join(debugOutputDir, `${assemblyName}.dll`)),
    hasReleaseDll: await fileExists(path.join(releaseOutputDir, `${assemblyName}.dll`))
  };
}

async function chooseDllOutputSource(workspaceRoot: string): Promise<SelectedSource | undefined> {
  const candidates = await findDllCandidates(workspaceRoot);
  let dllPath: string | undefined;

  if (candidates.length > 0) {
    const selected = await vscode.window.showQuickPick(
      [
        ...candidates.map((candidate) => ({
          label: path.basename(candidate),
          description: getRelativePath(workspaceRoot, path.dirname(candidate)),
          detail: candidate,
          path: candidate
        })),
        {
          label: '浏览选择其他 DLL...',
          description: '从文件系统选择已经构建好的主 DLL',
          detail: '',
          path: undefined
        }
      ],
      { placeHolder: '选择要同步到 Unity 的主 DLL' }
    );

    if (!selected) {
      return undefined;
    }

    dllPath = selected.path;
  }

  if (!dllPath) {
    const selectedFile = await showFilePicker('选择已经构建好的主 DLL', workspaceRoot, {
      'DLL': ['dll']
    });
    if (!selectedFile) {
      return undefined;
    }
    dllPath = selectedFile;
  }

  const outputDir = path.dirname(dllPath);
  const assemblyName = await askAssemblyName(path.basename(dllPath, '.dll'));
  if (!assemblyName) {
    return undefined;
  }

  return {
    mode: 'dllOutput',
    sourceDirectory: outputDir,
    assemblyName,
    debugOutputDir: outputDir,
    releaseOutputDir: outputDir,
    hasDebugDll: await fileExists(path.join(outputDir, `${assemblyName}.dll`)),
    hasReleaseDll: await fileExists(path.join(outputDir, `${assemblyName}.dll`))
  };
}

async function chooseTargetPluginPath(unityProject: string, assemblyName: string): Promise<string | undefined> {
  const defaultTarget = path.join(unityProject, 'Assets', 'Plugins', assemblyName, 'Runtime');
  const pluginsPath = path.join(unityProject, 'Assets', 'Plugins');
  const hasPluginsPath = await directoryExists(pluginsPath);

  const choices: Array<vscode.QuickPickItem & { path?: string; browse?: boolean }> = [
    {
      label: `使用推荐目录：Assets/Plugins/${assemblyName}/Runtime`,
      description: defaultTarget,
      path: defaultTarget
    }
  ];

  if (hasPluginsPath) {
    choices.push({
      label: '选择已有 Assets/Plugins 子目录...',
      description: pluginsPath,
      browse: true
    });
  }

  choices.push({
    label: '浏览选择其他 Unity 目标目录...',
    description: '必须位于 Unity 工程 Assets 目录内',
    browse: true
  });

  const selected = await vscode.window.showQuickPick(choices, {
    placeHolder: '选择 DLL 同步到 Unity 的目标目录'
  });

  if (!selected) {
    return undefined;
  }

  if (selected.path) {
    return selected.path;
  }

  const selectedFolder = await showFolderPicker('选择 Unity 目标目录，建议位于 Assets/Plugins 下', hasPluginsPath ? pluginsPath : path.join(unityProject, 'Assets'));
  if (!selectedFolder) {
    return undefined;
  }

  const unityAssetsPath = path.join(unityProject, 'Assets');
  if (!isInsideOrEqual(unityAssetsPath, selectedFolder)) {
    const proceed = await vscode.window.showWarningMessage('所选目标目录不在 Unity 工程的 Assets 目录内，后续校验会失败。是否重新选择？', '重新选择', '继续使用');
    if (proceed === '重新选择') {
      return chooseTargetPluginPath(unityProject, assemblyName);
    }
  }

  return selectedFolder;
}

async function chooseBuildMode(source: SelectedSource): Promise<BuildMode | undefined> {
  const choices: Array<QuickPickChoice<BuildMode>> = [
    {
      label: '只同步已有 DLL（推荐离线/Visual Studio 编译场景）',
      description: source.hasDebugDll || source.hasReleaseDll ? '已检测到 DLL 产物' : '需要先用 Visual Studio、dotnet 或公司工具生成 DLL',
      value: 'syncOnly'
    }
  ];

  if (source.mode === 'csproj') {
    choices.push({
      label: '在 VSCode 中使用 dotnet build 构建',
      description: '需要离线环境已安装 dotnet SDK',
      value: 'dotnet'
    });
  }

  const selected = await vscode.window.showQuickPick(choices, {
    placeHolder: '选择构建方式'
  });

  return selected?.value;
}

function createConfig(
  workspaceRoot: string,
  workspaceName: string,
  unityProject: string,
  source: SelectedSource,
  targetPluginPath: string,
  buildMode: BuildMode
): BridgeConfig {
  const debugConfig = createProjectConfiguration(workspaceRoot, source.debugOutputDir, true, true);
  const releaseConfig = createProjectConfiguration(workspaceRoot, source.releaseOutputDir, false, false);
  const sourceProject = source.sourceProject ? getRelativePath(workspaceRoot, source.sourceProject) : undefined;
  const build = createBuildConfig(workspaceRoot, source, buildMode);

  return {
    version: 1,
    name: workspaceName,
    unityProject: getRelativePath(workspaceRoot, unityProject),
    defaultConfiguration: 'Debug',
    build,
    privacy: {
      hideAbsolutePathsInManifest: true
    },
    projects: [
      {
        id: toKebabCase(source.assemblyName),
        name: source.assemblyName,
        assemblyName: source.assemblyName,
        ...(sourceProject ? { sourceProject } : {}),
        targetPluginPath: getRelativePath(workspaceRoot, targetPluginPath),
        allowSourceCopy: false,
        configurations: {
          Debug: debugConfig,
          Release: releaseConfig
        }
      }
    ]
  };
}

function createProjectConfiguration(workspaceRoot: string, outputDir: string, copyPdb: boolean, copyXml: boolean): BridgeProjectConfiguration {
  return {
    outputDir: getRelativePath(workspaceRoot, outputDir),
    copyPdb,
    copyXml,
    backupBeforeOverwrite: true,
    dependencies: []
  };
}

function createBuildConfig(workspaceRoot: string, source: SelectedSource, buildMode: BuildMode): BridgeBuildConfig {
  const build: BridgeBuildConfig = {
    mode: buildMode,
    timeoutSeconds: 120
  };

  if (buildMode === 'dotnet' && source.sourceProject) {
    build.projectPath = getRelativePath(workspaceRoot, source.sourceProject);
  }

  return build;
}

async function readCsprojInfo(csprojPath: string): Promise<{ assemblyName?: string; targetFrameworks: string[] }> {
  const content = await fs.readFile(csprojPath, 'utf8');
  const assemblyName = firstXmlValue(content, 'AssemblyName');
  const targetFrameworks = [
    ...splitFrameworks(firstXmlValue(content, 'TargetFrameworks')),
    ...splitFrameworks(firstXmlValue(content, 'TargetFramework'))
  ];

  return {
    assemblyName,
    targetFrameworks: unique(targetFrameworks).filter(Boolean)
  };
}

async function chooseTargetFramework(targetFrameworks: string[]): Promise<string | undefined> {
  if (targetFrameworks.length === 0) {
    const typed = await vscode.window.showInputBox({
      title: '填写目标框架',
      prompt: '没有在 .csproj 中找到 TargetFramework，请填写构建输出目录中的框架名',
      value: 'netstandard2.1',
      validateInput: (value) => (value.trim() === '' ? '目标框架不能为空' : undefined)
    });
    return typed?.trim();
  }

  if (targetFrameworks.length === 1) {
    return targetFrameworks[0];
  }

  const selected = await vscode.window.showQuickPick(
    targetFrameworks.map((framework) => ({ label: framework })),
    { placeHolder: '选择 Unity 使用的目标框架输出目录' }
  );

  return selected?.label;
}

async function askAssemblyName(defaultValue: string): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    title: '确认 DLL 程序集名',
    prompt: '填写不带 .dll 后缀的程序集名',
    value: defaultValue,
    validateInput: (input) => {
      const trimmed = input.trim();
      if (trimmed === '') {
        return '程序集名不能为空';
      }
      if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.toLowerCase().endsWith('.dll')) {
        return '只填写程序集名，例如 GameLogic，不要包含路径或 .dll 后缀';
      }
      return undefined;
    }
  });

  return value?.trim();
}

async function findUnityProjectCandidates(workspaceRoot: string): Promise<string[]> {
  const searchRoots = getNearbySearchRoots(workspaceRoot);
  const candidates: string[] = [];

  for (const searchRoot of searchRoots) {
    candidates.push(...(await findDirectories(searchRoot, isUnityProjectDirectory, 3, 20)));
  }

  return unique(candidates).slice(0, 20);
}

async function findDllCandidates(workspaceRoot: string): Promise<string[]> {
  const files = await findFilesInRoots(getNearbySearchRoots(workspaceRoot), '.dll', 7, 120);
  return files
    .filter((filePath) => {
      const normalized = filePath.split(path.sep).join('/').toLowerCase();
      return normalized.includes('/bin/') && !normalized.includes('/obj/');
    })
    .slice(0, 80);
}

async function findFilesInRoots(roots: string[], extension: string, maxDepth: number, maxResults: number): Promise<string[]> {
  const results: string[] = [];

  for (const root of roots) {
    if (results.length >= maxResults) {
      break;
    }

    results.push(...(await findFiles(root, extension, maxDepth, maxResults - results.length)));
  }

  return unique(results).sort();
}

function getNearbySearchRoots(workspaceRoot: string): string[] {
  const roots = [workspaceRoot];
  let current = workspaceRoot;

  for (let depth = 0; depth < 3; depth += 1) {
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    roots.push(parent);
    current = parent;
  }

  return unique(roots);
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

async function findDirectories(
  root: string,
  predicate: (directory: string) => Promise<boolean>,
  maxDepth: number,
  maxResults: number
): Promise<string[]> {
  const results: string[] = [];

  async function visit(directory: string, depth: number): Promise<void> {
    if (results.length >= maxResults || depth > maxDepth) {
      return;
    }

    if (await predicate(directory)) {
      results.push(directory);
      return;
    }

    let entries: Array<import('fs').Dirent>;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults || !entry.isDirectory() || shouldSkipDirectory(entry.name)) {
        continue;
      }

      await visit(path.join(directory, entry.name), depth + 1);
    }
  }

  await visit(root, 0);
  return results.sort();
}

async function isUnityProjectDirectory(directory: string): Promise<boolean> {
  return (await directoryExists(path.join(directory, 'Assets'))) && (await directoryExists(path.join(directory, 'ProjectSettings')));
}

function shouldSkipDirectory(name: string): boolean {
  return ['.git', '.vs', '.vscode', 'Library', 'Temp', 'Obj', 'obj', 'node_modules', 'out', 'releases'].includes(name);
}

async function showFolderPicker(title: string, defaultUriPath: string): Promise<string | undefined> {
  const selected = await vscode.window.showOpenDialog({
    title,
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: vscode.Uri.file(defaultUriPath)
  });

  return selected?.[0]?.fsPath;
}

async function showFilePicker(title: string, defaultUriPath: string, filters: Record<string, string[]>): Promise<string | undefined> {
  const selected = await vscode.window.showOpenDialog({
    title,
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    defaultUri: vscode.Uri.file(defaultUriPath),
    filters
  });

  return selected?.[0]?.fsPath;
}

function firstXmlValue(content: string, tagName: string): string | undefined {
  const match = new RegExp(`<${tagName}>\\s*([^<]+?)\\s*</${tagName}>`, 'i').exec(content);
  return match?.[1]?.trim();
}

function splitFrameworks(value: string | undefined): string[] {
  return value?.split(';').map((item) => item.trim()).filter(Boolean) ?? [];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
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

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function isInsideOrEqual(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
