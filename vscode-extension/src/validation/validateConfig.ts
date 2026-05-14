import * as fs from 'fs/promises';
import * as path from 'path';
import { BridgeConfig, BridgeProject, BridgeProjectConfiguration, LoadedBridgeConfig, ResolvedBridgeConfig, ValidationResult } from '../config/types';
import { isPlainObject, isStringArray, resolveConfigPath } from '../utils/pathUtils';

export interface ValidateBridgeConfigOptions {
  requireArtifacts?: boolean;
}

export async function validateBridgeConfig(
  loaded: LoadedBridgeConfig,
  configurationOverride?: string,
  options: ValidateBridgeConfigOptions = {}
): Promise<ValidationResult> {
  const result: ValidationResult = {
    errors: [],
    warnings: []
  };

  const config = validateShape(loaded.config, result);

  if (!config || result.errors.length > 0) {
    return result;
  }

  await validatePaths(config, loaded.configDir, configurationOverride ?? config.defaultConfiguration, options.requireArtifacts ?? true, result);

  return result;
}

export function getResolvedBridgeConfig(loaded: LoadedBridgeConfig, result: ValidationResult, configurationOverride?: string): ResolvedBridgeConfig | undefined {
  if (result.errors.length > 0) {
    return undefined;
  }

  return {
    configPath: loaded.configPath,
    configDir: loaded.configDir,
    workspaceRoot: loaded.workspaceRoot,
    config: loaded.config as BridgeConfig,
    activeConfiguration: configurationOverride ?? (loaded.config as BridgeConfig).defaultConfiguration
  };
}

function validateShape(value: unknown, result: ValidationResult): BridgeConfig | undefined {
  if (!isPlainObject(value)) {
    result.errors.push('配置根节点必须是 JSON object。');
    return undefined;
  }

  if (value.version !== 1) {
    result.errors.push('version 必须是 1。');
  }

  if (typeof value.unityProject !== 'string' || value.unityProject.trim() === '') {
    result.errors.push('unityProject 必须是非空字符串。');
  }

  if (typeof value.defaultConfiguration !== 'string' || value.defaultConfiguration.trim() === '') {
    result.errors.push('defaultConfiguration 必须是非空字符串。');
  }

  if (!Array.isArray(value.projects) || value.projects.length === 0) {
    result.errors.push('projects 必须是非空数组。');
    return undefined;
  }

  for (let index = 0; index < value.projects.length; index += 1) {
    validateProjectShape(value.projects[index], index, result);
  }

  if (value.build !== undefined) {
    if (!isPlainObject(value.build)) {
      result.errors.push('build 必须是 JSON object。');
    } else {
      validateBuildShape(value.build, result);
    }
  }

  if (value.watch !== undefined) {
    if (!isPlainObject(value.watch)) {
      result.errors.push('watch 必须是 JSON object。');
    } else {
      validateWatchShape(value.watch, result);
    }
  }

  if (!isPlainObject(value.privacy) || value.privacy.hideAbsolutePathsInManifest !== true) {
    result.warnings.push('建议开启 privacy.hideAbsolutePathsInManifest，避免 manifest 暴露开发机绝对路径。');
  }

  return value as unknown as BridgeConfig;
}

function validateWatchShape(value: Record<string, unknown>, result: ValidationResult): void {
  validateOptionalBoolean(value, 'enabled', 'watch.enabled', result);

  if (value.debounceSeconds !== undefined && (!Number.isFinite(value.debounceSeconds) || Number(value.debounceSeconds) <= 0)) {
    result.errors.push('watch.debounceSeconds 必须是大于 0 的数字。');
  }
}

function validateProjectShape(value: unknown, index: number, result: ValidationResult): void {
  const prefix = `projects[${index}]`;

  if (!isPlainObject(value)) {
    result.errors.push(`${prefix} 必须是 JSON object。`);
    return;
  }

  requireString(value, 'id', `${prefix}.id`, result);
  requireString(value, 'name', `${prefix}.name`, result);
  if (requireString(value, 'assemblyName', `${prefix}.assemblyName`, result)) {
    validateAssemblyName(value.assemblyName as string, `${prefix}.assemblyName`, result);
  }
  requireString(value, 'targetPluginPath', `${prefix}.targetPluginPath`, result);

  if (value.allowSourceCopy === true) {
    result.errors.push(`${prefix}.allowSourceCopy 不能为 true。工具禁止把源码复制到 Unity 工程。`);
  }

  if (!isPlainObject(value.configurations)) {
    result.errors.push(`${prefix}.configurations 必须是 JSON object。`);
    return;
  }

  for (const [configurationName, configuration] of Object.entries(value.configurations)) {
    validateConfigurationShape(configuration, `${prefix}.configurations.${configurationName}`, result);
  }
}

function validateConfigurationShape(value: unknown, prefix: string, result: ValidationResult): void {
  if (!isPlainObject(value)) {
    result.errors.push(`${prefix} 必须是 JSON object。`);
    return;
  }

  requireString(value, 'outputDir', `${prefix}.outputDir`, result);
  validateOptionalBoolean(value, 'copyAllDlls', `${prefix}.copyAllDlls`, result);
  validateOptionalBoolean(value, 'copyPdb', `${prefix}.copyPdb`, result);
  validateOptionalBoolean(value, 'copyXml', `${prefix}.copyXml`, result);
  validateOptionalBoolean(value, 'backupBeforeOverwrite', `${prefix}.backupBeforeOverwrite`, result);

  if (value.dependencies !== undefined) {
    if (!isStringArray(value.dependencies)) {
      result.errors.push(`${prefix}.dependencies 必须是字符串数组。`);
    } else {
      for (let index = 0; index < value.dependencies.length; index += 1) {
        validateDependencyPath(value.dependencies[index], `${prefix}.dependencies[${index}]`, result);
      }
    }
  }
}

function validateBuildShape(value: Record<string, unknown>, result: ValidationResult): void {
  const mode = value.mode ?? 'syncOnly';

  if (typeof mode !== 'string' || !['syncOnly', 'dotnet', 'msbuild', 'custom'].includes(mode)) {
    result.errors.push('build.mode 必须是 syncOnly / dotnet / msbuild / custom。');
  }

  validateOptionalString(value, 'dotnetPath', 'build.dotnetPath', result);
  validateOptionalString(value, 'msbuildPath', 'build.msbuildPath', result);
  validateOptionalString(value, 'solutionPath', 'build.solutionPath', result);
  validateOptionalString(value, 'projectPath', 'build.projectPath', result);
  validateOptionalString(value, 'command', 'build.command', result);

  if (mode === 'custom' && (typeof value.command !== 'string' || value.command.trim() === '')) {
    result.errors.push('build.mode 为 custom 时，build.command 必须是非空字符串。');
  }

  if (value.args !== undefined && !isStringArray(value.args)) {
    result.errors.push('build.args 必须是字符串数组。');
  }

  if (value.timeoutSeconds !== undefined && (!Number.isFinite(value.timeoutSeconds) || Number(value.timeoutSeconds) <= 0)) {
    result.errors.push('build.timeoutSeconds 必须是大于 0 的数字。');
  }
}

function validateOptionalString(value: Record<string, unknown>, key: string, label: string, result: ValidationResult): void {
  if (value[key] !== undefined && (typeof value[key] !== 'string' || (value[key] as string).trim() === '')) {
    result.errors.push(`${label} 必须是非空字符串。`);
  }
}

function validateOptionalBoolean(value: Record<string, unknown>, key: string, label: string, result: ValidationResult): void {
  if (value[key] !== undefined && typeof value[key] !== 'boolean') {
    result.errors.push(`${label} 必须是 true 或 false。`);
  }
}

function requireString(value: Record<string, unknown>, key: string, label: string, result: ValidationResult): boolean {
  if (typeof value[key] !== 'string' || value[key].trim() === '') {
    result.errors.push(`${label} 必须是非空字符串。`);
    return false;
  }

  return true;
}

function validateAssemblyName(value: string, label: string, result: ValidationResult): void {
  if (value.includes('/') || value.includes('\\') || value.toLowerCase().endsWith('.dll')) {
    result.errors.push(`${label} 只能填写程序集名，例如 GameLogic；不要包含路径或 .dll 后缀。`);
  }
}

function validateDependencyPath(value: string, label: string, result: ValidationResult): void {
  if (value.trim() === '') {
    result.errors.push(`${label} 必须是非空字符串。`);
    return;
  }

  const extension = path.extname(value).toLowerCase();
  if (extension !== '.dll') {
    result.errors.push(`${label} 只能配置 .dll 文件，不能复制源码或工程文件：${value}`);
  }
}

async function validatePaths(
  config: BridgeConfig,
  configDir: string,
  activeConfiguration: string,
  requireArtifacts: boolean,
  result: ValidationResult
): Promise<void> {
  const unityProjectPath = resolveConfigPath(configDir, config.unityProject);
  const unityAssetsPath = path.join(unityProjectPath, 'Assets');
  const unityPluginsPath = path.join(unityAssetsPath, 'Plugins');

  if (!(await directoryExists(unityProjectPath))) {
    result.errors.push(`unityProject 不存在：${config.unityProject}`);
  }

  if (!(await directoryExists(unityAssetsPath))) {
    result.errors.push(`没有找到 Unity 工程 Assets 目录。请检查 unityProject：${config.unityProject}`);
  }

  for (let index = 0; index < config.projects.length; index += 1) {
    await validateProjectPaths(config.projects[index], index, activeConfiguration, configDir, unityAssetsPath, unityPluginsPath, requireArtifacts, result);
  }
}

async function validateProjectPaths(
  project: BridgeProject,
  index: number,
  activeConfiguration: string,
  configDir: string,
  unityAssetsPath: string,
  unityPluginsPath: string,
  requireArtifacts: boolean,
  result: ValidationResult
): Promise<void> {
  const prefix = `projects[${index}]`;
  const configuration = project.configurations?.[activeConfiguration];

  if (!configuration) {
    result.errors.push(`${prefix}.configurations 中不存在当前配置：${activeConfiguration}`);
    return;
  }

  const targetPluginPath = resolveConfigPath(configDir, project.targetPluginPath);

  if (!isInsideOrEqual(unityAssetsPath, targetPluginPath)) {
    result.errors.push(`${prefix}.targetPluginPath 必须位于 Unity 工程 Assets 目录内：${project.targetPluginPath}`);
  } else if (!isInsideOrEqual(unityPluginsPath, targetPluginPath)) {
    result.warnings.push(`${prefix}.targetPluginPath 建议位于 Assets/Plugins 目录内，Unity 插件默认扫描该目录：${project.targetPluginPath}`);
  }

  await validateConfigurationPaths(project, configuration, activeConfiguration, prefix, configDir, requireArtifacts, result);
}

async function validateConfigurationPaths(
  project: BridgeProject,
  configuration: BridgeProjectConfiguration,
  configurationName: string,
  prefix: string,
  configDir: string,
  requireArtifacts: boolean,
  result: ValidationResult
): Promise<void> {
  const outputDir = resolveConfigPath(configDir, configuration.outputDir);

  if (!(await directoryExists(outputDir))) {
    if (requireArtifacts) {
      result.errors.push(`${prefix}.configurations.${configurationName}.outputDir 不存在：${configuration.outputDir}`);
    }
    return;
  }

  const dllPath = path.join(outputDir, `${project.assemblyName}.dll`);
  if (requireArtifacts && !(await fileExists(dllPath))) {
    result.errors.push(`没有找到主 DLL：${dllPath}`);
  }

  if (requireArtifacts && configuration.copyPdb === true) {
    const pdbPath = path.join(outputDir, `${project.assemblyName}.pdb`);
    if (!(await fileExists(pdbPath))) {
      result.warnings.push(`配置要求复制 PDB，但文件不存在：${pdbPath}`);
    }
  }

  if (requireArtifacts && configuration.copyXml === true) {
    const xmlPath = path.join(outputDir, `${project.assemblyName}.xml`);
    if (!(await fileExists(xmlPath))) {
      result.warnings.push(`配置要求复制 XML，但文件不存在：${xmlPath}`);
    }
  }

  if (requireArtifacts) {
    for (const dependency of configuration.dependencies ?? []) {
      const dependencyPath = resolveConfigPath(configDir, dependency);
      if (!(await fileExists(dependencyPath))) {
        result.warnings.push(`依赖 DLL 不存在：${dependency}`);
      }
    }
  }
}

async function directoryExists(directoryPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(directoryPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function isInsideOrEqual(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
