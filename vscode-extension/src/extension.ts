import * as vscode from 'vscode';
import { registerAddProjectToUnitySolutionCommand } from './commands/addProjectToUnitySolution';
import { registerBuildAndSyncCommand } from './commands/buildAndSync';
import { registerBuildDllOnlyCommand } from './commands/buildDllOnly';
import { registerConfigureDotnetPathCommand } from './commands/configureDotnetPath';
import { registerConfigWizardCommand } from './commands/configWizard';
import { registerCreateConfigTemplateCommand } from './commands/createConfigTemplate';
import { registerOpenManifestCommand } from './commands/openManifest';
import { registerOpenConfigurationCommand } from './commands/openConfiguration';
import { registerOpenSyncLogCommand } from './commands/openSyncLog';
import { registerSelectConfigurationCommand } from './commands/selectConfiguration';
import { registerSyncOnlyCommand } from './commands/syncOnly';
import { registerValidateConfigurationCommand } from './commands/validateConfiguration';
import { registerActionsView } from './views/actionsView';
import { registerStatusBar } from './views/statusBar';

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = registerStatusBar(context);
  registerActionsView(context);
  registerBuildDllOnlyCommand(context);
  registerBuildAndSyncCommand(context);
  registerValidateConfigurationCommand(context);
  registerSyncOnlyCommand(context);
  registerOpenSyncLogCommand(context);
  registerOpenManifestCommand(context);
  registerOpenConfigurationCommand(context);
  registerAddProjectToUnitySolutionCommand(context);
  registerConfigureDotnetPathCommand(context, () => statusBar.refresh());
  registerConfigWizardCommand(context, () => statusBar.refresh());
  registerCreateConfigTemplateCommand(context, () => statusBar.refresh());
  registerSelectConfigurationCommand(context, () => statusBar.refresh());
}

export function deactivate(): void {}
