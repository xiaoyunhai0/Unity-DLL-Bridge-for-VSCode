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
  const [firstProject, ...remainingProjects] = config.projects;

  if (!firstProject) {
    return [];
  }

  const sharedNames = new Set(Object.keys(firstProject.configurations));

  for (const project of remainingProjects) {
    for (const name of [...sharedNames]) {
      if (!Object.prototype.hasOwnProperty.call(project.configurations, name)) {
        sharedNames.delete(name);
      }
    }
  }

  return [...sharedNames].sort((left, right) => left.localeCompare(right));
}

function hasConfiguration(config: BridgeConfig, configuration: string): boolean {
  return config.projects.every((project) => Object.prototype.hasOwnProperty.call(project.configurations, configuration));
}
