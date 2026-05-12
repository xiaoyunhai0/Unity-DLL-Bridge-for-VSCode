# Unity DLL Bridge for VSCode

Unity DLL Bridge for VSCode 是一个面向 Unity 外部 C# DLL 工作流的离线友好工具。

它适用于这样的团队开发模式：

```text
独立 C# / Visual Studio Project
↓
编译生成 DLL
↓
同步 DLL 到 Unity 工程
↓
Unity 只引用 DLL，不直接暴露源码
```

项目目标不是替代 Visual Studio，也不是重新实现 C# 编译器，而是把“已有 DLL 或构建后的 DLL 同步到 Unity”的流程做成稳定、可追踪、可离线分发的工具链。

## 当前能力

VSCode 扩展：

- 在 VSCode 左侧 Activity Bar 提供 `DLL Bridge` 工作台，显示配置状态、错误提醒和项目摘要。
- 生成 `dllbridge.json` 配置模板。
- 校验 Unity 工程路径、DLL 输出目录和目标插件目录。
- 支持 Debug / Release 等配置切换。
- 支持 `Sync Only`：同步已经存在的 DLL/PDB/XML/依赖 DLL。
- 支持 `Build DLL Only`：在 VSCode 中调用 `dotnet`、`msbuild` 或自定义命令，只构建 DLL。
- 支持 `Build & Sync`：调用 `dotnet`、`msbuild` 或自定义命令后同步。
- 生成 `manifest.json`，记录 DLL hash、大小、配置和同步时间。
- 生成 `.dllbridge/logs/latest.log` 和时间戳日志。
- 提供状态栏 `DLL Bridge` 快捷入口。

Unity Editor 插件：

- `Tools/DLL Bridge/Refresh` 手动刷新 Unity 资源。
- `Tools/DLL Bridge/Show Current DLL Info` 以面板形式查看 `Assets/Plugins/**/manifest.json`。
- `Tools/DLL Bridge/Open Plugins Folder` 打开 Unity 插件目录。

## 为什么需要它

很多实际 Unity 项目为了权限和源码隔离，会把核心 C# 业务代码放在独立工程中维护，Unity 工程只接收编译产物。

人工复制 DLL 时常见问题：

- Debug / Release 复制错。
- 忘记复制 PDB 或 XML。
- 复制到错误的 Unity 目录。
- Unity 没刷新，以为代码没生效。
- 测试环境不知道当前 DLL 来自哪次构建。
- 离线电脑安装和更新工具麻烦。

这个项目优先解决这些流程问题。

## 快速开始

### 1. 安装 VSCode 扩展

从 GitHub Release 下载：

```text
UnityDllBridge-VSCode-<version>.vsix
```

在 VSCode 中选择：

```text
Extensions -> ... -> Install from VSIX...
```

安装后，VSCode 左侧 Activity Bar 会出现 `DLL Bridge` 图标。点击后可以看到配置状态、错误/提醒、项目摘要，并直接执行创建配置、编辑配置、构建 DLL、同步、打开日志等操作。
也可以在命令面板搜索 `Unity DLL Bridge` 使用所有命令。

### 2. 创建配置

在 VSCode 命令面板执行：

```text
Unity DLL Bridge: Create Config Template
```

它会在当前工作区生成 `dllbridge.json`。

也可以从 Release 的模板包中复制：

```text
UnityDllBridge-Templates-<version>.zip
```

### 3. 修改 dllbridge.json

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

### 4. 校验并同步

常用命令：

```text
Unity DLL Bridge: Select Configuration
Unity DLL Bridge: Validate Configuration
Unity DLL Bridge: Build DLL Only
Unity DLL Bridge: Sync Only
Unity DLL Bridge: Build & Sync
Unity DLL Bridge: Open Sync Log
Unity DLL Bridge: Open Manifest
```

如果 DLL 已经由 Visual Studio 或内部工具编译好，使用 `Sync Only`。

如果希望 VSCode 扩展触发构建，配置 `build.mode` 后使用 `Build DLL Only` 或 `Build & Sync`。
其中 `Build DLL Only` 只执行构建，不复制到 Unity；`Build & Sync` 会先构建再同步。

## 构建模式

默认模式：

```json
{
  "build": {
    "mode": "syncOnly"
  }
}
```

`dotnet`：

```json
{
  "build": {
    "mode": "dotnet",
    "projectPath": "../GameLogic/GameLogic.csproj",
    "timeoutSeconds": 120
  }
}
```

配置为 `dotnet` 后，`Build DLL Only` 和 `Build & Sync` 都会执行类似下面的命令：

```text
dotnet build ../GameLogic/GameLogic.csproj -c Debug
```

`msbuild`：

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

`custom`：

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

`{configuration}` 会被替换成当前选择的配置，例如 `Debug` 或 `Release`。

## Unity 插件

从 GitHub Release 下载：

```text
UnityDllBridge-UnityPlugin-<version>.zip
```

解压后复制到 Unity 工程：

```text
Assets/Editor/DllBridge/
```

Unity 菜单：

```text
Tools/DLL Bridge/Refresh
Tools/DLL Bridge/Show Current DLL Info
Tools/DLL Bridge/Open Plugins Folder
```

`Show Current DLL Info` 面板会显示 manifest 数量、文件数量、解析错误、DLL 配置、同步时间、目标路径、文件大小和 SHA256 短码，并提供打开或定位 manifest 的操作。

Unity 插件只位于 `Assets/Editor`，不会进入运行时构建。

## 离线分发

本项目的预期交付方式是：

```text
云端服务器 / 在线环境开发
↓
本地打包 Release 产物
↓
上传 GitHub Release
↓
离线电脑下载 Release 产物使用
```

离线用户不需要从源码构建，也不需要运行 `npm install`。

Release 产物：

```text
UnityDllBridge-VSCode-<version>.vsix
UnityDllBridge-Templates-<version>.zip
UnityDllBridge-UnityPlugin-<version>.zip
README-offline-install.md
checksums.txt
```

`<version>` 代表当前发布版本，实际文件名以 GitHub Release 中上传的文件为准。

详细步骤见 [docs/offline-install.md](docs/offline-install.md)。

## 开发

VSCode 扩展源码在：

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
├─ docs/                   # 离线安装和 agent 配置文档
├─ scripts/                # Release 产物生成脚本
└─ unity_dll_bridge_vscode_development_doc.md
```

## 安全边界

工具默认只复制编译产物：

```text
.dll
.pdb
.xml
.json
```

默认禁止把源码放进 Unity 工程：

```text
.cs
.csproj
.sln
.props
.targets
```

如果配置中出现 `allowSourceCopy: true`，校验会直接失败。

## 当前限制

- 还没有 Unity 自动刷新信号。
- 还没有 C# 编译错误跳转到 VSCode Problems。
- 还没有 DLL 引用分析和 UnityEditor 引用检查。
- 还没有 GitHub Actions 自动 Release。

这些能力会在后续版本逐步加入。
