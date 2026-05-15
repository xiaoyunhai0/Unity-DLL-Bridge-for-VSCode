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
          label: '添加现有工程',
          description: '选择 Unity .sln 和外部 gamelib.csproj，自动写入配置',
          command: 'unityDllBridge.addProjectToUnitySolution'
        },
        {
          label: '生成 DLL',
          description: '调用 dotnet/msbuild/custom 构建外部 C# 工程',
          command: 'unityDllBridge.buildDllOnly'
        },
        {
          label: '构建并同步',
          description: '先构建外部 C# 工程，再同步 DLL',
          command: 'unityDllBridge.buildAndSync'
        },
        {
          label: '打开 Unity 解决方案',
          description: '打开 Unity 生成的 .sln',
          command: 'unityDllBridge.openUnitySolution'
        },
        {
          label: '选择配置',
          description: '选择 Debug / Release 等配置',
          command: 'unityDllBridge.selectConfiguration'
        },
        {
          label: '一键诊断环境',
          description: '检查 Unity、.sln、.csproj、dotnet、MSBuild 和 DLL/PDB',
          command: 'unityDllBridge.runEnvironmentDiagnostics'
        },
        {
          label: '配置 dotnet 路径',
          description: '自动检测失败时，选择 dotnet 安装目录或可执行文件',
          command: 'unityDllBridge.configureDotnetPath'
        },
        {
          label: '开关自动构建同步',
          description: '监听外部 C# 源码变化后自动构建并同步',
          command: 'unityDllBridge.toggleAutoBuild'
        },
        {
          label: '生成 Unity 调试配置',
          description: '生成 .vscode/launch.json 的 Unity Editor 附加调试入口',
          command: 'unityDllBridge.generateDebugConfig'
        },
        {
          label: '校验配置',
          description: '检查 dllbridge.json 和路径配置',
          command: 'unityDllBridge.validateConfiguration'
        },
        {
          label: '配置向导',
          description: '非解决方案流程时，选择 Unity 工程、C# 项目或 DLL 输出目录',
          command: 'unityDllBridge.configWizard'
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
    item.text = resolvedConfig.config.watch?.enabled === true ? `DLL Bridge: ${activeConfiguration} $(sync~spin)` : `DLL Bridge: ${activeConfiguration}`;
  } catch {
    item.text = 'DLL Bridge';
  }
}
