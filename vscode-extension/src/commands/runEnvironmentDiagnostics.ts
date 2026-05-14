import * as vscode from 'vscode';
import { resolveConfigForActiveConfiguration } from '../config/resolveConfig';
import { createDiagnosticReport, writeDiagnosticReport } from '../diagnostics/environmentDiagnostics';

export function registerRunEnvironmentDiagnosticsCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.runEnvironmentDiagnostics', async () => {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('当前没有打开 VSCode 工作区。');
        return;
      }

      const report = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Unity DLL Bridge: 正在诊断环境',
          cancellable: false
        },
        () => createDiagnosticReport(workspaceFolder.uri.fsPath, () => resolveConfigForActiveConfiguration(context, { requireArtifacts: false }))
      );

      const reportPath = await writeDiagnosticReport(workspaceFolder.uri.fsPath, report.markdown);
      const document = await vscode.workspace.openTextDocument(reportPath);
      await vscode.window.showTextDocument(document);

      if (report.errors.length > 0) {
        vscode.window.showErrorMessage(`环境诊断完成：${report.errors.length} 个错误，${report.warnings.length} 个提醒。`);
        return;
      }

      if (report.warnings.length > 0) {
        vscode.window.showWarningMessage(`环境诊断完成：${report.warnings.length} 个提醒。`);
        return;
      }

      vscode.window.showInformationMessage('环境诊断完成：没有发现阻塞问题。');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`环境诊断失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}
