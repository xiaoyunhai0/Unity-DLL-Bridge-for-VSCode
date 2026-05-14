import * as vscode from 'vscode';
import { BuildProblem, publishBuildProblems } from '../build/problemMatcher';
import { runBuild } from '../build/buildRunner';
import { resolveConfigForActiveConfiguration } from '../config/resolveConfig';
import { ResolvedBridgeConfig } from '../config/types';
import { syncOnly } from '../sync/syncOnly';
import { showValidationReport } from './validationReport';

export function registerBuildAllProjectsCommand(context: vscode.ExtensionContext, diagnostics?: vscode.DiagnosticCollection): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.buildAllProjects', async () => {
    try {
      const { validation, resolvedConfig } = await resolveConfigForActiveConfiguration(context, {
        requireArtifacts: false
      });

      if (!resolvedConfig) {
        vscode.window.showErrorMessage(`批量构建已取消：配置存在 ${validation.errors.length} 个错误`);
        showValidationReport(validation);
        return;
      }

      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Unity DLL Bridge: 批量构建并同步',
          cancellable: false
        },
        async () => {
          const buildResult = await runBatchBuilds(resolvedConfig, diagnostics);
          if (!buildResult.success) {
            throw new Error(`构建失败，退出码：${buildResult.exitCode ?? 'unknown'}。已解析 ${buildResult.problems.length} 个 Problems。`);
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

      const warningSummary = result.syncResult.warnings.length > 0 ? `，${result.syncResult.warnings.length} 个提醒` : '';
      vscode.window.showInformationMessage(`批量构建并同步完成：${resolvedConfig.config.projects.length} 个项目${warningSummary}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`批量构建并同步失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}

async function runBatchBuilds(
  resolvedConfig: ResolvedBridgeConfig,
  diagnostics?: vscode.DiagnosticCollection
): Promise<{ success: boolean; exitCode?: number | null; lines: string[]; problems: BuildProblem[] }> {
  const build = resolvedConfig.config.build;
  const shouldBuildOnce = !build || build.mode === 'syncOnly' || Boolean(build.solutionPath || build.projectPath) || build.mode === 'custom';

  if (shouldBuildOnce) {
    return runBuild(resolvedConfig, diagnostics);
  }

  const sourceProjects = resolvedConfig.config.projects
    .map((project) => project.sourceProject)
    .filter((value): value is string => Boolean(value));

  if (sourceProjects.length === 0) {
    return runBuild(resolvedConfig, diagnostics);
  }

  const lines: string[] = [];
  const problems: BuildProblem[] = [];
  let exitCode: number | null | undefined = 0;

  for (const sourceProject of sourceProjects) {
    const projectConfig: ResolvedBridgeConfig = {
      ...resolvedConfig,
      config: {
        ...resolvedConfig.config,
        build: {
          ...build,
          projectPath: sourceProject
        }
      }
    };
    const result = await runBuild(projectConfig);
    lines.push(...result.lines);
    problems.push(...result.problems);

    if (!result.success) {
      exitCode = result.exitCode;
      break;
    }
  }

  if (diagnostics) {
    publishBuildProblems(diagnostics, problems);
  }

  return {
    success: problems.every((problem) => problem.severity !== vscode.DiagnosticSeverity.Error) && exitCode === 0,
    exitCode,
    lines,
    problems
  };
}
