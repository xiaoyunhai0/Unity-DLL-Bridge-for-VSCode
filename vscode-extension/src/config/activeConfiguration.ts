import * as vscode from 'vscode';
import { BridgeConfig } from './types';

const STATE_KEY = 'unityDllBridge.activeConfiguration';

export function getActiveConfiguration(context: vscode.ExtensionContext, config: BridgeConfig): string {
  const stored = context.workspaceState.get<string>(STATE_KEY);

  if (stored && hasConfiguration(config, stored)) {
    return stored;
  }

  return config.defaultConfiguration;
}

export async function setActiveConfiguration(context: vscode.ExtensionContext, configuration: string): Promise<void> {
  await context.workspaceState.update(STATE_KEY, configuration);
}

export function getConfigurationNames(config: BridgeConfig): string[] {
  const names = new Set<string>();

  for (const project of config.projects) {
    for (const name of Object.keys(project.configurations)) {
      names.add(name);
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

function hasConfiguration(config: BridgeConfig, configuration: string): boolean {
  return config.projects.some((project) => Object.prototype.hasOwnProperty.call(project.configurations, configuration));
}
