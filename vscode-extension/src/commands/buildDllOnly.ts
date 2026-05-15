import * as vscode from 'vscode';
import { runBuild } from '../build/buildRunner';
import { resolveConfigForActiveConfiguration } from '../config/resolveConfig';
import { ResolvedBridgeConfig } from '../config/types';
import { writeSyncLog } from '../sync/syncLog';
import { formatTimestampForFileName } from '../utils/pathUtils';
import { showValidationReport } from './validationReport';

export function registerBuildDllOnlyCommand(context: vscode.ExtensionContext, diagnostics?: vscode.DiagnosticCollection): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.buildDllOnly', async (projectId?: string) => {
    try {
      const { validation, resolvedConfig } = await resolveConfigForActiveConfiguration(context, {
        requireArtifacts: false
      });

      if (!resolvedConfig) {
        vscode.window.showErrorMessage(`DLL Bridge 构建已取消：配置存在 ${validation.errors.length} 个错误`);
        showValidationReport(validation);
        return;
      }

      const buildConfig = createProjectBuildConfig(resolvedConfig, projectId);
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Unity DLL Bridge: 生成 DLL${projectId ? ` (${projectId})` : ''}`,
          cancellable: false
        },
        async () => {
          const buildResult = await runBuild(buildConfig, diagnostics);
          const timestamp = new Date();
          const logPath = await writeSyncLog(
            resolvedConfig.workspaceRoot,
            [
              `[${timestamp.toISOString().slice(11, 19)}] Build DLL Only`,
              ...buildResult.lines
            ],
            formatTimestampForFileName(timestamp)
          );

          return { buildResult, logPath };
        }
      );

      if (!result.buildResult.success) {
        throw new Error(`构建失败，退出码：${result.buildResult.exitCode ?? 'unknown'}。已解析 ${result.buildResult.problems.length} 个 Problems，请查看同步日志。`);
      }

      if (result.buildResult.skipped) {
        vscode.window.showWarningMessage('DLL Bridge 未执行构建：build.mode 当前为 syncOnly。请配置 dotnet、msbuild 或 custom。');
        return;
      }

      const afterBuild = await resolveConfigForActiveConfiguration(context);
      if (!afterBuild.resolvedConfig) {
        showValidationReport(afterBuild.validation);
        throw new Error('构建命令已执行，但没有在配置的 outputDir 中找到 DLL。请检查 outputDir、assemblyName 或构建输出路径。');
      }

      const warningSummary = afterBuild.validation.warnings.length > 0 ? `，${afterBuild.validation.warnings.length} 个提醒` : '';
      vscode.window.showInformationMessage(`DLL Bridge DLL 构建完成：${resolvedConfig.activeConfiguration}，${result.buildResult.durationMs}ms${warningSummary}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`DLL Bridge 生成 DLL 失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function createProjectBuildConfig(resolvedConfig: ResolvedBridgeConfig, projectId: string | undefined): ResolvedBridgeConfig {
  if (!projectId) {
    return resolvedConfig;
  }

  const project = resolvedConfig.config.projects.find((candidate) => candidate.id === projectId || candidate.assemblyName === projectId || candidate.name === projectId);
  if (!project?.sourceProject) {
    throw new Error(`没有找到可生成的工程：${projectId}`);
  }

  return {
    ...resolvedConfig,
    config: {
      ...resolvedConfig.config,
      build: {
        ...(resolvedConfig.config.build ?? {}),
        projectPath: project.sourceProject
      }
    }
  };
}
