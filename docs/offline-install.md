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
2. 执行 `Unity DLL Bridge: Create Config Template` 生成 `dllbridge.json`。
3. 也可以从模板包中复制 `dllbridge.single.json`，重命名为 `dllbridge.json` 后放到工作区根目录。
4. 修改 `unityProject`、`outputDir`、`targetPluginPath` 和 `assemblyName`。
5. 如需切换 Debug / Release，执行 `Unity DLL Bridge: Select Configuration`。
6. 在 VSCode 命令面板执行 `Unity DLL Bridge: Validate Configuration`。
7. 如果只想在 VSCode 中构建 DLL，不同步到 Unity，执行 `Unity DLL Bridge: Build DLL Only`。
8. 如果 DLL 已经由 Visual Studio 或内部工具编译好，执行 `Unity DLL Bridge: Sync Only`。
9. 如果已配置 `build.mode` 为 `dotnet`、`msbuild` 或 `custom`，并希望构建后同步，执行 `Unity DLL Bridge: Build & Sync`。
10. 如需查看构建或同步日志，执行 `Unity DLL Bridge: Open Sync Log`。
11. 如需查看生成的 DLL 版本信息，执行 `Unity DLL Bridge: Open Manifest`。

安装扩展后，VSCode 状态栏会显示 `DLL Bridge` 或 `DLL Bridge: Debug`，点击后可以选择常用操作。
如果还没有 `dllbridge.json`，优先使用左侧 `DLL Bridge` 插件页面里的 `Create Config Template`。
如果配置有问题，左侧工作台会显示错误列表，点击 `编辑配置` 可以直接修改 `dllbridge.json`。

## 安装 Unity 插件

1. 解压 `UnityDllBridge-UnityPlugin-<version>.zip`。
2. 将其中的 `Assets/Editor/DllBridge/` 复制到 Unity 工程的 `Assets/Editor/DllBridge/`。
3. 回到 Unity，等待脚本编译完成。
4. 使用菜单 `Tools/DLL Bridge/Refresh` 手动刷新资源。
5. 使用菜单 `Tools/DLL Bridge/Show Current DLL Info` 查看 `Assets/Plugins/**/manifest.json`。

## 注意事项

- 默认使用 `syncOnly`，请先使用 Visual Studio、Build Tools 或公司内部工具生成 DLL。
- 如需让扩展内部触发构建，可以配置 `build.mode` 为 `dotnet`、`msbuild` 或 `custom`，再执行 `Build DLL Only` 或 `Build & Sync`。
- 默认不会复制 `.cs`、`.csproj`、`.sln` 等源码文件。
- 同步日志写入当前工作区 `.dllbridge/logs/`，该目录不需要提交到 Git。
- `manifest.json` 会写入 Unity 目标插件目录，用于记录当前 DLL、PDB、XML 和依赖 DLL 的 hash。
- Unity 插件只放在 `Assets/Editor/DllBridge/`，不会进入运行时构建。
