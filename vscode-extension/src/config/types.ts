export interface LoadedBridgeConfig {
  configPath: string;
  configDir: string;
  workspaceRoot: string;
  config: unknown;
}

export interface BridgeConfig {
  version: number;
  name?: string;
  unityProject: string;
  defaultConfiguration: string;
  build?: BridgeBuildConfig;
  privacy?: {
    hideAbsolutePathsInManifest?: boolean;
  };
  projects: BridgeProject[];
}

export interface BridgeBuildConfig {
  mode?: 'syncOnly' | 'dotnet' | 'msbuild' | 'custom';
  dotnetPath?: string;
  msbuildPath?: string;
  solutionPath?: string;
  projectPath?: string;
  command?: string;
  args?: string[];
  timeoutSeconds?: number;
}

export interface BridgeProject {
  id: string;
  name: string;
  assemblyName: string;
  sourceProject?: string;
  targetPluginPath: string;
  allowSourceCopy?: boolean;
  configurations: Record<string, BridgeProjectConfiguration>;
}

export interface BridgeProjectConfiguration {
  outputDir: string;
  copyAllDlls?: boolean;
  copyPdb?: boolean;
  copyXml?: boolean;
  backupBeforeOverwrite?: boolean;
  dependencies?: string[];
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export interface ResolvedBridgeConfig {
  configPath: string;
  configDir: string;
  workspaceRoot: string;
  config: BridgeConfig;
  activeConfiguration: string;
}
