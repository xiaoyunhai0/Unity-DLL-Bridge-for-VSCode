# Unity DLL Bridge 离线安装说明

## 适用场景

在线环境负责开发、打包和上传 Release，离线电脑只下载安装包使用。离线电脑不需要从源码构建，也不需要运行 `npm install`。

## 正式版 Release 产物

```text
UnityDllBridge-VSCode-<version>.vsix
UnityDllBridge-Templates-<version>.zip
UnityDllBridge-UnityPlugin-<version>.zip
README-offline-install.md
checksums.txt
```

`checksums.txt` 记录每个产物的 SHA256，可用于离线传输后校验文件完整性。

## 安装 VSCode 扩展

1. 打开 VSCode。
2. 打开 Extensions 面板。
3. 点击右上角 `...`。
4. 选择 `Install from VSIX...`。
5. 选择 `UnityDllBridge-VSCode-<version>.vsix`。
6. 安装完成后，左侧 Activity Bar 会出现 `DLL Bridge` 图标。

点击 `DLL Bridge` 后，可以看到 Unity 解决方案、解决方案工程、已配置 DLL 工程、输出状态、问题列表，以及添加工程、生成 DLL、同步、诊断和日志入口。

## 推荐配置流程

优先使用“添加现有工程”，它最接近 Visual Studio 的操作方式。

第一次使用前，先让 Unity 生成解决方案文件。推荐在 Unity 里把 External Script Editor 设置为 Visual Studio，然后双击任意 C# 脚本；Unity 会在工程根目录生成或刷新 `project.sln` 和 Unity 自己的 `.csproj`。如果工程根目录还没有 `.sln`，先完成这一步。

1. 确认 Unity 工程根目录已经存在 `.sln`，例如 `E:\Unity\project\project-main\project\project.sln`。
2. 在 VSCode 中打开外部 C# 工程或工具工作区。
3. 点击左侧 `DLL Bridge`。
4. 点击 `添加现有工程`。
5. 选择 Unity 生成的 `.sln`。
6. 选择外部 C# 工程 `.csproj`。
7. 选择 DLL 同步目标目录，例如 `Assets/Plugins`。
8. 添加成功后，确认工作台中出现对应工程。
9. 点击 `生成 DLL` 只构建 DLL。
10. 需要复制到 Unity 时，点击 `构建并同步` 或 `仅同步 DLL`。

路径示例：

```text
Unity 工程：
E:\Unity\project\project-main\project

Unity 解决方案：
E:\Unity\project\project-main\project\project.sln

外部 C# 工程：
E:\Unity\project\gamelib-main\gamelib\GameLib.csproj

同步目标：
E:\Unity\project\project-main\project\Assets\Plugins
```

如果找不到 `project.sln`，回到 Unity 双击一个脚本，或执行 Unity 的重新生成项目文件操作。生成后再执行 `添加现有工程`。

如果不走 Unity `.sln` 流程，也可以执行：

```text
Unity DLL Bridge: 配置向导
```

向导会让你选择：

- Unity 工程根目录：包含 `Assets` 的目录。
- 外部 C# 工程：工程文件夹或 `.csproj`。
- DLL 输出目录：已有 DLL 产物时选择包含 DLL 的文件夹。
- Unity 目标目录：建议位于 `Assets/Plugins`。
- 构建方式：`syncOnly`、`dotnet`、`msbuild` 或 `custom`。

如果 `dllbridge.json` 就在 Unity 工程根目录，`unityProject` 应写成 `"."`，不能留空。

## dotnet 和 MSBuild

扩展会自动查找 dotnet：

- 配置里的 `build.dotnetPath`。
- PATH 中的 `dotnet`。
- `DOTNET_ROOT`、`DOTNET_ROOT_X64`、`DOTNET_ROOT_X86`。
- Windows/macOS/Linux 常见安装目录。

如果离线机器安装了 dotnet 但 PATH 没配好，执行：

```text
Unity DLL Bridge: 配置 dotnet 路径
```

可以选择 dotnet 安装目录，例如：

```text
C:\Program Files\dotnet
```

也可以直接选择 `dotnet.exe`。

MSBuild 构建模式中，`msbuildPath: "auto"` 会自动查找 Visual Studio Build Tools / MSBuild 常见安装目录。非 Windows 环境会尝试 `dotnet msbuild`。

## 安装 Unity Editor 插件

1. 解压 `UnityDllBridge-UnityPlugin-<version>.zip`。
2. 将其中的 `Assets/Editor/DllBridge/` 复制到 Unity 工程的 `Assets/Editor/DllBridge/`。
3. 回到 Unity，等待脚本编译完成。
4. 使用菜单 `Tools/DLL Bridge/Refresh` 手动刷新资源。
5. 使用菜单 `Tools/DLL Bridge/Show Current DLL Info` 查看 `Assets/Plugins/**/manifest.json`。
6. 使用菜单 `Tools/DLL Bridge/Open Plugins Folder` 打开 Unity 插件目录。

Unity 插件只放在 `Assets/Editor/DllBridge/`，不会进入运行时构建。

## 常用命令

```text
Unity DLL Bridge: 添加工程到 Unity 解决方案
Unity DLL Bridge: 打开 Unity 解决方案
Unity DLL Bridge: 配置向导
Unity DLL Bridge: 自动发现项目
Unity DLL Bridge: 一键诊断环境
Unity DLL Bridge: 配置 dotnet 路径
Unity DLL Bridge: 选择 Debug/Release 配置
Unity DLL Bridge: 校验配置
Unity DLL Bridge: 生成 DLL
Unity DLL Bridge: 仅同步 DLL
Unity DLL Bridge: 构建并同步
Unity DLL Bridge: 批量构建并同步
Unity DLL Bridge: 打开同步日志
Unity DLL Bridge: 打开 Manifest
```

## 常见问题

`生成 DLL 成功但 Unity 没更新`

`生成 DLL` 只构建，不复制。需要复制到 Unity 时，执行 `构建并同步` 或 `仅同步 DLL`。如果外部 `.csproj` 自己的 PostBuildEvent 已经复制 DLL，也可以只使用 `生成 DLL`。

`*Undefined*Assets\Plugins`

外部 `.csproj` 的 PostBuildEvent 用到了 `$(SolutionDir)`，但直接构建 `.csproj` 时该变量可能为空。正式版会根据 Unity `.sln` 自动传入 `SolutionDir`、`SolutionPath`、`SolutionFileName`、`SolutionName` 和 `SolutionExt`。

`命令语法不正确`

Windows `copy` 命令对路径格式敏感。正式版会使用 Windows 反斜杠格式传入 `SolutionDir`，例如 `E:\Unity\project\project-main\project\`。

`ReYunSDK 未能解析`

这是外部 C# 工程的引用警告。如果最终显示 `0 个错误` 和 `Build exit code: 0`，DLL 已经生成成功。如果代码确实依赖该程序集，需要在外部工程中补齐引用。

`targetPluginPath 必须位于 Assets 内`

同步目标必须位于 Unity 工程的 `Assets` 目录下，推荐使用 `Assets/Plugins` 或 `Assets/Plugins/<程序集名>/Runtime`。

## 安全说明

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
