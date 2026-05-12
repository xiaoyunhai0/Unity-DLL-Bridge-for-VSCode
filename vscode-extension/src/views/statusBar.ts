import * as vscode from 'vscode';

export function registerStatusBar(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.text = 'DLL Bridge';
  item.tooltip = 'Unity DLL Bridge';
  item.command = 'unityDllBridge.showActions';
  item.show();

  const disposable = vscode.commands.registerCommand('unityDllBridge.showActions', async () => {
    const selected = await vscode.window.showQuickPick(
      [
        {
          label: 'Validate Configuration',
          description: '检查 dllbridge.json 和路径配置',
          command: 'unityDllBridge.validateConfiguration'
        },
        {
          label: 'Sync Only',
          description: '复制已有 DLL/PDB/XML 到 Unity 工程',
          command: 'unityDllBridge.syncOnly'
        },
        {
          label: 'Open Sync Log',
          description: '打开 .dllbridge/logs/latest.log',
          command: 'unityDllBridge.openSyncLog'
        },
        {
          label: 'Open Manifest',
          description: '打开 Unity 目标目录中的 manifest.json',
          command: 'unityDllBridge.openManifest'
        },
        {
          label: 'Create Config Template',
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
}
