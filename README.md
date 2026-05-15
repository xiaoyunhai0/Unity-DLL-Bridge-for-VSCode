# Unity DLL Bridge for VSCode

Unity DLL Bridge for VSCode 是一个面向 Unity 外部 C# DLL 开发流程的正式版工具链。它把 Visual Studio 里常见的“打开 Unity 解决方案、添加外部 C# 工程、生成 DLL、复制到 `Assets/Plugins`”流程搬到 VSCode，并补上配置、诊断、日志、离线分发和 Unity Editor 辅助面板。

它适合核心业务代码不直接放进 Unity 工程的团队：

```text
外部 C# / Visual Studio Project
↓
构建 DLL / PDB / XML
↓
Unity DLL Bridge
↓
Unity Assets/Plugins
↓
Unity 只引用编译产物
```

## 核心定位

- 复刻 Visual Studio 的 Unity 外部 DLL 工作流。
- 支持 Unity 自动生成的 `.sln` 和外部 `.csproj`。
- 一键生成 DLL，或生成后同步到 Unity。
- 自动补齐 `$(SolutionDir)` 等解决方案变量，兼容 `.csproj` 的 PostBuildEvent。
- 支持直接同步已有 DLL，适配公司内部构建流水线。
- 提供中文配置向导、自动发现、环境诊断、日志和 manifest。
- 支持离线分发：安装 VSIX 后即可使用，不要求离线电脑运行 `npm install`。

## 正式版能力

### VSCode 扩展

- 左侧 Activity Bar 提供 `DLL Bridge` 工作台。
- 工作台展示 Unity `.sln`、解决方案中的 `.csproj`、已配置 DLL 工程、输出状态和问题列表。
- 解决方案工程列表支持折叠，工程多时不用一路滚到底。
- 支持把外部 `.csproj` 加入 Unity 自动生成的 `.sln`。
- 支持为每个工程选择同步目标目录，例如 `Assets/Plugins` 或 `Assets/Plugins/GameLib/Runtime`。
- 支持 `生成 DLL`、`仅同步 DLL`、`构建并同步`、`批量构建并同步`。
- 支持 `dotnet`、`msbuild`、自定义命令和只同步模式。
- 自动查找 dotnet 和 MSBuild，必要时可手动选择 dotnet 路径。
- 构建错误写入 VSCode Problems 面板。
- 支持自动发现附近 Unity 工程、C# 工程、`.sln` 和 DLL 输出目录。
- 支持一键诊断 Unity、`.sln`、`.csproj`、dotnet、MSBuild、DLL/PDB 和 PostBuildEvent。
- 支持 Debug / Release 配置切换。
- 支持监听外部 C# 源码变化后自动构建并同步。
- 支持生成 Unity Editor 附加调试配置。
- 每次同步生成 `manifest.json` 和 `.dllbridge/logs/latest.log`。
- 默认禁止复制 `.cs`、`.csproj`、`.sln`、`.props`、`.targets` 等源码或工程文件。

### Unity Editor 插件

- `Tools/DLL Bridge/Refresh` 手动刷新 Unity 资源。
- `Tools/DLL Bridge/Show Current DLL Info` 查看 `Assets/Plugins/**/manifest.json`。
- `Tools/DLL Bridge/Open Plugins Folder` 打开插件目录。

Unity 插件只放在 `Assets/Editor`，不会进入运行时构建。

## 推荐工作流

这条流程最接近 Visual Studio 里的“添加现有项目 -> 生成”：

1. 在 Unity 中双击任意脚本，让 Unity 生成项目 `.sln`。
2. 在 VSCode 中打开外部 C# 工程或当前工具工作区。
3. 点击左侧 Activity Bar 的 `DLL Bridge`。
4. 点击 `添加现有工程`。
5. 选择 Unity 生成的 `.sln`。
6. 选择外部 C# 工程的 `.csproj`，例如 `E:\Unity\project\gamelib-main\gamelib\GameLib.csproj`。
7. 选择 DLL 同步目标目录，例如 `E:\Unity\project\project-main\project\Assets\Plugins`。
8. 添加成功后，在工作台里确认 `解决方案中的工程` 和 `已配置工程`。
9. 点击 `生成 DLL`，只构建外部 DLL。
10. 需要复制到 Unity 时，点击 `构建并同步` 或 `仅同步 DLL`。

`.csproj` 代表整个 C# 工程，不是单个 `.cs` 文件。生成时会编译这个工程包含的源码文件，并输出对应的 DLL/PDB。

## 你的路径应该怎么选

以当前常见结构为例：

```text
Unity 工程：
E:\Unity\project\project-main\project

Unity DLL 目标：
E:\Unity\project\project-main\project\Assets\Plugins\GameLib.dll

外部 C# 工程：
E:\Unity\project\gamelib-main\gamelib\GameLib.csproj
```

添加工程时：

- Unity `.sln` 选择 `E:\Unity\project\project-main\project\project.sln`。
- 外部 `.csproj` 选择 `E:\Unity\project\gamelib-main\gamelib\GameLib.csproj`。
- 同步目标如果项目当前就是直接放 DLL 到 `Assets/Plugins`，选择 `E:\Unity\project\project-main\project\Assets\Plugins`。

扩展会在 `dotnet build` 时传入类似下面的解决方案变量：

```text
/p:SolutionDir=E:\Unity\project\project-main\project\
/p:SolutionPath=E:\Unity\project\project-main\project\project.sln
/p:SolutionFileName=project.sln
/p:SolutionName=project
/p:SolutionExt=.sln
```

这样 `.csproj` 里的 `$(SolutionDir)Assets\Plugins\GameLib.dll` 可以正常解析，不会再变成 `*Undefined*Assets\Plugins`。

## 安装

从 GitHub Release 下载正式版产物：

```text
UnityDllBridge-VSCode-1.0.0.vsix
UnityDllBridge-Templates-1.0.0.zip
UnityDllBridge-UnityPlugin-1.0.0.zip
README-offline-install.md
checksums.txt
```

安装 VSCode 扩展：

```text
VSCode -> Extensions -> ... -> Install from VSIX...
```

选择 `UnityDllBridge-VSCode-1.0.0.vsix`。安装后，左侧 Activity Bar 会出现 `DLL Bridge` 图标。

安装 Unity Editor 插件：

1. 解压 `UnityDllBridge-UnityPlugin-1.0.0.zip`。
2. 将 `Assets/Editor/DllBridge/` 复制到 Unity 工程的 `Assets/Editor/DllBridge/`。
3. 回到 Unity 等待脚本编译。
4. 使用 `Tools/DLL Bridge` 菜单查看 DLL 信息或刷新资源。

完整离线步骤见 [docs/offline-install.md](docs/offline-install.md)。

## 常用命令

| 命令 | 用途 |
|---|---|
| `Unity DLL Bridge: 添加工程到 Unity 解决方案` | 选择 Unity `.sln` 和外部 `.csproj`，执行 `dotnet sln add` 并写入配置。 |
| `Unity DLL Bridge: 打开 Unity 解决方案` | 自动查找并打开 Unity 生成的 `.sln`。 |
| `Unity DLL Bridge: 配置向导` | 选择 Unity 工程、C# 工程或 DLL 输出目录，自动生成 `dllbridge.json`。 |
| `Unity DLL Bridge: 自动发现项目` | 扫描附近 Unity 工程、`.sln`、`.csproj` 和 DLL 输出目录。 |
| `Unity DLL Bridge: 一键诊断环境` | 检查 Unity、dotnet、MSBuild、DLL/PDB、PostBuildEvent 等环境。 |
| `Unity DLL Bridge: 配置 dotnet 路径` | PATH 找不到 dotnet 时，手动选择 dotnet 安装目录或可执行文件。 |
| `Unity DLL Bridge: 生成 DLL` | 只构建外部 C# 工程，不复制到 Unity。 |
| `Unity DLL Bridge: 仅同步 DLL` | 同步已有 DLL/PDB/XML/依赖 DLL。 |
| `Unity DLL Bridge: 构建并同步` | 先构建，再同步到 Unity。 |
| `Unity DLL Bridge: 批量构建并同步` | 多项目场景下批量构建和同步。 |
| `Unity DLL Bridge: 打开同步日志` | 打开 `.dllbridge/logs/latest.log`。 |
| `Unity DLL Bridge: 打开 Manifest` | 打开 Unity 目标目录中的 `manifest.json`。 |

## 配置文件

扩展会按顺序查找：

```text
workspace/dllbridge.json
workspace/.dllbridge/dllbridge.json
```

最小配置示例：

```json
{
  "version": 1,
  "name": "MyUnityGame",
  "unityProject": "../UnityClient",
  "defaultConfiguration": "Debug",
  "build": {
    "mode": "dotnet",
    "solutionPath": "../UnityClient/MyUnityGame.sln",
    "projectPath": "../GameLib/GameLib.csproj",
    "timeoutSeconds": 120
  },
  "privacy": {
    "hideAbsolutePathsInManifest": true
  },
  "projects": [
    {
      "id": "game-lib",
      "name": "GameLib",
      "assemblyName": "GameLib",
      "sourceProject": "../GameLib/GameLib.csproj",
      "targetPluginPath": "../UnityClient/Assets/Plugins",
      "allowSourceCopy": false,
      "configurations": {
        "Debug": {
          "outputDir": "../GameLib/bin/Debug",
          "copyAllDlls": false,
          "copyPdb": true,
          "copyXml": true,
          "backupBeforeOverwrite": true,
          "dependencies": []
        },
        "Release": {
          "outputDir": "../GameLib/bin/Release",
          "copyAllDlls": false,
          "copyPdb": false,
          "copyXml": false,
          "backupBeforeOverwrite": true,
          "dependencies": []
        }
      }
    }
  ]
}
```

如果 `dllbridge.json` 就放在 Unity 工程根目录，也就是和 `Assets`、`ProjectSettings` 同级，`unityProject` 应写成 `"."`，不能留空。

## 构建模式

只同步已有 DLL：

```json
{
  "build": {
    "mode": "syncOnly"
  }
}
```

使用 dotnet 构建：

```json
{
  "build": {
    "mode": "dotnet",
    "solutionPath": "../UnityClient/MyUnityGame.sln",
    "projectPath": "../GameLib/GameLib.csproj",
    "timeoutSeconds": 120
  }
}
```

使用 MSBuild 构建：

```json
{
  "build": {
    "mode": "msbuild",
    "solutionPath": "../GameLib/GameLib.sln",
    "msbuildPath": "auto",
    "timeoutSeconds": 120
  }
}
```

使用自定义命令：

```json
{
  "build": {
    "mode": "custom",
    "command": "./scripts/build-game-lib.sh",
    "args": ["{configuration}"],
    "timeoutSeconds": 120
  }
}
```

`{configuration}` 会替换为当前配置，例如 `Debug` 或 `Release`。

## 诊断

路径不确定时，先执行：

```text
Unity DLL Bridge: 自动发现项目
```

扩展会生成 `.dllbridge/discovery-report.md`，列出附近的 Unity 工程、`.sln`、`.csproj` 和 DLL 输出目录。

构建或同步失败时，执行：

```text
Unity DLL Bridge: 一键诊断环境
```

扩展会生成 `.dllbridge/environment-report.md`，检查 Unity 工程、Assets、解决方案、外部工程、dotnet、MSBuild、主 DLL、PDB 和 VS PostBuildEvent，并给出中文建议。

## 常见问题

`*Undefined*Assets\Plugins`：

旧流程里直接构建外部 `.csproj` 时，`$(SolutionDir)` 可能为空。正式版会在 `dotnet build` 时根据 Unity `.sln` 自动传入 `SolutionDir`、`SolutionPath` 等变量。

`命令语法不正确`：

通常是 Windows `copy` 命令遇到混合斜杠或未正确解析的路径。正式版会使用 Windows 格式传入解决方案路径，例如 `E:\Unity\project\project-main\project\`。

`ReYunSDK` warning：

这是 `.csproj` 的引用警告。只要最终是 `0 个错误` 且 `Build exit code: 0`，DLL 已经生成成功。后续可按项目需要补齐该依赖。

`unityProject` 应该怎么写：

如果配置文件在 Unity 工程根目录，写 `"."`。如果配置文件在外部工作区，写到 Unity 工程根目录的相对路径或绝对路径。

## 本地开发

扩展源码在：

```text
vscode-extension/
```

安装依赖：

```bash
cd vscode-extension
npm install
```

编译：

```bash
npm run compile
```

生成本地 Release 产物：

```bash
npm run release:local
```

产物会生成到仓库根目录的 `releases/`，该目录不提交 Git。

## 仓库结构

```text
.
├─ vscode-extension/       # VSCode 扩展
├─ unity-plugin/           # Unity Editor 插件
├─ templates/              # dllbridge.json 模板
├─ docs/                   # 离线安装和项目文档
├─ scripts/                # Release 产物生成脚本
└─ unity_dll_bridge_vscode_development_doc.md
```

## 安全边界

默认只同步编译产物：

```text
.dll
.pdb
.xml
.json
```

默认禁止复制源码和工程文件：

```text
.cs
.csproj
.sln
.props
.targets
```

如果配置中出现 `allowSourceCopy: true`，校验会直接失败。
