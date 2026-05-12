import * as vscode from 'vscode';
import { loadBridgeConfig } from '../config/loadConfig';
import { validateBridgeConfig } from '../validation/validateConfig';
import { showValidationReport } from './validationReport';

export function registerValidateConfigurationCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.validateConfiguration', async () => {
    try {
      const loadedConfig = await loadBridgeConfig();
      const result = await validateBridgeConfig(loadedConfig);

      if (result.errors.length > 0) {
        const message = `DLL Bridge 配置校验失败：${result.errors.length} 个错误`;
        vscode.window.showErrorMessage(message, '查看详情').then((selection) => {
          if (selection === '查看详情') {
            showValidationReport(result);
          }
        });
        showValidationReport(result);
        return;
      }

      const warningSummary = result.warnings.length > 0 ? `，${result.warnings.length} 个提醒` : '';
      vscode.window.showInformationMessage(`DLL Bridge 配置校验通过${warningSummary}`);

      if (result.warnings.length > 0) {
        showValidationReport(result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`DLL Bridge 配置校验失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}
