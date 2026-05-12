import * as vscode from 'vscode';
import { getActiveConfiguration } from './activeConfiguration';
import { loadBridgeConfig } from './loadConfig';
import { ResolvedBridgeConfig, ValidationResult } from './types';
import { getResolvedBridgeConfig, validateBridgeConfig } from '../validation/validateConfig';

export interface ResolveConfigResult {
  validation: ValidationResult;
  resolvedConfig?: ResolvedBridgeConfig;
}

export interface ResolveConfigOptions {
  requireArtifacts?: boolean;
}

export async function resolveConfigForActiveConfiguration(
  context: vscode.ExtensionContext,
  options: ResolveConfigOptions = {}
): Promise<ResolveConfigResult> {
  const loadedConfig = await loadBridgeConfig();
  const shapeValidation = await validateBridgeConfig(loadedConfig, undefined, {
    requireArtifacts: false
  });
  const shapeResolvedConfig = getResolvedBridgeConfig(loadedConfig, shapeValidation);

  if (!shapeResolvedConfig) {
    return {
      validation: shapeValidation
    };
  }

  const activeConfiguration = getActiveConfiguration(context, shapeResolvedConfig.config);

  const activeValidation = await validateBridgeConfig(loadedConfig, activeConfiguration, {
    requireArtifacts: options.requireArtifacts
  });

  return {
    validation: activeValidation,
    resolvedConfig: getResolvedBridgeConfig(loadedConfig, activeValidation, activeConfiguration)
  };
}
