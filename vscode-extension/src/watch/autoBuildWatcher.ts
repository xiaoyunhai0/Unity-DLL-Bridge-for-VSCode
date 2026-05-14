import * as path from 'path';
import * as vscode from 'vscode';
import { loadBridgeConfig } from '../config/loadConfig';
import { BridgeConfig } from '../config/types';
import { resolveConfigPath } from '../utils/pathUtils';

export class AutoBuildWatcher implements vscode.Disposable {
  private watcher?: vscode.FileSystemWatcher;
  private timer?: NodeJS.Timeout;
  private enabled = false;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async startFromConfig(): Promise<void> {
    try {
      const loaded = await loadBridgeConfig();
      const config = loaded.config as BridgeConfig;
      if (config.watch?.enabled !== true) {
        return;
      }

      await this.start(config, loaded.configDir);
    } catch {
      // Missing config is normal for a fresh workspace.
    }
  }

  async toggle(): Promise<boolean> {
    if (this.enabled) {
      this.stop();
      return false;
    }

    const loaded = await loadBridgeConfig();
    await this.start(loaded.config as BridgeConfig, loaded.configDir);
    return true;
  }

  async start(config: BridgeConfig, configDir: string): Promise<void> {
    this.stop();

    const sourceProjects = config.projects
      .map((project) => project.sourceProject)
      .filter((value): value is string => Boolean(value))
      .map((sourceProject) => path.dirname(resolveConfigPath(configDir, sourceProject)));

    if (sourceProjects.length === 0) {
      throw new Error('没有配置 sourceProject，无法监听外部 C# 工程。');
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? configDir;
    const pattern = new vscode.RelativePattern(workspaceRoot, '**/*.cs');
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const debounceMs = Math.max((config.watch?.debounceSeconds ?? 2) * 1000, 500);

    const onChange = (uri: vscode.Uri) => {
      if (!sourceProjects.some((sourceRoot) => isInsideOrEqual(sourceRoot, uri.fsPath))) {
        return;
      }

      if (this.timer) {
        clearTimeout(this.timer);
      }

      this.timer = setTimeout(() => {
        void vscode.commands.executeCommand('unityDllBridge.buildAndSync');
      }, debounceMs);
    };

    this.watcher.onDidChange(onChange);
    this.watcher.onDidCreate(onChange);
    this.watcher.onDidDelete(onChange);
    this.enabled = true;
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    this.watcher?.dispose();
    this.watcher = undefined;
    this.enabled = false;
  }

  dispose(): void {
    this.stop();
  }
}

function isInsideOrEqual(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
