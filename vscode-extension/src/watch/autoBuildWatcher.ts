import * as path from 'path';
import * as vscode from 'vscode';
import { loadBridgeConfig } from '../config/loadConfig';
import { BridgeConfig } from '../config/types';
import { resolveConfigPath } from '../utils/pathUtils';

export class AutoBuildWatcher implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];
  private timer?: NodeJS.Timeout;
  private enabled = false;
  private running = false;

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

    const debounceMs = Math.max((config.watch?.debounceSeconds ?? 2) * 1000, 500);

    const onChange = (uri: vscode.Uri) => {
      if (this.timer) {
        clearTimeout(this.timer);
      }

      this.timer = setTimeout(() => {
        void this.runBuildAndSync();
      }, debounceMs);
    };

    for (const sourceRoot of unique(sourceProjects)) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(sourceRoot, '**/*.cs'));
      watcher.onDidChange(onChange);
      watcher.onDidCreate(onChange);
      watcher.onDidDelete(onChange);
      this.watchers.push(watcher);
    }

    this.enabled = true;
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
    this.enabled = false;
  }

  dispose(): void {
    this.stop();
  }

  private async runBuildAndSync(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      await vscode.commands.executeCommand('unityDllBridge.buildAndSync');
    } finally {
      this.running = false;
    }
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => path.resolve(value)))];
}
