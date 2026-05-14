export interface ConfigTemplate {
  id: string;
  label: string;
  description: string;
  content: string;
}

export const CONFIG_TEMPLATES: ConfigTemplate[] = [
  {
    id: 'syncOnly',
    label: '只同步已有 DLL',
    description: '适合 Visual Studio 或公司内部工具已经负责构建的场景',
    content: JSON.stringify(createBaseConfig('syncOnly'), null, 2)
  },
  {
    id: 'dotnet',
    label: 'dotnet build 构建并同步',
    description: '适合 SDK 风格 .csproj，VSCode 内直接构建 DLL',
    content: JSON.stringify(createBaseConfig('dotnet'), null, 2)
  },
  {
    id: 'msbuild',
    label: 'MSBuild 构建并同步',
    description: '适合 Visual Studio / Build Tools 项目',
    content: JSON.stringify(createBaseConfig('msbuild'), null, 2)
  },
  {
    id: 'multi',
    label: '多项目批量同步',
    description: '适合 Hotfix、Protocol、Common 等多个 DLL 工程',
    content: JSON.stringify(createMultiProjectConfig(), null, 2)
  }
];

function createBaseConfig(mode: 'syncOnly' | 'dotnet' | 'msbuild'): unknown {
  return {
    version: 1,
    name: 'MyUnityGame',
    unityProject: '../UnityClient',
    defaultConfiguration: 'Debug',
    build: {
      mode,
      ...(mode === 'dotnet' ? { projectPath: '../GameLogic/GameLogic.csproj' } : {}),
      ...(mode === 'msbuild' ? { solutionPath: '../GameLogic/GameLogic.sln', msbuildPath: 'auto' } : {}),
      timeoutSeconds: 120
    },
    watch: {
      enabled: false,
      debounceSeconds: 2
    },
    privacy: {
      hideAbsolutePathsInManifest: true
    },
    projects: [
      createProject('game-logic', 'GameLogic', '../GameLogic/GameLogic.csproj', '../GameLogic/bin/Debug/netstandard2.1', '../GameLogic/bin/Release/netstandard2.1')
    ]
  };
}

function createMultiProjectConfig(): unknown {
  return {
    version: 1,
    name: 'MyUnityGame',
    unityProject: '../UnityClient',
    defaultConfiguration: 'Debug',
    build: {
      mode: 'dotnet',
      solutionPath: '../GameLogic/GameLogic.sln',
      timeoutSeconds: 180
    },
    watch: {
      enabled: false,
      debounceSeconds: 2
    },
    privacy: {
      hideAbsolutePathsInManifest: true
    },
    projects: [
      createProject('game-logic', 'GameLogic', '../GameLogic/GameLogic.csproj', '../GameLogic/bin/Debug/netstandard2.1', '../GameLogic/bin/Release/netstandard2.1'),
      createProject('protocol', 'Protocol', '../Protocol/Protocol.csproj', '../Protocol/bin/Debug/netstandard2.1', '../Protocol/bin/Release/netstandard2.1')
    ]
  };
}

function createProject(id: string, name: string, sourceProject: string, debugOutputDir: string, releaseOutputDir: string): unknown {
  return {
    id,
    name,
    assemblyName: name,
    sourceProject,
    targetPluginPath: `../UnityClient/Assets/Plugins/${name}/Runtime`,
    allowSourceCopy: false,
    configurations: {
      Debug: {
        outputDir: debugOutputDir,
        copyAllDlls: false,
        copyPdb: true,
        copyXml: true,
        backupBeforeOverwrite: true,
        dependencies: []
      },
      Release: {
        outputDir: releaseOutputDir,
        copyAllDlls: false,
        copyPdb: false,
        copyXml: false,
        backupBeforeOverwrite: true,
        dependencies: []
      }
    }
  };
}
