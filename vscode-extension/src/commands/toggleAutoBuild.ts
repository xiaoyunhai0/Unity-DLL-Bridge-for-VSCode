import * as vscode from 'vscode';
import { AutoBuildWatcher } from '../watch/autoBuildWatcher';

export function registerToggleAutoBuildCommand(context: vscode.ExtensionContext, watcher: AutoBuildWatcher): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.toggleAutoBuild', async () => {
    try {
      const enabled = await watcher.toggle();
      vscode.window.showInformationMessage(enabled ? '已开启源码变化后自动构建并同步。' : '已关闭自动构建并同步。');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`切换自动构建失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}
