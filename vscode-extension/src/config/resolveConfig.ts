import * as vscode from 'vscode';
import { getActiveConfiguration } from './activeConfiguration';
import { loadBridgeConfig } from './loadConfig';
import { ResolvedBridgeConfig, ValidationResult } from './types';
import { getResolvedBridgeConfig, validateBridgeConfig } from '../validation/validateConfig';

export interface ResolveConfigResult {
  validation: ValidationResult;
  resolvedConfig?: ResolvedBridgeConfig;
}

export async function resolveConfigForActiveConfiguration(context: vscode.ExtensionContext): Promise<ResolveConfigResult> {
  const loadedConfig = await loadBridgeConfig();
  const defaultValidation = await validateBridgeConfig(loadedConfig);
  const defaultResolvedConfig = getResolvedBridgeConfig(loadedConfig, defaultValidation);

  if (!defaultResolvedConfig) {
    return {
      validation: defaultValidation
    };
  }

  const activeConfiguration = getActiveConfiguration(context, defaultResolvedConfig.config);

  if (activeConfiguration === defaultResolvedConfig.config.defaultConfiguration) {
    return {
      validation: defaultValidation,
      resolvedConfig: defaultResolvedConfig
    };
  }

  const activeValidation = await validateBridgeConfig(loadedConfig, activeConfiguration);

  return {
    validation: activeValidation,
    resolvedConfig: getResolvedBridgeConfig(loadedConfig, activeValidation, activeConfiguration)
  };
}
