import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { getActiveConfiguration } from '../config/activeConfiguration';
import { loadBridgeConfig } from '../config/loadConfig';
import { BridgeConfig, ResolvedBridgeConfig, ValidationResult } from '../config/types';
import { parseSolutionProjects } from '../solution/solutionParser';
import { getResolvedBridgeConfig, validateBridgeConfig } from '../validation/validateConfig';
import { resolveConfigPath } from '../utils/pathUtils';

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
    id: string;
    name: string;
    assemblyName: string;
    sourceProject?: string;
    targetPluginPath: string;
    outputDll?: string;
    outputExists?: boolean;
    inSolution?: boolean;
  }>;
  solution?: {
    path: string;
    displayPath: string;
    projectCount: number;
  };
  solutionProjects: Array<{
    name: string;
    path: string;
    configured: boolean;
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

    webviewView.webview.onDidReceiveMessage(async (message: { command?: string; projectId?: string }) => {
      if (!message.command) {
        return;
      }

      if (message.command === 'unityDllBridge.refreshActionsView') {
        await this.refresh();
        return;
      }

      await vscode.commands.executeCommand(message.command, message.projectId);
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
      title: '选择 Unity 解决方案',
      subtitle: '先打开外部 C# 工程目录，再把 gamelib.csproj 添加到 Unity 解决方案',
      workspaceName: 'No workspace',
      projectCount: 0,
      projects: [],
      solutionProjects: [],
      errors: [],
      warnings: []
    };
  }

  const configPath = await findConfigPath(workspaceFolder.uri.fsPath);
  if (!configPath) {
    return {
      status: 'missing',
      title: '还原 VS 生成流程',
      subtitle: '选择 Unity 的 .sln，再添加现有 gamelib.csproj，之后直接点击生成',
      workspaceName: workspaceFolder.name,
      projectCount: 0,
      projects: [],
      solutionProjects: [],
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
      solutionProjects: [],
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
      solutionProjects: [],
      errors: validation?.errors ?? [],
      warnings: validation?.warnings ?? []
    };
  }

  const solution = await getSolutionSummary(resolvedConfig);
  const solutionProjects = await getSolutionProjects(resolvedConfig, solution?.path);
  const projects = await getProjectSummaries(resolvedConfig.config, resolvedConfig.configDir, resolvedConfig.activeConfiguration, solutionProjects);

  return {
    status: validation.warnings.length > 0 ? 'warning' : 'ready',
    title: validation.warnings.length > 0 ? '可生成，有提醒' : '可以生成 DLL',
    subtitle: solution ? `${path.basename(solution.path)} · ${resolvedConfig.activeConfiguration}` : `${resolvedConfig.activeConfiguration} · 等待选择 Unity .sln`,
    workspaceName: workspaceFolder.name,
    configPath,
    activeConfiguration: resolvedConfig.activeConfiguration,
    watchEnabled: resolvedConfig.config.watch?.enabled === true,
    projectCount: resolvedConfig.config.projects.length,
    projects,
    solution,
    solutionProjects,
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

async function getSolutionSummary(resolvedConfig: ResolvedBridgeConfig): Promise<DashboardState['solution']> {
  const solutionPath = resolvedConfig.config.build?.solutionPath
    ? resolveConfigPath(resolvedConfig.configDir, resolvedConfig.config.build.solutionPath)
    : await findUnitySolution(resolvedConfig);

  if (!solutionPath) {
    return undefined;
  }

  return {
    path: solutionPath,
    displayPath: shortenPath(solutionPath),
    projectCount: (await getSolutionProjects(resolvedConfig, solutionPath)).length
  };
}

async function findUnitySolution(resolvedConfig: ResolvedBridgeConfig): Promise<string | undefined> {
  const unityProject = resolveConfigPath(resolvedConfig.configDir, resolvedConfig.config.unityProject);
  try {
    const entries = await fs.readdir(unityProject, { withFileTypes: true });
    const solution = entries.find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sln'));
    return solution ? path.join(unityProject, solution.name) : undefined;
  } catch {
    return undefined;
  }
}

async function getSolutionProjects(resolvedConfig: ResolvedBridgeConfig, solutionPath: string | undefined): Promise<DashboardState['solutionProjects']> {
  if (!solutionPath) {
    return [];
  }

  try {
    const configuredPaths = new Set(
      resolvedConfig.config.projects
        .map((project) => project.sourceProject)
        .filter((value): value is string => Boolean(value))
        .map((sourceProject) => normalizePath(resolveConfigPath(resolvedConfig.configDir, sourceProject)))
    );

    return (await parseSolutionProjects(solutionPath)).map((project) => ({
      name: project.name,
      path: project.absolutePath,
      configured: configuredPaths.has(normalizePath(project.absolutePath))
    }));
  } catch {
    return [];
  }
}

async function getProjectSummaries(
  config: BridgeConfig,
  configDir: string,
  activeConfiguration: string,
  solutionProjects: DashboardState['solutionProjects']
): Promise<DashboardState['projects']> {
  const solutionProjectPaths = new Set(solutionProjects.map((project) => normalizePath(project.path)));
  return Promise.all(config.projects.map(async (project) => {
    const configuration = project.configurations[activeConfiguration];
    const outputDll = configuration ? path.join(resolveConfigPath(configDir, configuration.outputDir), `${project.assemblyName}.dll`) : undefined;
    const sourceProjectPath = project.sourceProject ? resolveConfigPath(configDir, project.sourceProject) : undefined;

    return {
      id: project.id,
      name: project.name,
      assemblyName: project.assemblyName,
      sourceProject: project.sourceProject,
      targetPluginPath: project.targetPluginPath,
      outputDll,
      outputExists: outputDll ? await fileExists(outputDll) : false,
      inSolution: sourceProjectPath ? solutionProjectPaths.has(normalizePath(sourceProjectPath)) : false
    };
  }));
}

function renderDashboard(webview: vscode.Webview, state: DashboardState): string {
  const nonce = getNonce();
  const statusClass = `status-${state.status}`;
  const configPath = state.configPath ? shortenPath(state.configPath) : '未创建';
  const primaryActions = getPrimaryActions(state);
  const buildActions: DashboardAction[] = [
    { label: '添加现有工程', command: 'unityDllBridge.addProjectToUnitySolution', variant: 'primary' },
    { label: '生成 DLL', command: 'unityDllBridge.buildDllOnly', variant: 'primary' },
    { label: '生成并同步到 Unity', command: 'unityDllBridge.buildAndSync' },
    { label: '打开 Unity 解决方案', command: 'unityDllBridge.openUnitySolution' }
  ];
  const inspectActions: DashboardAction[] = [
    { label: '诊断环境', command: 'unityDllBridge.runEnvironmentDiagnostics' },
    { label: '配置 dotnet 路径', command: 'unityDllBridge.configureDotnetPath' },
    { label: '选择配置', command: 'unityDllBridge.selectConfiguration' },
    { label: '开关自动构建', command: 'unityDllBridge.toggleAutoBuild' },
    { label: '打开日志', command: 'unityDllBridge.openSyncLog' }
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
      grid-template-columns: 68px 1fr;
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

    .project.configured {
      border-left: 3px solid var(--vscode-testing-iconPassed);
    }

    .project-title {
      font-weight: 600;
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }

    .project-line {
      color: var(--vscode-descriptionForeground);
      overflow-wrap: anywhere;
      line-height: 1.35;
    }

    .badge {
      flex: 0 0 auto;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      font-weight: 400;
    }

    .project-actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 5px;
      margin-top: 8px;
    }

    .muted {
      color: var(--vscode-descriptionForeground);
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
          <div class="meta-label">解决方案</div>
          <div class="meta-value">${escapeHtml(state.solution?.displayPath ?? '未选择')}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">配置</div>
          <div class="meta-value">${escapeHtml(state.activeConfiguration ?? '-')}</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">工程</div>
          <div class="meta-value">${state.projectCount}${state.solution ? ` / sln ${state.solution.projectCount}` : ''}</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2>VS 流程</h2>
      <div class="actions">${renderActions(buildActions)}</div>
    </section>

    ${renderProblems(state)}

    <section class="section">
      <h2>解决方案中的工程</h2>
      ${renderSolutionProjects(state.solutionProjects)}
    </section>

    <section class="section">
      <h2>已配置工程</h2>
      ${renderProjects(state.projects)}
    </section>

    <section class="section">
      <h2>配置与工具</h2>
      <div class="actions">${renderActions(primaryActions)}${renderActions(inspectActions)}</div>
    </section>
  </main>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-command]');
      if (!button) {
        return;
      }
      vscode.postMessage({ command: button.dataset.command, projectId: button.dataset.project });
    });
  </script>
</body>
</html>`;
}

function getPrimaryActions(state: DashboardState): DashboardAction[] {
  if (state.status === 'missing') {
    return [
      { label: '选择 .sln 并添加 .csproj', command: 'unityDllBridge.addProjectToUnitySolution', variant: 'primary' },
      { label: '配置向导', command: 'unityDllBridge.configWizard' },
      { label: '刷新面板', command: 'unityDllBridge.refreshActionsView' }
    ];
  }

  return [
    { label: '编辑配置', command: 'unityDllBridge.openConfiguration', variant: state.status === 'error' ? 'danger' : undefined },
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
    return '<div class="empty">还没有配置外部工程。点击“添加现有工程”，选择 gamelib.csproj。</div>';
  }

  return `<div class="list">${projects
    .map(
      (project) => `<div class="project configured">
        <div class="project-title">
          <span>${escapeHtml(project.name)}</span>
          <span class="badge">${project.outputExists ? '已生成' : '待生成'}</span>
        </div>
        <div class="project-line">${escapeHtml(project.assemblyName)}.dll</div>
        <div class="project-line">${escapeHtml(project.inSolution ? '已加入解决方案' : '未在当前 .sln 中')}</div>
        <div class="project-line">${escapeHtml(project.outputDll ? shortenPath(project.outputDll) : '未配置输出目录')}</div>
        <div class="project-line">同步到 ${escapeHtml(shortenPath(project.targetPluginPath))}</div>
        <div class="project-actions">
          <button class="primary" type="button" data-command="unityDllBridge.buildProject" data-project="${escapeAttribute(project.id)}">生成 ${escapeHtml(project.assemblyName)}.dll</button>
        </div>
      </div>`
    )
    .join('')}</div>`;
}

function renderSolutionProjects(projects: DashboardState['solutionProjects']): string {
  if (projects.length === 0) {
    return '<div class="empty">当前还没有读取到 .sln 中的 C# 工程。先点击“添加现有工程”。</div>';
  }

  return `<div class="list">${projects
    .map(
      (project) => `<div class="project${project.configured ? ' configured' : ''}">
        <div class="project-title">
          <span>${escapeHtml(project.name)}</span>
          <span class="badge">${project.configured ? '已配置' : '未配置'}</span>
        </div>
        <div class="project-line">${escapeHtml(shortenPath(project.path))}</div>
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

function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/').toLowerCase();
}

function getNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';

  for (let index = 0; index < 32; index += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}
