# 离线安装说明

## 适用场景

开发者在云端服务器或在线环境开发和打包工具，然后把 GitHub Release 产物交给离线电脑使用。

离线电脑不需要从源码构建，不需要运行 `npm install`。

## v0.1 Release 产物

```text
UnityDllBridge-VSCode-0.1.0.vsix
UnityDllBridge-Templates-0.1.0.zip
README-offline-install.md
checksums.txt
```

## 安装 VSCode 扩展

1. 打开 VSCode。
2. 打开 Extensions 面板。
3. 点击右上角 `...`。
4. 选择 `Install from VSIX...`。
5. 选择 `UnityDllBridge-VSCode-0.1.0.vsix`。

## 配置项目

1. 从模板包中复制 `dllbridge.single.json`。
2. 重命名为 `dllbridge.json`。
3. 放到 VSCode 工作区根目录。
4. 修改 `unityProject`、`outputDir`、`targetPluginPath` 和 `assemblyName`。
5. 在 VSCode 命令面板执行 `Unity DLL Bridge: Validate Configuration`。

## 注意事项

- v0.1 只支持 `syncOnly`，不负责自动编译 C# Project。
- 请先使用 Visual Studio、Build Tools 或公司内部工具生成 DLL。
- 默认不会复制 `.cs`、`.csproj`、`.sln` 等源码文件。
