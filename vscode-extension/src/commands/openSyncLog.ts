import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

export function registerOpenSyncLogCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.openSyncLog', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      vscode.window.showErrorMessage('当前没有打开 VSCode 工作区。');
      return;
    }

    const logPath = path.join(workspaceFolder.uri.fsPath, '.dllbridge', 'logs', 'latest.log');

    try {
      await fs.access(logPath);
      const document = await vscode.workspace.openTextDocument(logPath);
      await vscode.window.showTextDocument(document);
    } catch {
      vscode.window.showWarningMessage('还没有构建或同步日志。请先执行 Unity DLL Bridge: Build DLL Only 或 Sync Only。');
    }
  });

  context.subscriptions.push(disposable);
}
