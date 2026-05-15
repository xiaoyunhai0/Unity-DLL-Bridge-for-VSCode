# Unity DLL Bridge

Unity DLL Bridge 是一个用于 Unity 外部 C# DLL 工作流的 VSCode 扩展。它把 Visual Studio 中常见的“添加外部 C# 工程、生成 DLL、复制到 Unity `Assets/Plugins`”流程整理成一个可视化工作台，并提供配置向导、环境诊断、构建日志、manifest 和离线分发支持。

适合这样的项目结构：

```text
外部 C# 工程 / GameLib.csproj
↓
GameLib.dll / GameLib.pdb
↓
Unity DLL Bridge
↓
Unity 工程 / Assets/Plugins
```

## 你会得到什么

- 左侧 Activity Bar 的 `DLL Bridge` 工作台。
- Unity `.sln`、解决方案 `.csproj`、已配置 DLL 工程和输出状态集中展示。
- 解决方案工程列表可折叠，工程很多时也能快速看到生成 DLL 操作。
- 一键把外部 `.csproj` 加入 Unity 自动生成的 `.sln`。
- 一键 `生成 DLL`，只构建 DLL，不复制到 Unity。
- 一键 `构建并同步`，构建后复制 DLL/PDB/XML 到 Unity。
- 也可以 `仅同步 DLL`，适配已经由 Visual Studio 或公司内部流水线生成好的产物。
- 自动传入 `$(SolutionDir)` 等解决方案变量，兼容 `.csproj` 的生成后事件。
- 支持手动选择 Unity DLL 目标目录，例如 `Assets/Plugins`。
- 支持 Debug / Release 切换。
- 支持 dotnet、MSBuild、自定义命令和只同步模式。
- 支持 dotnet 自动检测，也支持手动选择 dotnet 安装目录。
- 构建错误进入 VSCode Problems 面板。
- 生成同步日志和 `manifest.json`。
- 默认阻止源码文件进入 Unity。

## 推荐流程

这条流程对应 Visual Studio 里的“打开 Unity 解决方案 -> 添加现有项目 -> 生成”。

第一次使用前，先让 Unity 生成解决方案文件。推荐在 Unity 里把 External Script Editor 设置为 Visual Studio，然后双击任意 C# 脚本；Unity 会在工程根目录生成或刷新 `project.sln` 和 Unity 自己的 `.csproj`。如果工程根目录还没有 `.sln`，先完成这一步，再回到 VSCode 使用 DLL Bridge。

1. 确认 Unity 工程根目录已经存在 `.sln`，例如 `E:\Unity\project\project-main\project\project.sln`。
2. 在 VSCode 中打开外部 C# 工程或你的工具工作区。
3. 点击左侧 Activity Bar 的 `DLL Bridge`。
4. 点击 `添加现有工程`。
5. 选择 Unity 生成的 `.sln`。
6. 选择外部 C# 工程的 `.csproj`。
7. 选择 DLL 同步目标目录。
8. 添加成功后，在工作台确认 `解决方案中的工程` 和 `已配置工程`。
9. 点击 `生成 DLL`。
10. 需要复制到 Unity 时，再点击 `构建并同步` 或 `仅同步 DLL`。

`.csproj` 是整个 C# 工程，不是单个 `.cs` 文件。扩展会构建这个工程，并输出对应 DLL。

## 路径示例

假设当前项目是：

```text
Unity 工程：
E:\Unity\project\project-main\project

Unity DLL 目标：
E:\Unity\project\project-main\project\Assets\Plugins\GameLib.dll

外部 C# 工程：
E:\Unity\project\gamelib-main\gamelib\GameLib.csproj
```

操作时这样选：

- Unity `.sln`：`E:\Unity\project\project-main\project\project.sln`
- 外部 `.csproj`：`E:\Unity\project\gamelib-main\gamelib\GameLib.csproj`
- 同步目标目录：`E:\Unity\project\project-main\project\Assets\Plugins`

如果没有看到 `project.sln`，先回 Unity 双击一个脚本，或使用 Unity 的重新生成项目文件功能。生成后再执行 `添加现有工程`。

如果你的 DLL 需要放到子目录，也可以选择：

```text
E:\Unity\project\project-main\project\Assets\Plugins\GameLib\Runtime
```

扩展会在构建时传入类似下面的参数：

```text
dotnet build E:\Unity\project\gamelib-main\gamelib\GameLib.csproj -c Debug
/p:SolutionDir=E:\Unity\project\project-main\project\
/p:SolutionPath=E:\Unity\project\project-main\project\project.sln
/p:SolutionFileName=project.sln
/p:SolutionName=project
/p:SolutionExt=.sln
```

因此 `.csproj` 的 PostBuildEvent 如果写了 `$(SolutionDir)Assets\Plugins\GameLib.dll`，也能正确复制到 Unity。

## 首次配置

优先使用左侧 `DLL Bridge` 工作台的 `添加现有工程`。它会同时完成三件事：

```text
dotnet sln <Unity.sln> add <GameLib.csproj>
↓
写入 dllbridge.json
↓
在工作台显示可生成的 DLL 工程
```

如果你的项目不走 Unity `.sln`，也可以使用：

```text
Unity DLL Bridge: 配置向导
```

向导会让你选择：

- Unity 工程根目录：包含 `Assets` 的目录。
- 外部 C# 工程：选择工程文件夹或 `.csproj`。
- DLL 输出目录：已有构建流程时选择包含 DLL 的文件夹。
- Unity 目标目录：建议选择 `Assets/Plugins` 或 `Assets/Plugins/<程序集名>/Runtime`。
- 构建方式：`syncOnly`、`dotnet`、`msbuild` 或 `custom`。

如果 `dllbridge.json` 就放在 Unity 工程根目录，也就是和 `Assets`、`ProjectSettings` 同级，`unityProject` 应写成 `"."`，不能留空。

## 常用操作

| 操作 | 说明 |
|---|---|
| `添加现有工程` | 选择 Unity `.sln` 和外部 `.csproj`，加入解决方案并写入配置。 |
| `生成 DLL` | 执行构建命令，只生成 DLL，不同步到 Unity。 |
| `构建并同步` | 构建后同步 DLL/PDB/XML 到 Unity。 |
| `仅同步 DLL` | 不构建，只复制已有 DLL 产物。 |
| `配置向导` | 自动生成 `dllbridge.json`。 |
| `自动发现项目` | 查找附近 Unity 工程、`.sln`、`.csproj` 和 DLL 输出目录。 |
| `一键诊断环境` | 生成环境诊断报告。 |
| `配置 dotnet 路径` | PATH 找不到 dotnet 时手动指定。 |
| `选择 Debug/Release 配置` | 切换当前构建配置。 |
| `打开同步日志` | 查看 `.dllbridge/logs/latest.log`。 |
| `打开 Manifest` | 查看 Unity 目标目录的 `manifest.json`。 |

## 命令面板

按 `Ctrl+Shift+P`，搜索 `Unity DLL Bridge`：

```text
Unity DLL Bridge: 添加工程到 Unity 解决方案
Unity DLL Bridge: 打开 Unity 解决方案
Unity DLL Bridge: 配置向导
Unity DLL Bridge: 创建配置模板
Unity DLL Bridge: 自动发现项目
Unity DLL Bridge: 一键诊断环境
Unity DLL Bridge: 配置 dotnet 路径
Unity DLL Bridge: 选择 Debug/Release 配置
Unity DLL Bridge: 校验配置
Unity DLL Bridge: 打开配置文件
Unity DLL Bridge: 生成当前工程 DLL
Unity DLL Bridge: 生成 DLL
Unity DLL Bridge: 仅同步 DLL
Unity DLL Bridge: 构建并同步
Unity DLL Bridge: 批量构建并同步
Unity DLL Bridge: 开关自动构建同步
Unity DLL Bridge: 生成 Unity 调试配置
Unity DLL Bridge: 打开同步日志
Unity DLL Bridge: 打开 Manifest
```

## 配置示例

扩展会查找：

```text
workspace/dllbridge.json
workspace/.dllbridge/dllbridge.json
```

示例：

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

## 输出文件

同步后，Unity 目标目录通常会有：

```text
Assets/Plugins/
├─ GameLib.dll
├─ GameLib.pdb
├─ GameLib.xml
├─ manifest.json
└─ .dllbridge-backup/
```

日志写入：

```text
.dllbridge/logs/latest.log
.dllbridge/logs/<timestamp>.log
```

## 离线使用

正式版 Release 包含：

```text
UnityDllBridge-VSCode-1.0.0.vsix
UnityDllBridge-Templates-1.0.0.zip
UnityDllBridge-UnityPlugin-1.0.0.zip
README-offline-install.md
checksums.txt
```

离线电脑只需要安装 `.vsix`。如果需要 Unity 辅助菜单，再安装 Unity 插件包。

## 安全边界

默认允许同步：

```text
.dll
.pdb
.xml
.json
```

默认禁止同步：

```text
.cs
.csproj
.sln
.props
.targets
```

如果配置中出现 `allowSourceCopy: true`，校验会直接失败。

## 常见问题

`安装后没看到 DLL Bridge 图标`

- 看 VSCode 左侧 Activity Bar 是否有 `DLL Bridge`。
- 按 `Ctrl+Shift+P` 搜索 `Unity DLL Bridge`。
- 如果仍然没有，重新安装 `UnityDllBridge-VSCode-1.0.0.vsix`。

`找不到 dllbridge.json`

- 优先在左侧 `DLL Bridge` 工作台点击 `添加现有工程`。
- 不走解决方案流程时，执行 `Unity DLL Bridge: 配置向导`。
- 已有模板时，把 `dllbridge.json` 放到工作区根目录或 `.dllbridge/dllbridge.json`。

`unityProject 不知道怎么写`

- `dllbridge.json` 在 Unity 工程根目录时写 `"."`。
- `dllbridge.json` 在外部工作区时，写到 Unity 工程根目录的相对路径或绝对路径。

`出现 *Undefined*Assets\Plugins`

- 这是 `.csproj` 里的 `$(SolutionDir)` 没有被 MSBuild 正确赋值。
- 正式版会根据你选择的 Unity `.sln` 自动传入 `SolutionDir`、`SolutionPath`、`SolutionFileName`、`SolutionName` 和 `SolutionExt`。

`出现 命令语法不正确`

- Windows `copy` 命令对路径格式很敏感。
- 正式版会使用 Windows 反斜杠格式传入 `SolutionDir`，例如 `E:\Unity\project\project-main\project\`。

`ReYunSDK 未能解析`

- 这是外部工程引用警告，不一定阻止构建。
- 如果最终显示 `0 个错误` 和 `Build exit code: 0`，DLL 已经生成成功。
- 如果代码确实依赖它，需要在外部 C# 工程里补齐该程序集引用。

`生成 DLL 成功但 Unity 没更新`

- `生成 DLL` 只构建，不复制。
- 要复制到 Unity，请执行 `构建并同步` 或 `仅同步 DLL`。
- 如果 `.csproj` 自己的 PostBuildEvent 已经复制 DLL，也可以只用 `生成 DLL`。
