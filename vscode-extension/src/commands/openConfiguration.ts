import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

const CONFIG_CANDIDATES = [
  'dllbridge.json',
  path.join('.dllbridge', 'dllbridge.json')
];

export function registerOpenConfigurationCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.openConfiguration', async () => {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

      if (!workspaceFolder) {
        vscode.window.showErrorMessage('当前没有打开 VSCode 工作区。');
        return;
      }

      const configPath = await findConfigPath(workspaceFolder.uri.fsPath);

      if (!configPath) {
        const selection = await vscode.window.showWarningMessage('没有找到 dllbridge.json，是否创建配置模板？', '创建', '取消');
        if (selection === '创建') {
          await vscode.commands.executeCommand('unityDllBridge.createConfigTemplate');
        }
        return;
      }

      const document = await vscode.workspace.openTextDocument(configPath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`打开配置失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}

async function findConfigPath(workspaceRoot: string): Promise<string | undefined> {
  for (const candidate of CONFIG_CANDIDATES) {
    const configPath = path.join(workspaceRoot, candidate);

    if (await fileExists(configPath)) {
      return configPath;
    }
  }

  return undefined;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}
