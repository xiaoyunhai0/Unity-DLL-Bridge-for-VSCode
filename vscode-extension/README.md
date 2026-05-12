# Unity DLL Bridge

Unity DLL Bridge 是一个面向 Unity 外部 C# DLL 工作流的 VSCode 扩展。

它适合这样的团队模式：核心 C# 代码放在独立 Visual Studio / C# Project 中维护，编译成 DLL 后再放入 Unity 工程，Unity 只引用 DLL，不直接保存业务源码。

```text
外部 C# 工程
↓
DLL / PDB / XML 产物
↓
Unity DLL Bridge
↓
Unity Assets/Plugins
```

## 主要能力

- 左侧 Activity Bar 提供 `DLL Bridge` 工作台，展示配置状态、错误、提醒和项目摘要。
- 状态栏提供常用操作入口。
- 生成 `dllbridge.json` 配置模板。
- 支持 Debug / Release 等配置切换。
- `Build DLL Only`：只在 VSCode 中调用 `dotnet`、`msbuild` 或自定义命令构建 DLL，不同步到 Unity。
- `Sync Only`：同步已经由 Visual Studio、Build Tools 或内部工具生成的 DLL/PDB/XML/依赖 DLL。
- `Build & Sync`：先构建外部 C# 工程，再同步产物到 Unity。
- 生成 `manifest.json`，记录同步时间、配置、文件大小和 SHA256。
- 生成 `.dllbridge/logs/latest.log` 和时间戳日志。
- 阻止源码复制：不会把 `.cs`、`.csproj`、`.sln`、`.props`、`.targets` 当作产物同步。

## 安装后在哪里看界面

安装 VSIX 后，VSCode 左侧 Activity Bar 会出现 `DLL Bridge` 图标。

点击后可以看到：

```text
配置健康状态
当前配置和项目数量
错误 / 提醒列表
编辑配置 / 创建配置
构建与同步操作
日志和 manifest 入口
```

也可以打开命令面板，搜索 `Unity DLL Bridge` 使用全部命令。

如果还没有 `dllbridge.json`，优先点击左侧 `DLL Bridge` 页面里的 `Create Config Template`。
如果配置有错误，左侧工作台会显示错误列表，并提供 `编辑配置` 按钮直接打开 `dllbridge.json` 修改。

## 推荐流程

1. 在 VSCode 中打开外部 C# 工程工作区。
2. 打开左侧 `DLL Bridge` 插件页面。
3. 执行 `Create Config Template`。
4. 修改生成的 `dllbridge.json`。
5. 执行 `Validate Configuration`。
6. 根据需要执行 `Build DLL Only`、`Sync Only` 或 `Build & Sync`。
7. 回到 Unity 刷新资源，或配合可选 Unity Editor 插件查看 manifest。

## 命令说明

| 命令 | 作用 |
|---|---|
| `Unity DLL Bridge: Create Config Template` | 在当前工作区创建 `dllbridge.json`。 |
| `Unity DLL Bridge: Select Configuration` | 选择 Debug / Release 或其他配置。 |
| `Unity DLL Bridge: Validate Configuration` | 校验 Unity 工程路径、输出目录、目标目录和安全配置。 |
| `Unity DLL Bridge: Open Configuration` | 打开 `dllbridge.json`，即使配置内容有错误也可以直接修改。 |
| `Unity DLL Bridge: Build DLL Only` | 执行配置的构建命令，不复制文件到 Unity。 |
| `Unity DLL Bridge: Sync Only` | 将已有 DLL/PDB/XML/依赖 DLL 同步到 Unity。 |
| `Unity DLL Bridge: Build & Sync` | 先执行构建命令，再同步产物到 Unity。 |
| `Unity DLL Bridge: Open Sync Log` | 打开 `.dllbridge/logs/latest.log`。 |
| `Unity DLL Bridge: Open Manifest` | 打开 Unity 目标目录中的 `manifest.json`。 |

## 配置文件位置

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
    "mode": "syncOnly",
    "timeoutSeconds": 120
  },
  "privacy": {
    "hideAbsolutePathsInManifest": true
  },
  "projects": [
    {
      "id": "game-logic",
      "name": "GameLogic",
      "assemblyName": "GameLogic",
      "sourceProject": "../GameLogic/GameLogic.csproj",
      "targetPluginPath": "../UnityClient/Assets/Plugins/GameLogic/Runtime",
      "allowSourceCopy": false,
      "configurations": {
        "Debug": {
          "outputDir": "../GameLogic/bin/Debug/netstandard2.1",
          "copyPdb": true,
          "copyXml": true,
          "backupBeforeOverwrite": true,
          "dependencies": []
        },
        "Release": {
          "outputDir": "../GameLogic/bin/Release/netstandard2.1",
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

默认只同步已有产物：

```json
{
  "build": {
    "mode": "syncOnly"
  }
}
```

使用 `dotnet` 构建：

```json
{
  "build": {
    "mode": "dotnet",
    "projectPath": "../GameLogic/GameLogic.csproj",
    "timeoutSeconds": 120
  }
}
```

配置为 `dotnet` 后，`Build DLL Only` 和 `Build & Sync` 会执行类似命令：

```text
dotnet build ../GameLogic/GameLogic.csproj -c Debug
```

使用 `msbuild` 构建：

```json
{
  "build": {
    "mode": "msbuild",
    "solutionPath": "../GameLogic/GameLogic.sln",
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
    "command": "./scripts/build-game-logic.sh",
    "args": ["{configuration}"],
    "timeoutSeconds": 120
  }
}
```

`{configuration}` 会被替换为当前选择的配置，例如 `Debug` 或 `Release`。

## 生成文件

同步会写入：

```text
Unity target folder/
├─ GameLogic.dll
├─ GameLogic.pdb
├─ GameLogic.xml
├─ manifest.json
└─ .dllbridge-backup/
```

日志会写入：

```text
.dllbridge/logs/latest.log
.dllbridge/logs/<timestamp>.log
```

## 离线使用

扩展运行时没有 npm 依赖，适合离线 VSIX 分发。离线电脑只需要安装打包好的 `.vsix`，不需要运行 `npm install`。

Release 通常包含：

```text
UnityDllBridge-VSCode-<version>.vsix
UnityDllBridge-Templates-<version>.zip
UnityDllBridge-UnityPlugin-<version>.zip
README-offline-install.md
checksums.txt
```

`<version>` 表示 GitHub Release 中发布的版本号。

## 安全限制

该工具优先保证源码隔离。

允许同步的主要产物类型：

```text
.dll
.pdb
.xml
.json
```

禁止复制的源码或工程文件：

```text
.cs
.csproj
.sln
.props
.targets
```

如果 `allowSourceCopy` 设置为 `true`，配置校验会直接失败。

## 常见问题

`安装后没看到界面`：

- 查看 VSCode 左侧 Activity Bar 是否有 `DLL Bridge` 图标。
- 也可以按 `Ctrl+Shift+P`，搜索 `Unity DLL Bridge`。
- 如果是旧 VSIX，请从 GitHub Release 下载最新的 `UnityDllBridge-VSCode-<version>.vsix` 后重新安装。

`找不到 dllbridge.json`：

- 打开包含 `dllbridge.json` 的工作区。
- 或在左侧 `DLL Bridge` 页面执行 `Create Config Template`。

`配置有错误但不知道怎么改`：

- 打开左侧 `DLL Bridge` 工作台。
- 查看顶部状态和“问题”区域的错误列表。
- 点击 `编辑配置` 直接打开 `dllbridge.json` 修改。
- 修改后点击 `重新校验` 或刷新面板。

`找不到主 DLL`：

- 先构建外部 C# 工程，或使用 `Build DLL Only`。
- 检查 `assemblyName` 和当前配置的 `outputDir` 是否匹配真实输出。

`targetPluginPath 必须位于 Assets 内`：

- 将 `targetPluginPath` 设置到 Unity 工程的 `Assets` 目录下，推荐位于 `Assets/Plugins`。

`构建命令失败`：

- 执行 `Unity DLL Bridge: Open Sync Log` 查看详细日志。
- 检查当前机器是否安装 `dotnet`、`MSBuild.exe`，或自定义构建脚本是否可运行。
