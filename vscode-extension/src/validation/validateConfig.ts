import * as fs from 'fs/promises';
import * as path from 'path';
import { BridgeConfig, BridgeProject, BridgeProjectConfiguration, LoadedBridgeConfig, ResolvedBridgeConfig, ValidationResult } from '../config/types';
import { isPlainObject, isStringArray, resolveConfigPath } from '../utils/pathUtils';

export async function validateBridgeConfig(loaded: LoadedBridgeConfig): Promise<ValidationResult> {
  const result: ValidationResult = {
    errors: [],
    warnings: []
  };

  const config = validateShape(loaded.config, result);

  if (!config) {
    return result;
  }

  await validatePaths(config, loaded.configDir, result);

  return result;
}

export function getResolvedBridgeConfig(loaded: LoadedBridgeConfig, result: ValidationResult): ResolvedBridgeConfig | undefined {
  if (result.errors.length > 0) {
    return undefined;
  }

  return {
    configPath: loaded.configPath,
    configDir: loaded.configDir,
    workspaceRoot: loaded.workspaceRoot,
    config: loaded.config as BridgeConfig
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

  if (isPlainObject(value.build) && value.build.mode !== undefined && value.build.mode !== 'syncOnly') {
    result.warnings.push('v0.1 只实现 syncOnly。其他 build.mode 会在后续版本支持。');
  }

  if (!isPlainObject(value.privacy) || value.privacy.hideAbsolutePathsInManifest !== true) {
    result.warnings.push('建议开启 privacy.hideAbsolutePathsInManifest，避免 manifest 暴露开发机绝对路径。');
  }

  return value as unknown as BridgeConfig;
}

function validateProjectShape(value: unknown, index: number, result: ValidationResult): void {
  const prefix = `projects[${index}]`;

  if (!isPlainObject(value)) {
    result.errors.push(`${prefix} 必须是 JSON object。`);
    return;
  }

  requireString(value, 'id', `${prefix}.id`, result);
  requireString(value, 'name', `${prefix}.name`, result);
  requireString(value, 'assemblyName', `${prefix}.assemblyName`, result);
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

  if (value.dependencies !== undefined && !isStringArray(value.dependencies)) {
    result.errors.push(`${prefix}.dependencies 必须是字符串数组。`);
  }
}

function requireString(value: Record<string, unknown>, key: string, label: string, result: ValidationResult): void {
  if (typeof value[key] !== 'string' || value[key].trim() === '') {
    result.errors.push(`${label} 必须是非空字符串。`);
  }
}

async function validatePaths(config: BridgeConfig, configDir: string, result: ValidationResult): Promise<void> {
  const unityProjectPath = resolveConfigPath(configDir, config.unityProject);
  const unityAssetsPath = path.join(unityProjectPath, 'Assets');

  if (!(await directoryExists(unityProjectPath))) {
    result.errors.push(`unityProject 不存在：${config.unityProject}`);
  }

  if (!(await directoryExists(unityAssetsPath))) {
    result.errors.push(`没有找到 Unity 工程 Assets 目录。请检查 unityProject：${config.unityProject}`);
  }

  for (let index = 0; index < config.projects.length; index += 1) {
    await validateProjectPaths(config.projects[index], index, config.defaultConfiguration, configDir, unityAssetsPath, result);
  }
}

async function validateProjectPaths(
  project: BridgeProject,
  index: number,
  defaultConfiguration: string,
  configDir: string,
  unityAssetsPath: string,
  result: ValidationResult
): Promise<void> {
  const prefix = `projects[${index}]`;
  const configuration = project.configurations?.[defaultConfiguration];

  if (!configuration) {
    result.errors.push(`${prefix}.configurations 中不存在 defaultConfiguration：${defaultConfiguration}`);
    return;
  }

  const targetPluginPath = resolveConfigPath(configDir, project.targetPluginPath);

  if (!isInsideOrEqual(unityAssetsPath, targetPluginPath)) {
    result.errors.push(`${prefix}.targetPluginPath 必须位于 Unity 工程 Assets 目录内：${project.targetPluginPath}`);
  }

  await validateConfigurationPaths(project, configuration, defaultConfiguration, prefix, configDir, result);
}

async function validateConfigurationPaths(
  project: BridgeProject,
  configuration: BridgeProjectConfiguration,
  configurationName: string,
  prefix: string,
  configDir: string,
  result: ValidationResult
): Promise<void> {
  const outputDir = resolveConfigPath(configDir, configuration.outputDir);

  if (!(await directoryExists(outputDir))) {
    result.errors.push(`${prefix}.configurations.${configurationName}.outputDir 不存在：${configuration.outputDir}`);
    return;
  }

  const dllPath = path.join(outputDir, `${project.assemblyName}.dll`);
  if (!(await fileExists(dllPath))) {
    result.errors.push(`没有找到主 DLL：${dllPath}`);
  }

  if (configuration.copyPdb === true) {
    const pdbPath = path.join(outputDir, `${project.assemblyName}.pdb`);
    if (!(await fileExists(pdbPath))) {
      result.warnings.push(`配置要求复制 PDB，但文件不存在：${pdbPath}`);
    }
  }

  if (configuration.copyXml === true) {
    const xmlPath = path.join(outputDir, `${project.assemblyName}.xml`);
    if (!(await fileExists(xmlPath))) {
      result.warnings.push(`配置要求复制 XML，但文件不存在：${xmlPath}`);
    }
  }

  for (const dependency of configuration.dependencies ?? []) {
    const dependencyPath = resolveConfigPath(configDir, dependency);
    if (!(await fileExists(dependencyPath))) {
      result.warnings.push(`依赖 DLL 不存在：${dependency}`);
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
