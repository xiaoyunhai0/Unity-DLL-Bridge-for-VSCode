import * as vscode from 'vscode';
import { registerCreateConfigTemplateCommand } from './commands/createConfigTemplate';
import { registerOpenManifestCommand } from './commands/openManifest';
import { registerOpenSyncLogCommand } from './commands/openSyncLog';
import { registerSyncOnlyCommand } from './commands/syncOnly';
import { registerValidateConfigurationCommand } from './commands/validateConfiguration';
import { registerStatusBar } from './views/statusBar';

export function activate(context: vscode.ExtensionContext): void {
  registerValidateConfigurationCommand(context);
  registerSyncOnlyCommand(context);
  registerOpenSyncLogCommand(context);
  registerOpenManifestCommand(context);
  registerCreateConfigTemplateCommand(context);
  registerStatusBar(context);
}

export function deactivate(): void {}
