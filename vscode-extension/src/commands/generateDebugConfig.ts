import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

export function registerGenerateDebugConfigCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.generateDebugConfig', async () => {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('当前没有打开 VSCode 工作区。');
        return;
      }

      const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
      const launchPath = path.join(vscodeDir, 'launch.json');
      await fs.mkdir(vscodeDir, { recursive: true });

      let launch = await readLaunchJson(launchPath);
      launch.version = launch.version ?? '0.2.0';
      const configurations = Array.isArray(launch.configurations) ? launch.configurations as Array<Record<string, unknown>> : [];

      const attachConfig = {
        name: 'Unity DLL Bridge: Attach to Unity Editor',
        type: 'vstuc',
        request: 'attach'
      };

      if (!configurations.some((configuration) => configuration.name === attachConfig.name)) {
        configurations.push(attachConfig);
      }

      launch.configurations = configurations;
      await fs.writeFile(launchPath, `${JSON.stringify(launch, null, 2)}\n`, 'utf8');
      const document = await vscode.workspace.openTextDocument(launchPath);
      await vscode.window.showTextDocument(document);
      vscode.window.showInformationMessage('已生成 Unity 调试配置。需要安装 Unity 官方 VSCode 调试相关扩展后使用。');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`生成调试配置失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}

async function readLaunchJson(launchPath: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await fs.readFile(launchPath, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}
