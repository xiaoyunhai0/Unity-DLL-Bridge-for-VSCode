import * as cp from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { loadBridgeConfig } from '../config/loadConfig';
import { BridgeConfig } from '../config/types';
import { getRelativePath, resolveConfigPath } from '../utils/pathUtils';

interface SolutionCandidate extends vscode.QuickPickItem {
  path: string;
}

interface ProjectCandidate extends vscode.QuickPickItem {
  path: string;
}

interface CommandResult {
  exitCode: number | null;
  lines: string[];
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

      const defaults = await getConfigDefaults();
      const unityProject = defaults.unityProject ?? (await chooseUnityProject(workspaceFolder.uri.fsPath));
      if (!unityProject) {
        return;
      }

      const solutionPath = await chooseSolutionPath(unityProject);
      if (!solutionPath) {
        return;
      }

      const projectPath = defaults.projectPath ?? (await chooseProjectPath(workspaceFolder.uri.fsPath));
      if (!projectPath) {
        return;
      }

      if (await solutionContainsProject(solutionPath, projectPath)) {
        vscode.window.showInformationMessage(`Unity 解决方案已包含外部工程：${path.basename(projectPath)}`);
        return;
      }

      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Unity DLL Bridge: 添加工程到 Unity 解决方案',
          cancellable: false
        },
        () => runDotnetSlnAdd(solutionPath, projectPath)
      );

      showCommandOutput(output, solutionPath, projectPath, result);

      if (result.exitCode !== 0) {
        output.show(true);
        vscode.window.showErrorMessage(`添加工程失败，退出码：${result.exitCode ?? 'unknown'}。请查看 Unity DLL Bridge 输出。`);
        return;
      }

      vscode.window.showInformationMessage(`已添加 ${path.basename(projectPath)} 到 ${path.basename(solutionPath)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.appendLine(`添加工程到 Unity 解决方案失败：${message}`);
      output.show(true);
      vscode.window.showErrorMessage(`添加工程到 Unity 解决方案失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}

async function getConfigDefaults(): Promise<{ unityProject?: string; projectPath?: string }> {
  try {
    const loaded = await loadBridgeConfig();
    const config = loaded.config as Partial<BridgeConfig>;
    const unityProject = typeof config.unityProject === 'string' ? resolveConfigPath(loaded.configDir, config.unityProject) : undefined;
    const configuredProject =
      typeof config.build?.projectPath === 'string'
        ? config.build.projectPath
        : config.projects?.find((project) => typeof project.sourceProject === 'string')?.sourceProject;
    const projectPath = configuredProject ? resolveConfigPath(loaded.configDir, configuredProject) : undefined;

    return {
      unityProject: unityProject && (await directoryExists(unityProject)) ? unityProject : undefined,
      projectPath: projectPath && (await fileExists(projectPath)) ? projectPath : undefined
    };
  } catch {
    return {};
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

async function chooseSolutionPath(unityProject: string): Promise<string | undefined> {
  const candidates = await findSolutionCandidates(unityProject);

  if (candidates.length > 0) {
    const selected = await vscode.window.showQuickPick<SolutionCandidate>(
      [
        ...candidates.map((candidate) => ({
          label: path.basename(candidate),
          description: getRelativePath(unityProject, candidate),
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

async function chooseProjectPath(workspaceRoot: string): Promise<string | undefined> {
  const candidates = await findFiles(workspaceRoot, '.csproj', 5, 80);

  if (candidates.length > 0) {
    const selected = await vscode.window.showQuickPick<ProjectCandidate>(
      [
        ...candidates.map((candidate) => ({
          label: path.basename(candidate),
          description: getRelativePath(workspaceRoot, candidate),
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

async function solutionContainsProject(solutionPath: string, projectPath: string): Promise<boolean> {
  const content = await fs.readFile(solutionPath, 'utf8');
  const solutionDir = path.dirname(solutionPath);
  const relativeProjectPath = getRelativePath(solutionDir, projectPath).replace(/\//g, '\\').toLowerCase();
  const normalizedContent = content.replace(/\//g, '\\').toLowerCase();

  return normalizedContent.includes(relativeProjectPath) || normalizedContent.includes(path.basename(projectPath).toLowerCase());
}

function runDotnetSlnAdd(solutionPath: string, projectPath: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const lines: string[] = [];
    const child = cp.spawn('dotnet', ['sln', solutionPath, 'add', projectPath], {
      cwd: path.dirname(solutionPath),
      shell: process.platform === 'win32'
    });

    child.stdout.on('data', (chunk) => appendOutput(lines, chunk));
    child.stderr.on('data', (chunk) => appendOutput(lines, chunk));
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ exitCode, lines }));
  });
}

function showCommandOutput(output: vscode.OutputChannel, solutionPath: string, projectPath: string, result: CommandResult): void {
  output.clear();
  output.appendLine('Unity DLL Bridge 添加外部工程到 Unity 解决方案');
  output.appendLine('');
  output.appendLine(`Solution: ${solutionPath}`);
  output.appendLine(`Project: ${projectPath}`);
  output.appendLine(`Command: dotnet sln "${solutionPath}" add "${projectPath}"`);
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
