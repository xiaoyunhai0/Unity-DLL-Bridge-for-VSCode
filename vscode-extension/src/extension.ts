import * as vscode from 'vscode';
import { registerAddProjectToUnitySolutionCommand } from './commands/addProjectToUnitySolution';
import { registerBuildAllProjectsCommand } from './commands/buildAllProjects';
import { registerBuildAndSyncCommand } from './commands/buildAndSync';
import { registerBuildDllOnlyCommand } from './commands/buildDllOnly';
import { registerBuildProjectCommand } from './commands/buildProject';
import { registerConfigureDotnetPathCommand } from './commands/configureDotnetPath';
import { registerConfigWizardCommand } from './commands/configWizard';
import { registerCreateConfigTemplateCommand } from './commands/createConfigTemplate';
import { registerDiscoverProjectsCommand } from './commands/discoverProjects';
import { registerGenerateDebugConfigCommand } from './commands/generateDebugConfig';
import { registerOpenManifestCommand } from './commands/openManifest';
import { registerOpenConfigurationCommand } from './commands/openConfiguration';
import { registerOpenSyncLogCommand } from './commands/openSyncLog';
import { registerOpenUnitySolutionCommand } from './commands/openUnitySolution';
import { registerRunEnvironmentDiagnosticsCommand } from './commands/runEnvironmentDiagnostics';
import { registerSelectConfigurationCommand } from './commands/selectConfiguration';
import { registerSyncOnlyCommand } from './commands/syncOnly';
import { registerToggleAutoBuildCommand } from './commands/toggleAutoBuild';
import { registerValidateConfigurationCommand } from './commands/validateConfiguration';
import { AutoBuildWatcher } from './watch/autoBuildWatcher';
import { registerActionsView } from './views/actionsView';
import { registerStatusBar } from './views/statusBar';

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection('Unity DLL Bridge');
  const autoBuildWatcher = new AutoBuildWatcher(context);
  context.subscriptions.push(diagnostics, autoBuildWatcher);

  const statusBar = registerStatusBar(context);
  registerActionsView(context);
  registerBuildDllOnlyCommand(context, diagnostics);
  registerBuildProjectCommand(context);
  registerBuildAndSyncCommand(context, diagnostics);
  registerBuildAllProjectsCommand(context, diagnostics);
  registerValidateConfigurationCommand(context);
  registerSyncOnlyCommand(context);
  registerOpenSyncLogCommand(context);
  registerOpenManifestCommand(context);
  registerOpenConfigurationCommand(context);
  registerOpenUnitySolutionCommand(context);
  registerAddProjectToUnitySolutionCommand(context);
  registerConfigureDotnetPathCommand(context, () => statusBar.refresh());
  registerConfigWizardCommand(context, () => statusBar.refresh());
  registerCreateConfigTemplateCommand(context, () => statusBar.refresh());
  registerDiscoverProjectsCommand(context);
  registerRunEnvironmentDiagnosticsCommand(context);
  registerGenerateDebugConfigCommand(context);
  registerToggleAutoBuildCommand(context, autoBuildWatcher);
  registerSelectConfigurationCommand(context, () => statusBar.refresh());
  void autoBuildWatcher.startFromConfig();
}

export function deactivate(): void {}
