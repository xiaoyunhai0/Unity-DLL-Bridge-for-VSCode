import * as vscode from 'vscode';
import { loadBridgeConfig } from '../config/loadConfig';
import { getResolvedBridgeConfig, validateBridgeConfig } from '../validation/validateConfig';
import { syncOnly } from '../sync/syncOnly';
import { showValidationReport } from './validationReport';

export function registerSyncOnlyCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.syncOnly', async () => {
    try {
      const loadedConfig = await loadBridgeConfig();
      const validation = await validateBridgeConfig(loadedConfig);
      const resolvedConfig = getResolvedBridgeConfig(loadedConfig, validation);

      if (!resolvedConfig) {
        vscode.window.showErrorMessage(`DLL Bridge 同步已取消：配置存在 ${validation.errors.length} 个错误`);
        showValidationReport(validation);
        return;
      }

      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Unity DLL Bridge: Sync Only',
          cancellable: false
        },
        () => syncOnly(resolvedConfig, validation.warnings)
      );

      const warningSummary = result.warnings.length > 0 ? `，${result.warnings.length} 个提醒` : '';
      vscode.window.showInformationMessage(`DLL Bridge 同步完成：${result.syncedProjects} 个项目${warningSummary}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`DLL Bridge 同步失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}
