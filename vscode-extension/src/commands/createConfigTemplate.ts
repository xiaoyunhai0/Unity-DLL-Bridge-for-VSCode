import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { fileExists } from '../utils/pathUtils';

export function registerCreateConfigTemplateCommand(context: vscode.ExtensionContext, onDidCreateConfig?: () => void): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.createConfigTemplate', async () => {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

      if (!workspaceFolder) {
        vscode.window.showErrorMessage('当前没有打开 VSCode 工作区。请先打开要放置 dllbridge.json 的文件夹。');
        return;
      }

      const targetPath = path.join(workspaceFolder.uri.fsPath, 'dllbridge.json');

      if (await fileExists(targetPath)) {
        const selection = await vscode.window.showWarningMessage('工作区已经存在 dllbridge.json，是否覆盖？', '覆盖', '取消');
        if (selection !== '覆盖') {
          return;
        }
      }

      const template = await fs.readFile(context.asAbsolutePath(path.join('resources', 'dllbridge.single.json')), 'utf8');
      await fs.writeFile(targetPath, template, 'utf8');

      const document = await vscode.workspace.openTextDocument(targetPath);
      await vscode.window.showTextDocument(document);
      onDidCreateConfig?.();
      vscode.window.showInformationMessage('已创建 dllbridge.json 模板。若不确定路径该怎么填，可改用 Unity DLL Bridge: 配置向导 自动生成。');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`创建配置模板失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}
