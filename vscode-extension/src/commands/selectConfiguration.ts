import * as vscode from 'vscode';
import { getActiveConfiguration, getConfigurationNames, setActiveConfiguration } from '../config/activeConfiguration';
import { loadBridgeConfig } from '../config/loadConfig';
import { getResolvedBridgeConfig, validateBridgeConfig } from '../validation/validateConfig';

export function registerSelectConfigurationCommand(context: vscode.ExtensionContext, onDidChangeConfiguration?: () => void): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.selectConfiguration', async () => {
    try {
      const loadedConfig = await loadBridgeConfig();
      const validation = await validateBridgeConfig(loadedConfig, undefined, {
        requireArtifacts: false
      });
      const resolvedConfig = getResolvedBridgeConfig(loadedConfig, validation);

      if (!resolvedConfig) {
        vscode.window.showErrorMessage('无法选择配置：dllbridge.json 校验失败。');
        return;
      }

      const configurationNames = getConfigurationNames(resolvedConfig.config);
      if (configurationNames.length === 0) {
        vscode.window.showErrorMessage('无法选择配置：所有 projects 必须至少共享一个配置名，例如 Debug 或 Release。');
        return;
      }

      const activeConfiguration = getActiveConfiguration(context, resolvedConfig.config);
      const selected = await vscode.window.showQuickPick(
        configurationNames.map((configuration) => ({
          label: configuration,
          description: configuration === activeConfiguration ? '当前配置' : undefined
        })),
        { placeHolder: '选择 Unity DLL Bridge 配置' }
      );

      if (!selected) {
        return;
      }

      await setActiveConfiguration(context, selected.label);
      onDidChangeConfiguration?.();
      vscode.window.showInformationMessage(`DLL Bridge 当前配置：${selected.label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`选择配置失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}
