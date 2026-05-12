import * as vscode from 'vscode';
import { registerValidateConfigurationCommand } from './commands/validateConfiguration';

export function activate(context: vscode.ExtensionContext): void {
  registerValidateConfigurationCommand(context);
}

export function deactivate(): void {}
