import * as vscode from 'vscode';
import { registerOpenManifestCommand } from './commands/openManifest';
import { registerOpenSyncLogCommand } from './commands/openSyncLog';
import { registerSyncOnlyCommand } from './commands/syncOnly';
import { registerValidateConfigurationCommand } from './commands/validateConfiguration';

export function activate(context: vscode.ExtensionContext): void {
  registerValidateConfigurationCommand(context);
  registerSyncOnlyCommand(context);
  registerOpenSyncLogCommand(context);
  registerOpenManifestCommand(context);
}

export function deactivate(): void {}
