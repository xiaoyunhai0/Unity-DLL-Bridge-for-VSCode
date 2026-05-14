import * as path from 'path';
import * as vscode from 'vscode';
import { loadBridgeConfig } from '../config/loadConfig';
import { BridgeConfig } from '../config/types';
import { discoverWorkspace } from '../discovery/projectDiscovery';
import { getRelativePath, resolveConfigPath } from '../utils/pathUtils';

interface SolutionChoice extends vscode.QuickPickItem {
  path: string;
}

export function registerOpenUnitySolutionCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.openUnitySolution', async () => {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('当前没有打开 VSCode 工作区。');
        return;
      }

      const workspaceRoot = workspaceFolder.uri.fsPath;
      const solutions = await findSolutions(workspaceRoot);

      if (solutions.length === 0) {
        vscode.window.showWarningMessage('没有找到 Unity 生成的 .sln。请先在 Unity 中双击任意脚本生成解决方案。');
        return;
      }

      const selected = solutions.length === 1 ? { path: solutions[0] } : await vscode.window.showQuickPick<SolutionChoice>(
        solutions.map((solution) => ({
          label: path.basename(solution),
          description: getRelativePath(workspaceRoot, solution),
          path: solution
        })),
        { placeHolder: '选择要打开的 Unity 解决方案' }
      );

      if (!selected) {
        return;
      }

      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(selected.path));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`打开 Unity 解决方案失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}

async function findSolutions(workspaceRoot: string): Promise<string[]> {
  try {
    const loaded = await loadBridgeConfig();
    const config = loaded.config as Partial<BridgeConfig>;
    if (typeof config.unityProject === 'string') {
      const unityProject = resolveConfigPath(loaded.configDir, config.unityProject);
      const discovery = await discoverWorkspace(unityProject);
      const fromUnityProject = discovery.solutions.filter((solution) => path.dirname(solution) === unityProject);
      if (fromUnityProject.length > 0) {
        return fromUnityProject;
      }
    }
  } catch {
    // Fall back to workspace discovery.
  }

  return (await discoverWorkspace(workspaceRoot)).solutions;
}
