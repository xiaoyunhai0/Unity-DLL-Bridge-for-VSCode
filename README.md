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

- 在 VSCode 左侧 Activity Bar 提供 `DLL Bridge` 工作台，按 Visual Studio 的解决方案流程显示 `.sln`、已加入的 `.csproj` 和 DLL 输出状态。
- 支持选择 Unity 生成的 `.sln`，再添加外部 `gamelib.csproj`，添加成功后自动写入 `dllbridge.json`。
- 提供中文配置向导：选择 Unity 工程、外部 C# 工程文件夹、`.csproj` 或已有 DLL 输出文件夹后自动生成 `dllbridge.json`。
- 生成多种 `dllbridge.json` 配置模板：只同步、dotnet、MSBuild、多项目。
- 校验 Unity 工程路径、DLL 输出目录和目标插件目录。
- 一键诊断 Unity、`.sln`、`.csproj`、dotnet、MSBuild、DLL/PDB 环境。
- 自动发现附近 Unity 工程、C# 工程和 DLL 输出目录。
- 支持把外部 `.csproj` 加入 Unity 自动生成的 `.sln`，对应 Visual Studio 的“添加现有项目”。
- 支持打开 Unity 生成的 `.sln`。
- 支持 Debug / Release 等配置切换。
- 支持 `仅同步 DLL`：同步已经存在的 DLL/PDB/XML/依赖 DLL。
- 支持 `生成 DLL`：在 VSCode 中调用 `dotnet`、`msbuild` 或自定义命令，只构建 DLL。
- 支持 `构建并同步`：调用 `dotnet`、`msbuild` 或自定义命令后同步。
- 支持构建错误进入 VSCode Problems 面板，点击跳转源码行。
- 支持监听外部 C# 源码变化后自动构建并同步。
- 支持生成 Unity Editor 附加调试配置。
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

安装后，VSCode 左侧 Activity Bar 会出现 `DLL Bridge` 图标。点击后可以看到 Unity 解决方案、解决方案里的 C# 工程、已配置 DLL 项目和输出状态，并直接执行添加工程、生成 DLL、生成并同步、打开解决方案等操作。
也可以在命令面板搜索 `Unity DLL Bridge` 使用所有命令。

### 2. 还原 Visual Studio 流程

推荐优先走这个流程，它对应你在 Visual Studio 中的操作：

```text
Unity 双击任意脚本生成 .sln
↓
VSCode 左侧 DLL Bridge
↓
添加现有工程：选择 Unity .sln 和外部 gamelib.csproj
↓
侧边栏看到 gamelib 出现在“解决方案中的工程”
↓
点击“生成 DLL”
↓
dotnet build gamelib.csproj -c Debug
↓
生成 gamelib.dll / gamelib.pdb
```

具体操作：

1. 在 Unity 中把代码编辑器设为 Visual Studio 或任意会生成 `.sln` 的编辑器，然后双击任意脚本，让 Unity 生成项目 `.sln`。
2. 在 VSCode 中打开外部 C# 工程或工具工作区。
3. 打开左侧 `DLL Bridge` 页面。
4. 点击 `添加现有工程`，选择 Unity 生成的 `.sln`，再选择外部 `gamelib.csproj`。
5. 扩展会执行 `dotnet sln <Unity.sln> add <gamelib.csproj>`，并自动写入 `dllbridge.json`。
6. 添加成功后，侧边栏的 `解决方案中的工程` 会显示 `gamelib`，`已配置工程` 会显示输出 DLL 路径。
7. 点击项目里的 `生成 gamelib.dll` 或顶部 `生成 DLL`。

这里的 `.csproj` 代表整个外部 C# 大项目，会编译该项目包含的很多 `.cs` 文件，不是只转换一个 `.cs` 文件。

### 3. 创建配置

如果你的项目不是上面的解决方案流程，也可以使用配置向导，不再手写整份 JSON。在左侧 `DLL Bridge` 工作台点击：

```text
配置向导
```

也可以在命令面板执行：

```text
Unity DLL Bridge: 配置向导
```

向导会让你选择：

- Unity 工程根目录：选择包含 `Assets` 的目录，例如 `E:/Unity/project/project-main/pro`。
- 外部 C# 项目：优先选择源码工程文件夹，向导会在里面找 `.csproj`。`.csproj` 代表整个 C# 项目，会编译很多 `.cs` 文件，不是单个 `.cs` 文件。
- DLL 输出：如果公司已有构建流程，也可以直接选择包含 DLL 的输出文件夹，从这个文件夹同步到 Unity 目标文件夹。
- Unity 目标目录：建议使用 `Assets/Plugins/<程序集名>/Runtime`。
- 构建方式：离线或 Visual Studio 编译场景选“只同步已有 DLL”；安装了 dotnet SDK 时可选 `dotnet build`。扩展会自动查找 `dotnet`，找不到时可直接在向导里选择 dotnet 安装文件夹。

插件会自动推断：

- `assemblyName`
- `sourceProject`
- Debug / Release 的 `outputDir`
- 是否同步输出文件夹中的所有 DLL
- `targetPluginPath`
- `build.mode`
- `build.dotnetPath`：通常不用填写。扩展会自动检查 PATH、`DOTNET_ROOT` 和常见安装目录；只有离线机器 PATH 没配好时，才需要通过 `Unity DLL Bridge: 配置 dotnet 路径` 写入。

如果自动推断不符合你的项目结构，再打开 `dllbridge.json` 做少量调整。

如果 `dllbridge.json` 就放在 Unity 工程根目录，也就是和 `Assets`、`ProjectSettings` 同级，`unityProject` 应写成 `"."`，表示当前目录就是 Unity 工程，不能留空。

手动模板仍然保留。命令面板执行：

```text
Unity DLL Bridge: 创建配置模板
```

也可以从 Release 的模板包中复制：

```text
UnityDllBridge-Templates-<version>.zip
```

模板包包含 `dllbridge.single.json`、`dllbridge.dotnet.json`、`dllbridge.msbuild.json` 和 `dllbridge.multi.json`。

### 4. 配置示例

向导会生成类似下面的配置。你的目录如果是：

```text
Unity 工程：E:/Unity/project/project-main/pro
C# 工程：E:/Unity/project/gamelib-main/gamelib/GameLogic.csproj
同步目标：E:/Unity/project/project-main/pro/Assets/Plugins/GameLogic/Runtime
```

最终核心字段应该类似：

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
          "copyAllDlls": false,
          "copyPdb": true,
          "copyXml": true,
          "backupBeforeOverwrite": true,
          "dependencies": []
        },
        "Release": {
          "outputDir": "../GameLogic/bin/Release/netstandard2.1",
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

### 5. 校验并同步

常用命令：

```text
Unity DLL Bridge: 选择 Debug/Release 配置
Unity DLL Bridge: 校验配置
Unity DLL Bridge: 添加工程到 Unity 解决方案
Unity DLL Bridge: 打开 Unity 解决方案
Unity DLL Bridge: 一键诊断环境
Unity DLL Bridge: 自动发现项目
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

如果 DLL 已经由 Visual Studio 或内部工具编译好，使用 `仅同步 DLL`。

如果希望 VSCode 扩展触发构建，配置 `build.mode` 后使用 `生成 DLL` 或 `构建并同步`。
其中 `生成 DLL` 只执行构建，不复制到 Unity；`构建并同步` 会先构建再同步。

如果希望复刻 Visual Studio 中“右键解决方案 -> 添加 -> 现有项目”的操作，先让 Unity 生成 `.sln`，再执行：

```text
Unity DLL Bridge: 添加工程到 Unity 解决方案
```

该命令会让你选择 Unity `.sln` 和外部 `.csproj`，然后执行类似：

```text
dotnet sln project.sln add gamelib.csproj
```

添加成功后会自动写入 `dllbridge.json`：`build.mode` 会设为 `dotnet`，`build.solutionPath` 指向 Unity `.sln`，`build.projectPath` 指向外部 `.csproj`，`projects[]` 会记录程序集名、输出目录和 Unity 目标目录。之后直接点击 `生成 DLL` 即可调用 `dotnet build <gamelib.csproj> -c Debug`。

如果不知道该选哪个文件夹，先执行 `Unity DLL Bridge: 自动发现项目`。它会生成 `.dllbridge/discovery-report.md`，列出附近的 Unity 工程、`.csproj`、`.sln` 和 DLL 输出目录。

如果配置、构建或同步出问题，执行 `Unity DLL Bridge: 一键诊断环境`。它会生成 `.dllbridge/environment-report.md`，检查 Unity 工程、Assets、`.sln`、`.csproj`、dotnet、MSBuild、主 DLL、PDB 和 VS PostBuildEvent，并给出中文建议。

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

配置为 `dotnet` 后，`生成 DLL` 和 `构建并同步` 都会执行类似下面的命令：

```text
dotnet build ../GameLogic/GameLogic.csproj -c Debug
```

扩展会按下面顺序自动查找 dotnet：

- `build.dotnetPath` 已配置时优先使用。
- PATH 中的 `dotnet`。
- `DOTNET_ROOT`、`DOTNET_ROOT_X64`、`DOTNET_ROOT_X86`。
- Windows/macOS/Linux 常见安装目录。

如果自动检测失败，不需要手写 JSON。执行：

```text
Unity DLL Bridge: 配置 dotnet 路径
```

可以选择 dotnet 安装文件夹，例如 `C:/Program Files/dotnet`，也可以直接选择 `dotnet.exe` / `dotnet` 可执行文件。

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

`msbuildPath` 为 `auto` 时，扩展会自动查找 Visual Studio Build Tools / MSBuild 常见安装目录；非 Windows 环境会尝试 `dotnet msbuild`。

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

## 自动构建

可以在配置中开启源码变化后自动构建并同步：

```json
{
  "watch": {
    "enabled": true,
    "debounceSeconds": 2
  }
}
```

也可以通过命令临时开关：

```text
Unity DLL Bridge: 开关自动构建同步
```

自动构建会监听 `sourceProject` 所在目录下的 `.cs` 文件变化，防止无关文件触发构建。

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
