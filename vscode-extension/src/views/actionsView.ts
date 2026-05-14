import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { getActiveConfiguration } from '../config/activeConfiguration';
import { loadBridgeConfig } from '../config/loadConfig';
import { BridgeConfig, ResolvedBridgeConfig, ValidationResult } from '../config/types';
import { getResolvedBridgeConfig, validateBridgeConfig } from '../validation/validateConfig';

const VIEW_TYPE = 'unityDllBridge.actionsView';
const CONFIG_CANDIDATES = [
  'dllbridge.json',
  path.join('.dllbridge', 'dllbridge.json')
];

interface DashboardState {
  status: 'ready' | 'warning' | 'error' | 'missing';
  title: string;
  subtitle: string;
  workspaceName: string;
  configPath?: string;
  activeConfiguration?: string;
  watchEnabled?: boolean;
  projectCount: number;
  projects: Array<{
    name: string;
    assemblyName: string;
    targetPluginPath: string;
  }>;
  errors: string[];
  warnings: string[];
}

interface DashboardAction {
  label: string;
  command: string;
  variant?: 'primary' | 'danger';
}

export function registerActionsView(context: vscode.ExtensionContext): void {
  const provider = new ActionsViewProvider(context);
  const viewRegistration = vscode.window.registerWebviewViewProvider(VIEW_TYPE, provider);
  const refreshCommand = vscode.commands.registerCommand('unityDllBridge.refreshActionsView', () => provider.refresh());
  const saveWatcher = vscode.workspace.onDidSaveTextDocument((document) => {
    if (path.basename(document.uri.fsPath) === 'dllbridge.json') {
      void provider.refresh();
    }
  });
  const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    void provider.refresh();
  });

  context.subscriptions.push(viewRegistration, refreshCommand, saveWatcher, workspaceWatcher);
}

class ActionsViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };

    webviewView.webview.onDidReceiveMessage(async (message: { command?: string }) => {
      if (!message.command) {
        return;
      }

      if (message.command === 'unityDllBridge.refreshActionsView') {
        await this.refresh();
        return;
      }

      await vscode.commands.executeCommand(message.command);
      await this.refresh();
    });

    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }

    const state = await getDashboardState(this.context);
    this.view.webview.html = renderDashboard(this.view.webview, state);
  }
}

async function getDashboardState(context: vscode.ExtensionContext): Promise<DashboardState> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    return {
      status: 'missing',
      title: '未打开工作区',
      subtitle: '请先打开外部 C# 工程目录',
      workspaceName: 'No workspace',
      projectCount: 0,
      projects: [],
      errors: [],
      warnings: []
    };
  }

  const configPath = await findConfigPath(workspaceFolder.uri.fsPath);
  if (!configPath) {
    return {
      status: 'missing',
      title: '尚未创建配置',
      subtitle: '创建 dllbridge.json 后开始配置 Unity DLL 工作流',
      workspaceName: workspaceFolder.name,
      projectCount: 0,
      projects: [],
      errors: [],
      warnings: []
    };
  }

  let resolvedConfig: ResolvedBridgeConfig | undefined;
  let validation: ValidationResult | undefined;

  try {
    const loadedConfig = await loadBridgeConfig();
    const defaultValidation = await validateBridgeConfig(loadedConfig, undefined, {
      requireArtifacts: false
    });
    const defaultResolvedConfig = getResolvedBridgeConfig(loadedConfig, defaultValidation);

    if (!defaultResolvedConfig) {
      validation = defaultValidation;
    } else {
      const activeConfiguration = getActiveConfiguration(context, defaultResolvedConfig.config);
      validation = await validateBridgeConfig(loadedConfig, activeConfiguration, {
        requireArtifacts: false
      });
      resolvedConfig = getResolvedBridgeConfig(loadedConfig, validation, activeConfiguration);
    }
  } catch (error) {
    return {
      status: 'error',
      title: '配置文件无法读取',
      subtitle: formatUnknownError(error),
      workspaceName: workspaceFolder.name,
      configPath,
      projectCount: 0,
      projects: [],
      errors: [formatUnknownError(error)],
      warnings: []
    };
  }

  if (!resolvedConfig || !validation) {
    return {
      status: 'error',
      title: '配置需要修复',
      subtitle: `${validation?.errors.length ?? 0} 个错误阻止工具运行`,
      workspaceName: workspaceFolder.name,
      configPath,
      projectCount: 0,
      projects: [],
      errors: validation?.errors ?? [],
      warnings: validation?.warnings ?? []
    };
  }

  return {
    status: validation.warnings.length > 0 ? 'warning' : 'ready',
    title: validation.warnings.length > 0 ? '配置可用，有提醒' : '配置可用',
    subtitle: `${resolvedConfig.activeConfiguration} · ${resolvedConfig.config.projects.length} 个 DLL 项目`,
    workspaceName: workspaceFolder.name,
    configPath,
    activeConfiguration: resolvedConfig.activeConfiguration,
    watchEnabled: resolvedConfig.config.watch?.enabled === true,
    projectCount: resolvedConfig.config.projects.length,
    projects: getProjectSummaries(resolvedConfig.config),
    errors: validation.errors,
    warnings: validation.warnings
  };
}

async function findConfigPath(workspaceRoot: string): Promise<string | undefined> {
  for (const candidate of CONFIG_CANDIDATES) {
    const configPath = path.join(workspaceRoot, candidate);

    if (await fileExists(configPath)) {
      return configPath;
    }
  }

  return undefined;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function getProjectSummaries(config: BridgeConfig): DashboardState['projects'] {
  return config.projects.map((project) => ({
    name: project.name,
    assemblyName: project.assemblyName,
    targetPluginPath: project.targetPluginPath
  }));
}

function renderDashboard(webview: vscode.Webview, state: DashboardState): string {
  const nonce = getNonce();
  const statusClass = `status-${state.status}`;
  const configPath = state.configPath ? shortenPath(state.configPath) : '未创建';
  const primaryActions = getPrimaryActions(state);
  const buildActions: DashboardAction[] = [
    { label: '添加工程到解决方案', command: 'unityDllBridge.addProjectToUnitySolution' },
    { label: '打开 Unity 解决方案', command: 'unityDllBridge.openUnitySolution' },
    { label: '配置 dotnet 路径', command: 'unityDllBridge.configureDotnetPath' },
    { label: '仅构建 DLL', command: 'unityDllBridge.buildDllOnly', variant: 'primary' },
    { label: '构建并同步', command: 'unityDllBridge.buildAndSync', variant: 'primary' },
    { label: '批量构建并同步', command: 'unityDllBridge.buildAllProjects', variant: 'primary' },
    { label: '开关自动构建', command: 'unityDllBridge.toggleAutoBuild' },
    { label: '仅同步', command: 'unityDllBridge.syncOnly' }
  ];
  const inspectActions: DashboardAction[] = [
    { label: '一键诊断环境', command: 'unityDllBridge.runEnvironmentDiagnostics', variant: 'primary' },
    { label: '自动发现项目', command: 'unityDllBridge.discoverProjects' },
    { label: '生成调试配置', command: 'unityDllBridge.generateDebugConfig' },
    { label: '选择配置', command: 'unityDllBridge.selectConfiguration' },
    { label: '打开日志', command: 'unityDllBridge.openSyncLog' },
    { label: '打开 Manifest', command: 'unityDllBridge.openManifest' }
  ];

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DLL Bridge</title>
  <style>
    :root {
      color-scheme: light dark;
    }

    body {
      margin: 0;
      padding: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    .shell {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
      box-sizing: border-box;
    }

    .hero {
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-left: 3px solid var(--status-color);
      padding: 10px 10px 10px 12px;
      background: var(--vscode-editorWidget-background);
    }

    .status-ready { --status-color: var(--vscode-testing-iconPassed); }
    .status-warning { --status-color: var(--vscode-testing-iconQueued); }
    .status-error { --status-color: var(--vscode-testing-iconFailed); }
    .status-missing { --status-color: var(--vscode-charts-blue); }

    .eyebrow {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-transform: uppercase;
    }

    h1, h2 {
      margin: 0;
      font-weight: 600;
    }

    h1 {
      font-size: 16px;
    }

    h2 {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
    }

    .subtitle {
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
      word-break: break-word;
    }

    .meta {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
    }

    .meta-row {
      display: grid;
      grid-template-columns: 78px 1fr;
      gap: 8px;
      min-width: 0;
    }

    .meta-label {
      color: var(--vscode-descriptionForeground);
    }

    .meta-value {
      overflow-wrap: anywhere;
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
    }

    button {
      width: 100%;
      min-height: 30px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 3px;
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
      cursor: pointer;
      text-align: left;
      padding: 6px 8px;
      font-family: inherit;
      font-size: inherit;
    }

    button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    button.primary {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }

    button.primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button.danger {
      color: var(--vscode-errorForeground);
      border-color: var(--vscode-inputValidation-errorBorder);
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .notice {
      border: 1px solid var(--vscode-inputValidation-warningBorder);
      background: var(--vscode-inputValidation-warningBackground);
      color: var(--vscode-inputValidation-warningForeground);
      padding: 8px;
      border-radius: 3px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }

    .notice.error {
      border-color: var(--vscode-inputValidation-errorBorder);
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
    }

    .project {
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      padding: 8px;
      border-radius: 3px;
      background: var(--vscode-sideBarSectionHeader-background);
    }

    .project-title {
      font-weight: 600;
      margin-bottom: 4px;
    }

    .project-line {
      color: var(--vscode-descriptionForeground);
      overflow-wrap: anywhere;
      line-height: 1.35;
    }

    .empty {
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero ${statusClass}">
      <div class="eyebrow">${escapeHtml(state.workspaceName)}</div>
      <h1>${escapeHtml(state.title)}</h1>
      <div class="subtitle">${escapeHtml(state.subtitle)}</div>
      <div class="meta">
        <div class="meta-row">
          <div class="meta-label">配置</div>
          <div class="meta-value">${escapeHtml(configPath)}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">当前</div>
          <div class="meta-value">${escapeHtml(state.activeConfiguration ?? '-')}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">项目</div>
          <div class="meta-value">${state.projectCount}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">自动构建</div>
          <div class="meta-value">${state.watchEnabled ? '已开启' : '未开启'}</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2>配置</h2>
      <div class="actions">${renderActions(primaryActions)}</div>
    </section>

    ${renderProblems(state)}

    <section class="section">
      <h2>构建与同步</h2>
      <div class="actions">${renderActions(buildActions)}</div>
    </section>

    <section class="section">
      <h2>查看</h2>
      <div class="actions">${renderActions(inspectActions)}</div>
    </section>

    <section class="section">
      <h2>项目</h2>
      ${renderProjects(state.projects)}
    </section>
  </main>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-command]');
      if (!button) {
        return;
      }
      vscode.postMessage({ command: button.dataset.command });
    });
  </script>
</body>
</html>`;
}

function getPrimaryActions(state: DashboardState): DashboardAction[] {
  if (state.status === 'missing') {
    return [
      { label: '配置向导', command: 'unityDllBridge.configWizard', variant: 'primary' },
      { label: '创建模板', command: 'unityDllBridge.createConfigTemplate' },
      { label: '刷新面板', command: 'unityDllBridge.refreshActionsView' }
    ];
  }

  return [
    { label: '编辑配置', command: 'unityDllBridge.openConfiguration', variant: state.status === 'error' ? 'danger' : 'primary' },
    { label: '重新生成配置', command: 'unityDllBridge.configWizard' },
    { label: '重新校验', command: 'unityDllBridge.validateConfiguration' },
    { label: '刷新面板', command: 'unityDllBridge.refreshActionsView' }
  ];
}

function renderActions(actions: DashboardAction[]): string {
  return actions
    .map((action) => {
      const className = action.variant ? ` class="${action.variant}"` : '';
      return `<button${className} type="button" data-command="${escapeAttribute(action.command)}">${escapeHtml(action.label)}</button>`;
    })
    .join('');
}

function renderProblems(state: DashboardState): string {
  if (state.errors.length === 0 && state.warnings.length === 0) {
    return '';
  }

  const errors = state.errors.map((error) => `<div class="notice error">${escapeHtml(error)}</div>`).join('');
  const warnings = state.warnings.map((warning) => `<div class="notice">${escapeHtml(warning)}</div>`).join('');

  return `<section class="section">
    <h2>问题</h2>
    <div class="list">${errors}${warnings}</div>
  </section>`;
}

function renderProjects(projects: DashboardState['projects']): string {
  if (projects.length === 0) {
    return '<div class="empty">暂无项目配置</div>';
  }

  return `<div class="list">${projects
    .map(
      (project) => `<div class="project">
        <div class="project-title">${escapeHtml(project.name)}</div>
        <div class="project-line">${escapeHtml(project.assemblyName)}.dll</div>
        <div class="project-line">${escapeHtml(project.targetPluginPath)}</div>
      </div>`
    )
    .join('')}</div>`;
}

function shortenPath(value: string): string {
  const normalized = value.split(path.sep).join('/');
  const segments = normalized.split('/');

  if (segments.length <= 4) {
    return normalized;
  }

  return `.../${segments.slice(-3).join('/')}`;
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';

  for (let index = 0; index < 32; index += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}
