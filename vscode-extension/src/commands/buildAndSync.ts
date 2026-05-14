import * as vscode from 'vscode';
import { runBuild } from '../build/buildRunner';
import { resolveConfigForActiveConfiguration } from '../config/resolveConfig';
import { syncOnly } from '../sync/syncOnly';
import { writeSyncLog } from '../sync/syncLog';
import { formatTimestampForFileName } from '../utils/pathUtils';
import { showValidationReport } from './validationReport';

export function registerBuildAndSyncCommand(context: vscode.ExtensionContext, diagnostics?: vscode.DiagnosticCollection): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.buildAndSync', async () => {
    try {
      const { validation, resolvedConfig } = await resolveConfigForActiveConfiguration(context, {
        requireArtifacts: false
      });

      if (!resolvedConfig) {
        vscode.window.showErrorMessage(`DLL Bridge 构建已取消：配置存在 ${validation.errors.length} 个错误`);
        showValidationReport(validation);
        return;
      }

      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Unity DLL Bridge: 构建并同步',
          cancellable: false
        },
        async () => {
          const buildResult = await runBuild(resolvedConfig, diagnostics);

          if (!buildResult.success) {
            const timestamp = new Date();
            await writeSyncLog(
              resolvedConfig.workspaceRoot,
              [
                `[${timestamp.toISOString().slice(11, 19)}] Build failed`,
                ...buildResult.lines
              ],
              formatTimestampForFileName(timestamp)
            );
            throw new Error(`构建失败，退出码：${buildResult.exitCode ?? 'unknown'}。已解析 ${buildResult.problems.length} 个 Problems，请查看同步日志。`);
          }

          const afterBuild = await resolveConfigForActiveConfiguration(context);
          if (!afterBuild.resolvedConfig) {
            showValidationReport(afterBuild.validation);
            throw new Error('构建完成，但同步前配置校验失败。请查看校验报告。');
          }

          const syncResult = await syncOnly(afterBuild.resolvedConfig, afterBuild.validation.warnings, buildResult.lines);
          return { buildResult, syncResult };
        }
      );

      const buildText = result.buildResult.skipped ? '已跳过构建' : `构建完成 ${result.buildResult.durationMs}ms`;
      const warningSummary = result.syncResult.warnings.length > 0 ? `，${result.syncResult.warnings.length} 个提醒` : '';
      vscode.window.showInformationMessage(`DLL Bridge ${buildText}，同步完成：${resolvedConfig.activeConfiguration}${warningSummary}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`DLL Bridge 构建并同步失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}
