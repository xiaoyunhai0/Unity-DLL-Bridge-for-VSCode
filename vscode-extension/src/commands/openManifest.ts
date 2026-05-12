import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveConfigForActiveConfiguration } from '../config/resolveConfig';
import { BridgeProject } from '../config/types';
import { resolveConfigPath } from '../utils/pathUtils';

export function registerOpenManifestCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.openManifest', async () => {
    try {
      const { resolvedConfig } = await resolveConfigForActiveConfiguration(context, {
        requireArtifacts: false
      });

      if (!resolvedConfig) {
        vscode.window.showErrorMessage('无法打开 manifest：配置校验失败。');
        return;
      }

      const project = await selectProject(resolvedConfig.config.projects);
      if (!project) {
        return;
      }

      const manifestPath = path.join(resolveConfigPath(resolvedConfig.configDir, project.targetPluginPath), 'manifest.json');
      await fs.access(manifestPath);
      const document = await vscode.workspace.openTextDocument(manifestPath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showWarningMessage(`无法打开 manifest：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}

async function selectProject(projects: BridgeProject[]): Promise<BridgeProject | undefined> {
  if (projects.length === 1) {
    return projects[0];
  }

  const selected = await vscode.window.showQuickPick(
    projects.map((project) => ({
      label: project.name,
      description: project.id,
      project
    })),
    { placeHolder: '选择要打开 manifest 的项目' }
  );

  return selected?.project;
}
