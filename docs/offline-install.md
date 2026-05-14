# 离线安装说明

## 适用场景

开发者在云端服务器或在线环境开发和打包工具，然后把 GitHub Release 产物交给离线电脑使用。

离线电脑不需要从源码构建，不需要运行 `npm install`。

## v0.1 Release 产物

```text
UnityDllBridge-VSCode-<version>.vsix
UnityDllBridge-Templates-<version>.zip
UnityDllBridge-UnityPlugin-<version>.zip
README-offline-install.md
checksums.txt
```

`<version>` 代表当前发布版本，实际文件名以 GitHub Release 中上传的文件为准。

## 安装 VSCode 扩展

1. 打开 VSCode。
2. 打开 Extensions 面板。
3. 点击右上角 `...`。
4. 选择 `Install from VSIX...`。
5. 选择 `UnityDllBridge-VSCode-<version>.vsix`。

安装完成后，VSCode 左侧 Activity Bar 会出现 `DLL Bridge` 图标。点击后可以看到配置状态、错误/提醒、项目摘要，以及创建配置、编辑配置、构建 DLL、同步、打开日志和打开 manifest 等操作。

## 配置项目

1. 在 VSCode 中打开目标工作区。
2. 执行 `Unity DLL Bridge: 配置向导`，或在左侧 `DLL Bridge` 工作台点击 `配置向导`。
3. 选择 Unity 工程根目录，也就是包含 `Assets` 的目录。
4. 选择外部 C# 工程文件夹。向导会在里面查找 `.csproj`，`.csproj` 代表整个 C# 项目，不是单个 `.cs` 文件。如果离线环境只拿到了 DLL 产物，也可以选择 DLL 输出文件夹。
5. 选择 Unity 目标目录，建议位于 `Assets/Plugins/<程序集名>/Runtime`。
6. 选择构建方式。离线或 Visual Studio 编译场景选“只同步已有 DLL”；如果离线机器已安装 dotnet SDK，可以选择 `dotnet build`。扩展会自动检测 dotnet，检测不到时可以在下一步选择 dotnet 安装文件夹。
7. 向导会生成 `dllbridge.json`，并自动填写 `unityProject`、`sourceProject`、`assemblyName`、`outputDir`、`copyAllDlls` 和 `targetPluginPath`。
8. 如果离线机器安装了 dotnet 但没有配置 PATH，执行 `Unity DLL Bridge: 配置 dotnet 路径`，选择 dotnet 安装文件夹或 `dotnet.exe`。
9. 如需把外部 `.csproj` 加入 Unity 自动生成的 `.sln`，执行 `Unity DLL Bridge: 添加工程到 Unity 解决方案`。
10. 如需切换 Debug / Release，执行 `Unity DLL Bridge: 选择 Debug/Release 配置`。
11. 在 VSCode 命令面板执行 `Unity DLL Bridge: 校验配置`。
12. 如果不知道路径是否正确，执行 `Unity DLL Bridge: 自动发现项目` 或 `Unity DLL Bridge: 一键诊断环境`。
13. 如果只想在 VSCode 中构建 DLL，不同步到 Unity，执行 `Unity DLL Bridge: 仅构建 DLL`。
14. 如果 DLL 已经由 Visual Studio 或内部工具编译好，执行 `Unity DLL Bridge: 仅同步 DLL`。
15. 如果已配置 `build.mode` 为 `dotnet`、`msbuild` 或 `custom`，并希望构建后同步，执行 `Unity DLL Bridge: 构建并同步`。
16. 多项目场景可执行 `Unity DLL Bridge: 批量构建并同步`。
17. 如需查看构建或同步日志，执行 `Unity DLL Bridge: 打开同步日志`。
18. 如需查看生成的 DLL 版本信息，执行 `Unity DLL Bridge: 打开 Manifest`。

手动模板仍然可用：执行 `Unity DLL Bridge: 创建配置模板`，或从模板包中复制 `dllbridge.single.json`、`dllbridge.dotnet.json`、`dllbridge.msbuild.json`、`dllbridge.multi.json`，重命名为 `dllbridge.json` 后放到工作区根目录。

安装扩展后，VSCode 状态栏会显示 `DLL Bridge` 或 `DLL Bridge: Debug`，点击后可以选择常用操作。
如果还没有 `dllbridge.json`，优先使用左侧 `DLL Bridge` 插件页面里的 `配置向导`。
如果配置有问题，左侧工作台会显示错误列表，点击 `编辑配置` 可以直接修改 `dllbridge.json`。

## 安装 Unity 插件

1. 解压 `UnityDllBridge-UnityPlugin-<version>.zip`。
2. 将其中的 `Assets/Editor/DllBridge/` 复制到 Unity 工程的 `Assets/Editor/DllBridge/`。
3. 回到 Unity，等待脚本编译完成。
4. 使用菜单 `Tools/DLL Bridge/Refresh` 手动刷新资源。
5. 使用菜单 `Tools/DLL Bridge/Show Current DLL Info` 查看 `Assets/Plugins/**/manifest.json`。

## 注意事项

- 默认使用 `syncOnly`，请先使用 Visual Studio、Build Tools 或公司内部工具生成 DLL。
- `添加工程到 Unity 解决方案` 需要离线机器能运行 `dotnet sln`。扩展会自动查找 dotnet；如果找不到，请执行 `Unity DLL Bridge: 配置 dotnet 路径`。
- 如需让扩展内部触发构建，可以配置 `build.mode` 为 `dotnet`、`msbuild` 或 `custom`，再执行 `仅构建 DLL` 或 `构建并同步`。`msbuildPath: auto` 会自动查找 Visual Studio Build Tools / MSBuild 常见安装目录。
- 构建失败时，错误会进入 VSCode Problems 面板，能点击跳转源码行。
- 可执行 `Unity DLL Bridge: 生成 Unity 调试配置` 创建 `.vscode/launch.json` 的 Unity Editor 附加调试入口。
- 默认不会复制 `.cs`、`.csproj`、`.sln` 等源码文件。
- 同步日志写入当前工作区 `.dllbridge/logs/`，该目录不需要提交到 Git。
- `manifest.json` 会写入 Unity 目标插件目录，用于记录当前 DLL、PDB、XML 和依赖 DLL 的 hash。
- Unity 插件只放在 `Assets/Editor/DllBridge/`，不会进入运行时构建。
