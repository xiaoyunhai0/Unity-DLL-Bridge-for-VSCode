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

- 左侧 Activity Bar 提供 `DLL Bridge` 工作台，按 Visual Studio 的解决方案流程展示 Unity `.sln`、解决方案中的 `.csproj`、已配置 DLL 项目和输出状态。
- 状态栏提供常用操作入口。
- 支持选择 Unity 生成的 `.sln`，再添加外部 `gamelib.csproj`，添加成功后自动写入 `dllbridge.json`。
- 提供中文配置向导：选择 Unity 工程、外部 C# 工程文件夹、`.csproj` 或已有 DLL 输出文件夹后自动生成 `dllbridge.json`。
- 自动检测 dotnet：构建和添加解决方案时会检查 PATH、`DOTNET_ROOT` 和常见安装目录；检测不到时可在 VSCode 中选择 dotnet 安装文件夹。
- 一键诊断 Unity、`.sln`、`.csproj`、dotnet、MSBuild、DLL/PDB 环境。
- 自动发现附近 Unity 工程、C# 工程和 DLL 输出目录。
- 支持把外部 `.csproj` 加入 Unity 自动生成的 `.sln`，对应 Visual Studio 的“添加现有项目”。
- 支持打开 Unity 生成的 `.sln`。
- 生成多种 `dllbridge.json` 配置模板：只同步、dotnet、MSBuild、多项目。
- 支持 Debug / Release 等配置切换。
- `生成 DLL`：只在 VSCode 中调用 `dotnet`、`msbuild` 或自定义命令构建 DLL，不同步到 Unity。
- `仅同步 DLL`：同步已经由 Visual Studio、Build Tools 或内部工具生成的 DLL/PDB/XML/依赖 DLL。
- `构建并同步`：先构建外部 C# 工程，再同步产物到 Unity。
- 构建错误进入 VSCode Problems 面板，点击跳转源码行。
- 可监听外部 C# 源码变化后自动构建并同步。
- 可生成 Unity Editor 附加调试配置。
- 生成 `manifest.json`，记录同步时间、配置、文件大小和 SHA256。
- 生成 `.dllbridge/logs/latest.log` 和时间戳日志。
- 阻止源码复制：不会把 `.cs`、`.csproj`、`.sln`、`.props`、`.targets` 当作产物同步。

## 安装后在哪里看界面

安装 VSIX 后，VSCode 左侧 Activity Bar 会出现 `DLL Bridge` 图标。

点击后可以看到：

```text
Unity 解决方案
解决方案中的 C# 工程
已配置 DLL 项目和输出状态
错误 / 提醒列表
添加现有工程 / 生成 DLL / 生成并同步
编辑配置 / 诊断环境 / 日志入口
```

也可以打开命令面板，搜索 `Unity DLL Bridge` 使用全部命令。

如果还没有 `dllbridge.json`，优先点击左侧 `DLL Bridge` 页面里的 `添加现有工程`，选择 Unity `.sln` 和外部 `.csproj`。
如果配置有错误，左侧工作台会显示错误列表，并提供 `编辑配置` 按钮直接打开 `dllbridge.json` 修改。
如果 `dllbridge.json` 就放在 Unity 工程根目录，也就是和 `Assets`、`ProjectSettings` 同级，`unityProject` 应写成 `"."`，表示当前目录就是 Unity 工程，不能留空。

## 推荐流程

优先使用这条流程，它对应 Visual Studio 里的“打开 Unity 解决方案 -> 添加现有工程 -> 生成”：

1. 在 Unity 中双击任意脚本，让 Unity 生成项目 `.sln`。
2. 在 VSCode 中打开外部 C# 工程或工具工作区。
3. 打开左侧 `DLL Bridge` 插件页面。
4. 点击 `添加现有工程`，选择 Unity 生成的 `.sln`，再选择外部 `gamelib.csproj`。
5. 选择 DLL 同步目标目录。如果项目当前直接使用 `Assets/Plugins/GameLib.dll`，选择 `同步到 Assets/Plugins`；如果想隔离到子目录，可以选择 `Assets/Plugins/GameLib/Runtime` 或手动浏览。
6. 添加成功后，侧边栏会在 `解决方案中的工程` 显示 `gamelib`。
7. 点击项目里的 `生成 gamelib.dll`，或点击顶部 `生成 DLL`。
8. 需要复制到 Unity 时，再点击 `生成并同步到 Unity`。

这里的 `.csproj` 代表整个外部 C# 大项目，会编译该项目包含的很多 `.cs` 文件，不是只转换一个 `.cs` 文件。

如果不是解决方案流程，也可以执行 `配置向导`，依次选择 Unity 工程根目录、外部 C# 工程文件夹或已有 DLL 输出文件夹、Unity 目标目录。

如果不知道路径是否正确，执行 `自动发现项目` 或 `一键诊断环境`。

如果选择了 `dotnet build` 且机器没有配置 PATH，执行 `配置 dotnet 路径`，选择 dotnet 安装文件夹。

向导里路径应该这样选：

```text
Unity 工程根目录：包含 Assets 的目录
外部 C# 项目：优先选源码工程文件夹；.csproj 代表整个项目，不是单个 .cs 文件
DLL 输出：已有构建流程时选包含 DLL 的输出文件夹
Unity 目标目录：建议选 Assets/Plugins/<程序集名>/Runtime
```

## 命令说明

| 命令 | 作用 |
|---|---|
| `Unity DLL Bridge: 配置向导` | 选择 Unity 工程、C# 工程文件夹或 DLL 输出文件夹，自动生成 `dllbridge.json`。 |
| `Unity DLL Bridge: 创建配置模板` | 在当前工作区创建手写模板。 |
| `Unity DLL Bridge: 添加工程到 Unity 解决方案` | 将外部 `.csproj` 加入 Unity 自动生成的 `.sln`。 |
| `Unity DLL Bridge: 打开 Unity 解决方案` | 自动查找并打开 Unity 生成的 `.sln`。 |
| `Unity DLL Bridge: 自动发现项目` | 扫描附近 Unity 工程、C# 工程、解决方案和 DLL 输出目录。 |
| `Unity DLL Bridge: 一键诊断环境` | 生成环境诊断报告，检查 Unity、dotnet、MSBuild、DLL/PDB 等。 |
| `Unity DLL Bridge: 配置 dotnet 路径` | 自动检测失败时，选择 dotnet 安装文件夹或可执行文件。 |
| `Unity DLL Bridge: 选择 Debug/Release 配置` | 选择 Debug / Release 或其他配置。 |
| `Unity DLL Bridge: 校验配置` | 校验 Unity 工程路径、输出目录、目标目录和安全配置。 |
| `Unity DLL Bridge: 打开配置文件` | 打开 `dllbridge.json`，即使配置内容有错误也可以直接修改。 |
| `Unity DLL Bridge: 生成当前工程 DLL` | 从侧边栏项目卡片触发，按该项目的 `.csproj` 生成对应 DLL。 |
| `Unity DLL Bridge: 生成 DLL` | 执行配置的构建命令，不复制文件到 Unity。 |
| `Unity DLL Bridge: 仅同步 DLL` | 将已有 DLL/PDB/XML/依赖 DLL 同步到 Unity。 |
| `Unity DLL Bridge: 构建并同步` | 先执行构建命令，再同步产物到 Unity。 |
| `Unity DLL Bridge: 批量构建并同步` | 构建后同步配置中的所有 DLL 项目。 |
| `Unity DLL Bridge: 开关自动构建同步` | 监听外部 C# 源码变化后自动构建并同步。 |
| `Unity DLL Bridge: 生成 Unity 调试配置` | 生成 `.vscode/launch.json` 的 Unity Editor 附加调试入口。 |
| `Unity DLL Bridge: 打开同步日志` | 打开 `.dllbridge/logs/latest.log`。 |
| `Unity DLL Bridge: 打开 Manifest` | 打开 Unity 目标目录中的 `manifest.json`。 |

## 对应 Visual Studio 流程

Visual Studio 里的流程：

```text
选择 Unity 项目的解决方案
↓
添加现有项目 gamelib.csproj
↓
在解决方案里看到 gamelib
↓
点击生成
↓
生成 gamelib.dll
```

在本扩展中对应：

```text
Unity DLL Bridge: 添加工程到 Unity 解决方案
```

命令会让你选择 Unity `.sln` 和外部 `.csproj`，并执行：

```text
dotnet sln <Unity.sln> add <gamelib.csproj>
```

添加成功后会自动写入 `dllbridge.json`，侧边栏会显示解决方案里的 `gamelib`。点击 `生成 DLL` 会执行：

```text
dotnet build <gamelib.csproj> -c Debug
```

如果 `.csproj` 的生成后事件使用了 `$(SolutionDir)`，扩展会按 Unity `.sln` 自动补齐这个变量，避免出现 `*Undefined*Assets/Plugins`。

Visual Studio 的“生成后事件复制 DLL/PDB”对应本扩展的 `生成并同步到 Unity`。`copyPdb: true` 会同步 PDB，便于调试。

## 诊断与自动发现

不知道该选择哪个目录时，先执行：

```text
Unity DLL Bridge: 自动发现项目
```

它会生成 `.dllbridge/discovery-report.md`，列出附近的 Unity 工程、`.csproj`、`.sln` 和 DLL 输出目录。

出错时执行：

```text
Unity DLL Bridge: 一键诊断环境
```

它会生成 `.dllbridge/environment-report.md`，检查 Unity 工程、Assets、`.sln`、`.csproj`、dotnet、MSBuild、主 DLL、PDB 和 VS PostBuildEvent，并给出中文建议。

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

配置为 `dotnet` 后，`生成 DLL` 和 `构建并同步` 会执行类似命令：

```text
dotnet build ../GameLogic/GameLogic.csproj -c Debug
```

通常不需要手动填写 `build.dotnetPath`。扩展会自动检查 PATH、`DOTNET_ROOT`、`DOTNET_ROOT_X64`、`DOTNET_ROOT_X86` 和常见安装目录。若离线机器没有配置 PATH，执行：

```text
Unity DLL Bridge: 配置 dotnet 路径
```

然后选择 dotnet 安装文件夹，例如 `C:/Program Files/dotnet`，或直接选择 `dotnet.exe` / `dotnet`。

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

`msbuildPath` 为 `auto` 时，扩展会自动查找 Visual Studio Build Tools / MSBuild 常见安装目录；非 Windows 环境会尝试 `dotnet msbuild`。

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

也可以执行 `Unity DLL Bridge: 开关自动构建同步` 临时开关。自动构建只监听 `sourceProject` 所在目录下的 `.cs` 文件变化。

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
- 或在左侧 `DLL Bridge` 页面执行 `配置向导`，也可以执行 `创建配置模板` 后手动编辑。

`配置有错误但不知道怎么改`：

- 打开左侧 `DLL Bridge` 工作台。
- 查看顶部状态和“问题”区域的错误列表。
- 点击 `编辑配置` 直接打开 `dllbridge.json` 修改。
- 修改后点击 `重新校验` 或刷新面板。

`找不到主 DLL`：

- 先构建外部 C# 工程，或使用 `生成 DLL`。
- 检查 `assemblyName` 和当前配置的 `outputDir` 是否匹配真实输出。

`targetPluginPath 必须位于 Assets 内`：

- 将 `targetPluginPath` 设置到 Unity 工程的 `Assets` 目录下，推荐位于 `Assets/Plugins`。

`构建命令失败`：

- 执行 `Unity DLL Bridge: 打开同步日志` 查看详细日志。
- 检查当前机器是否安装 `dotnet`、`MSBuild.exe`，或自定义构建脚本是否可运行。
- 如果日志提示找不到 dotnet，执行 `Unity DLL Bridge: 配置 dotnet 路径`，选择 dotnet 安装文件夹或可执行文件。
