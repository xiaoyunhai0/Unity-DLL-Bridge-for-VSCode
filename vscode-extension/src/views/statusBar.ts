import * as vscode from 'vscode';
import { getActiveConfiguration } from '../config/activeConfiguration';
import { loadBridgeConfig } from '../config/loadConfig';
import { getResolvedBridgeConfig, validateBridgeConfig } from '../validation/validateConfig';

export interface StatusBarController {
  refresh(): void;
}

export function registerStatusBar(context: vscode.ExtensionContext): StatusBarController {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.text = 'DLL Bridge';
  item.tooltip = 'Unity DLL Bridge';
  item.command = 'unityDllBridge.showActions';
  item.show();
  refreshStatusBar(context, item);

  const disposable = vscode.commands.registerCommand('unityDllBridge.showActions', async () => {
    const selected = await vscode.window.showQuickPick(
      [
        {
          label: '配置向导',
          description: '选择 Unity 工程、C# 项目或 DLL 输出目录，自动生成 dllbridge.json',
          command: 'unityDllBridge.configWizard'
        },
        {
          label: '选择配置',
          description: '选择 Debug / Release 等配置',
          command: 'unityDllBridge.selectConfiguration'
        },
        {
          label: '构建并同步',
          description: '先构建外部 C# 工程，再同步 DLL',
          command: 'unityDllBridge.buildAndSync'
        },
        {
          label: '添加工程到 Unity 解决方案',
          description: '把外部 .csproj 加入 Unity 生成的 .sln',
          command: 'unityDllBridge.addProjectToUnitySolution'
        },
        {
          label: '仅构建 DLL',
          description: '只执行 dotnet/msbuild/custom 构建，不同步到 Unity',
          command: 'unityDllBridge.buildDllOnly'
        },
        {
          label: '校验配置',
          description: '检查 dllbridge.json 和路径配置',
          command: 'unityDllBridge.validateConfiguration'
        },
        {
          label: '仅同步 DLL',
          description: '复制已有 DLL/PDB/XML 到 Unity 工程',
          command: 'unityDllBridge.syncOnly'
        },
        {
          label: '打开同步日志',
          description: '打开 .dllbridge/logs/latest.log',
          command: 'unityDllBridge.openSyncLog'
        },
        {
          label: '打开 Manifest',
          description: '打开 Unity 目标目录中的 manifest.json',
          command: 'unityDllBridge.openManifest'
        },
        {
          label: '创建配置模板',
          description: '在工作区生成 dllbridge.json 模板',
          command: 'unityDllBridge.createConfigTemplate'
        }
      ],
      { placeHolder: 'Unity DLL Bridge' }
    );

    if (selected) {
      await vscode.commands.executeCommand(selected.command);
    }
  });

  context.subscriptions.push(item, disposable);

  return {
    refresh: () => refreshStatusBar(context, item)
  };
}

async function refreshStatusBar(context: vscode.ExtensionContext, item: vscode.StatusBarItem): Promise<void> {
  try {
    const loadedConfig = await loadBridgeConfig();
    const validation = await validateBridgeConfig(loadedConfig, undefined, {
      requireArtifacts: false
    });
    const resolvedConfig = getResolvedBridgeConfig(loadedConfig, validation);
    if (!resolvedConfig) {
      item.text = 'DLL Bridge';
      return;
    }
    const activeConfiguration = getActiveConfiguration(context, resolvedConfig.config);
    item.text = `DLL Bridge: ${activeConfiguration}`;
  } catch {
    item.text = 'DLL Bridge';
  }
}
