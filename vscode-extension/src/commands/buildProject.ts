import * as vscode from 'vscode';

export function registerBuildProjectCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.buildProject', async (projectId?: string) => {
    await vscode.commands.executeCommand('unityDllBridge.buildDllOnly', projectId);
  });

  context.subscriptions.push(disposable);
}
