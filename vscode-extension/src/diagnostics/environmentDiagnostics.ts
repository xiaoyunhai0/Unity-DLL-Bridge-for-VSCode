import * as fs from 'fs/promises';
import * as path from 'path';
import { loadBridgeConfig } from '../config/loadConfig';
import { BridgeConfig, ResolvedBridgeConfig } from '../config/types';
import { resolveConfigForActiveConfiguration } from '../config/resolveConfig';
import { discoverWorkspace, DiscoveryResult, readCsprojInfo } from '../discovery/projectDiscovery';
import { tryResolveDotnetCommand } from '../dotnet/dotnetLocator';
import { tryResolveMsbuildCommand } from '../msbuild/msbuildLocator';
import { getRelativePath, isPlainObject, resolveConfigPath } from '../utils/pathUtils';

export interface DiagnosticReport {
  markdown: string;
  errors: string[];
  warnings: string[];
}

interface DiagnosticContext {
  workspaceRoot: string;
  discovery: DiscoveryResult;
  config?: BridgeConfig;
  resolvedConfig?: ResolvedBridgeConfig;
  configDir?: string;
  configPath?: string;
  activeConfiguration?: string;
  validationErrors: string[];
  validationWarnings: string[];
}

export async function createDiagnosticReport(
  workspaceRoot: string,
  resolveActiveConfiguration: () => Promise<Awaited<ReturnType<typeof resolveConfigForActiveConfiguration>>>
): Promise<DiagnosticReport> {
  const discovery = await discoverWorkspace(workspaceRoot);
  const context: DiagnosticContext = {
    workspaceRoot,
    discovery,
    validationErrors: [],
    validationWarnings: []
  };

  try {
    const loaded = await loadBridgeConfig();
    const resolved = await resolveActiveConfiguration();
    if (isPlainObject(loaded.config)) {
      context.config = loaded.config as unknown as BridgeConfig;
    } else {
      context.validationErrors.push('配置根节点必须是 JSON object。');
    }
    context.configDir = loaded.configDir;
    context.configPath = loaded.configPath;
    context.resolvedConfig = resolved.resolvedConfig;
    context.activeConfiguration = resolved.resolvedConfig?.activeConfiguration ?? context.config?.defaultConfiguration;
    context.validationErrors = resolved.validation.errors;
    context.validationWarnings = resolved.validation.warnings;
  } catch (error) {
    context.validationErrors.push(formatUnknownError(error));
  }

  const errors = [...context.validationErrors];
  const warnings = [...context.validationWarnings];
  const toolingLines = await renderTooling(context, errors, warnings);
  const configuredProjectLines = await renderConfiguredProjects(context, errors, warnings);
  const lines = [
    '# Unity DLL Bridge 环境诊断报告',
    '',
    `生成时间：${new Date().toISOString()}`,
    `工作区：${workspaceRoot}`,
    '',
    '## 总览',
    '',
    `- Unity 工程候选：${discovery.unityProjects.length}`,
    `- C# 工程候选：${discovery.csProjects.length}`,
    `- 解决方案候选：${discovery.solutions.length}`,
    `- DLL 输出目录候选：${discovery.dllOutputDirs.length}`,
    `- 当前配置：${context.configPath ? getRelativePath(workspaceRoot, context.configPath) : '未找到 dllbridge.json'}`,
    `- 当前构建配置：${context.activeConfiguration ?? '-'}`,
    '',
    ...toolingLines,
    ...configuredProjectLines,
    ...renderDiscovery(context),
    ...renderSuggestions(errors, warnings)
  ];

  return {
    markdown: `${lines.join('\n')}\n`,
    errors,
    warnings
  };
}

export async function writeDiagnosticReport(workspaceRoot: string, markdown: string): Promise<string> {
  const outputDir = path.join(workspaceRoot, '.dllbridge');
  await fs.mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, 'environment-report.md');
  await fs.writeFile(reportPath, markdown, 'utf8');
  return reportPath;
}

async function renderTooling(context: DiagnosticContext, errors: string[], warnings: string[]): Promise<string[]> {
  const build = context.config?.build;
  const configDir = context.configDir ?? context.workspaceRoot;
  const lines = ['## 工具链', ''];

  lines.push(`- build.mode：${build?.mode ?? 'syncOnly'}`);
  lines.push(...(await renderDotnet(configDir, build?.dotnetPath, build?.mode, errors, warnings)));
  lines.push(...(await renderMsbuild(configDir, build?.msbuildPath, warnings)));
  lines.push('');
  return lines;
}

async function renderConfiguredProjects(context: DiagnosticContext, errors: string[], warnings: string[]): Promise<string[]> {
  const config = context.config;
  const configDir = context.configDir ?? context.workspaceRoot;
  const activeConfiguration = context.activeConfiguration ?? config?.defaultConfiguration;
  const lines = ['## 当前配置项目', ''];

  if (!config || typeof config.unityProject !== 'string' || !Array.isArray(config.projects)) {
    lines.push('- 未读取到有效配置结构。请先执行 `Unity DLL Bridge: 配置向导`，或修复 dllbridge.json。', '');
    return lines;
  }

  const unityProject = resolveConfigPath(configDir, config.unityProject);
  const unityAssets = path.join(unityProject, 'Assets');
  const unitySolutions = context.discovery.solutions.filter((solutionPath) => isInsideOrEqual(unityProject, solutionPath));
  lines.push(`- Unity 工程：${formatPath(configDir, unityProject)}`);
  lines.push(`- Assets：${await formatExists(unityAssets)}`);
  lines.push(`- Unity 解决方案：${unitySolutions.length > 0 ? unitySolutions.map((solutionPath) => getRelativePath(configDir, solutionPath)).join(', ') : '未发现'}`);
  if (unitySolutions.length === 0) {
    warnings.push('没有发现 Unity 生成的 .sln。需要先在 Unity 中双击任意脚本生成解决方案。');
  }
  lines.push('');

  for (const project of config.projects) {
    const projectConfiguration = activeConfiguration ? project.configurations[activeConfiguration] : undefined;
    lines.push(`### ${project.name}`);
    lines.push('');
    lines.push(`- 程序集：${project.assemblyName}.dll`);
    lines.push(`- sourceProject：${project.sourceProject ? await formatExists(resolveConfigPath(configDir, project.sourceProject)) : '未配置'}`);
    lines.push(`- targetPluginPath：${formatPath(configDir, resolveConfigPath(configDir, project.targetPluginPath))}`);

    if (!projectConfiguration) {
      const message = `项目 ${project.name} 缺少当前配置：${activeConfiguration ?? '-'}`;
      errors.push(message);
      lines.push(`- 输出目录：${message}`);
      lines.push('');
      continue;
    }

    const outputDir = resolveConfigPath(configDir, projectConfiguration.outputDir);
    const dllPath = path.join(outputDir, `${project.assemblyName}.dll`);
    const pdbPath = path.join(outputDir, `${project.assemblyName}.pdb`);
    lines.push(`- outputDir：${await formatExists(outputDir)}`);
    lines.push(`- 主 DLL：${await formatExists(dllPath)}`);
    lines.push(`- PDB：${projectConfiguration.copyPdb ? await formatExists(pdbPath) : '未开启 copyPdb'}`);
    lines.push(`- copyAllDlls：${projectConfiguration.copyAllDlls === true ? 'true' : 'false'}`);

    if (project.sourceProject) {
      const sourceProjectPath = resolveConfigPath(configDir, project.sourceProject);
      lines.push(`- 已加入 Unity .sln：${await formatSolutionMembership(unitySolutions, sourceProjectPath)}`);
      lines.push(...(await renderPostBuildEvents(configDir, sourceProjectPath, warnings)));
    }

    if (!projectConfiguration.copyPdb) {
      warnings.push(`项目 ${project.name} 未开启 copyPdb，Unity 调试体验可能不完整。`);
    }

    lines.push('');
  }

  return lines;
}

function renderDiscovery(context: DiagnosticContext): string[] {
  const lines = ['## 自动发现结果', ''];
  const { discovery, workspaceRoot } = context;

  lines.push('### Unity 工程');
  if (discovery.unityProjects.length === 0) {
    lines.push('- 未发现 Unity 工程。');
  } else {
    lines.push(...discovery.unityProjects.slice(0, 10).map((candidate) => `- ${getRelativePath(workspaceRoot, candidate.path)}（sln: ${candidate.solutions.length}，manifest: ${candidate.manifests.length}）`));
  }
  lines.push('');

  lines.push('### C# 工程');
  if (discovery.csProjects.length === 0) {
    lines.push('- 未发现 .csproj。');
  } else {
    lines.push(...discovery.csProjects.slice(0, 20).map((candidate) => `- ${getRelativePath(workspaceRoot, candidate.path)}（${candidate.targetFrameworks.join(', ') || '未知框架'}）`));
  }
  lines.push('');

  lines.push('### DLL 输出目录');
  if (discovery.dllOutputDirs.length === 0) {
    lines.push('- 未发现 bin 目录下的 DLL 输出。');
  } else {
    lines.push(...discovery.dllOutputDirs.slice(0, 20).map((candidate) => `- ${getRelativePath(workspaceRoot, candidate.path)}（DLL: ${candidate.dlls.length}）`));
  }
  lines.push('');

  return lines;
}

function renderSuggestions(errors: string[], warnings: string[]): string[] {
  const lines = ['## 建议', ''];

  if (errors.length === 0 && warnings.length === 0) {
    lines.push('- 当前没有发现阻塞问题。可以执行 `Unity DLL Bridge: 构建并同步`。');
    return lines;
  }

  for (const error of errors) {
    lines.push(`- 错误：${error}`);
  }

  for (const warning of warnings) {
    lines.push(`- 提醒：${warning}`);
  }

  lines.push('- 如果没有 Unity `.sln`，请先在 Unity 中双击任意脚本生成解决方案，再执行 `添加工程到 Unity 解决方案`。');
  lines.push('- 如果找不到 dotnet，请执行 `Unity DLL Bridge: 配置 dotnet 路径`。');
  return lines;
}

async function renderDotnet(
  configDir: string,
  dotnetPath: string | undefined,
  mode: string | undefined,
  errors: string[],
  warnings: string[]
): Promise<string[]> {
  const dotnet = await tryResolveDotnetCommand(configDir, dotnetPath);
  if (!dotnet) {
    if (mode === 'dotnet') {
      errors.push('没有找到 dotnet SDK。');
    } else {
      warnings.push('没有找到 dotnet SDK。仅同步模式可以暂时忽略；添加解决方案或 dotnet 构建时需要安装。');
    }
    return ['- dotnet：未找到'];
  }

  return [`- dotnet：${dotnet.label}${dotnet.version ? ` ${dotnet.version}` : ''}（${dotnet.command}）`];
}

async function renderMsbuild(configDir: string, msbuildPath: string | undefined, warnings: string[]): Promise<string[]> {
  const msbuild = await tryResolveMsbuildCommand(configDir, msbuildPath);
  if (!msbuild) {
    warnings.push('没有找到 MSBuild。dotnet 构建可用时可以暂时忽略。');
    return ['- MSBuild：未找到'];
  }

  return [`- MSBuild：${msbuild.label}${msbuild.version ? ` ${msbuild.version}` : ''}（${msbuild.command}）`];
}

async function renderPostBuildEvents(configDir: string, projectPath: string, warnings: string[]): Promise<string[]> {
  const info = await readCsprojInfo(projectPath);
  if (info.postBuildEvents.length === 0) {
    return ['- VS 生成后事件：未检测到 PostBuildEvent'];
  }

  warnings.push(`${path.basename(projectPath)} 中存在 VS PostBuildEvent，可迁移为 Unity DLL Bridge 的构建并同步流程。`);
  return [
    `- VS 生成后事件：检测到 ${info.postBuildEvents.length} 条`,
    ...info.postBuildEvents.map((event) => `  - ${event.replace(/\s+/g, ' ').slice(0, 180)}`)
  ];
}

async function formatSolutionMembership(solutionPaths: string[], projectPath: string): Promise<string> {
  if (solutionPaths.length === 0) {
    return '未检测，Unity .sln 不存在';
  }

  for (const solutionPath of solutionPaths) {
    if (await solutionContainsProject(solutionPath, projectPath)) {
      return `是（${path.basename(solutionPath)}）`;
    }
  }

  return '否，可执行 `Unity DLL Bridge: 添加工程到 Unity 解决方案`';
}

async function solutionContainsProject(solutionPath: string, projectPath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(solutionPath, 'utf8');
    const solutionDir = path.dirname(solutionPath);
    const relativeProjectPath = getRelativePath(solutionDir, projectPath).replace(/\//g, '\\').toLowerCase();
    const normalizedContent = content.replace(/\//g, '\\').toLowerCase();
    return normalizedContent.includes(relativeProjectPath) || normalizedContent.includes(path.basename(projectPath).toLowerCase());
  } catch {
    return false;
  }
}

async function formatExists(filePath: string): Promise<string> {
  return `${filePath}（${await existsHint(filePath)}）`;
}

function formatPath(configDir: string, filePath: string): string {
  return getRelativePath(configDir, filePath);
}

async function existsHint(filePath: string): Promise<string> {
  try {
    await fs.access(filePath);
    return '存在';
  } catch {
    return '不存在';
  }
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isInsideOrEqual(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
