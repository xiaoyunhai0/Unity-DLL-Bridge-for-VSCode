import * as vscode from 'vscode';
import { registerBuildAndSyncCommand } from './commands/buildAndSync';
import { registerBuildDllOnlyCommand } from './commands/buildDllOnly';
import { registerCreateConfigTemplateCommand } from './commands/createConfigTemplate';
import { registerOpenManifestCommand } from './commands/openManifest';
import { registerOpenSyncLogCommand } from './commands/openSyncLog';
import { registerSelectConfigurationCommand } from './commands/selectConfiguration';
import { registerSyncOnlyCommand } from './commands/syncOnly';
import { registerValidateConfigurationCommand } from './commands/validateConfiguration';
import { registerStatusBar } from './views/statusBar';

export function activate(context: vscode.ExtensionContext): void {
  const statusBar = registerStatusBar(context);
  registerBuildDllOnlyCommand(context);
  registerBuildAndSyncCommand(context);
  registerValidateConfigurationCommand(context);
  registerSyncOnlyCommand(context);
  registerOpenSyncLogCommand(context);
  registerOpenManifestCommand(context);
  registerCreateConfigTemplateCommand(context);
  registerSelectConfigurationCommand(context, () => statusBar.refresh());
}

export function deactivate(): void {}
