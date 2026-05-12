# Unity DLL Bridge for VSCode 开发文档

## 1. 项目背景

公司实际项目中，为了权限管理，C# 业务代码不直接放在 Unity 工程里。

当前开发模式可以理解为：

```text
独立 Visual Studio / C# Project
↓
编译生成 DLL
↓
复制 DLL 到 Unity 工程
↓
Unity 引用 DLL 运行
```

也就是说，Unity 工程只消费编译产物，不直接暴露业务源码。

这个工具的目标不是重新发明一个 C# 编译器，也不是马上替代公司已有的 Visual Studio 编译流程，而是先把 **已有 DLL 产物安全、可追踪、可重复地同步到 Unity 工程**。

后续版本再逐步接入 MSBuild / dotnet，让 VSCode 内部也能一键 Build & Sync。

## 2. 工具定位

项目名称建议：**Unity DLL Bridge for VSCode**。

一句话定位：

> 一个离线可用的 VSCode 扩展 + 可选 Unity Editor 插件，用于把独立 C# 工程生成的 DLL/PDB/XML 安全同步到 Unity 工程，并提供配置校验、版本记录、日志和权限隔离保护。

第一版重点是：

- 不复制源码。
- 不改变公司现有编译方式。
- 不要求使用者敲命令行。
- 不要求 Unity 工程拥有 C# 源码权限。
- 能稳定把 DLL 放到正确位置。
- 能知道当前 Unity 工程里用的是哪一版 DLL。

## 3. 用户场景

### 3.1 当前人工流程

开发者现在可能需要：

1. 在独立 C# Project 中修改代码。
2. 使用 Visual Studio 或现有内部工具编译 DLL。
3. 找到输出目录。
4. 手动复制 DLL 到 Unity 工程。
5. 如果需要调试，再复制 PDB。
6. 打开或切回 Unity，手动刷新资源。
7. 如果 DLL 没生效，需要猜是复制错了、路径错了、配置错了还是 Unity 没刷新。

### 3.2 工具解决的问题

工具优先解决：

- DLL 手动复制容易漏。
- Debug / Release 产物容易混。
- PDB 是否复制没有统一规则。
- 多个 DLL 工程时目标路径难管理。
- Unity 工程里不知道当前 DLL 来源。
- 离线电脑安装和使用复杂。
- 权限隔离场景下，源码不能进入 Unity 工程。

工具暂时不优先解决：

- 替代 Visual Studio 的完整开发体验。
- 自动生成或修改公司项目结构。
- 自动混淆 DLL。
- 自动上传制品库。
- 复杂依赖图分析。

## 4. 产品形态

工具由两部分组成：

```text
unity-dll-bridge/
├─ vscode-extension/       # VSCode 扩展，主要操作入口
├─ unity-plugin/           # 可选 Unity Editor 插件，负责刷新和查看信息
├─ templates/              # 配置模板
├─ docs/                   # 使用文档和离线安装文档
└─ samples/                # 示例外部 C# 工程和 Unity 工程
```

开发环境和交付环境要明确分开：

```text
云端服务器 / 在线开发环境
↓
开发、测试、打包 VSCode 扩展
↓
推送源码到 GitHub
↓
手动创建 GitHub Release 并上传离线产物
↓
离线电脑只下载 Release 产物使用
```

离线使用者不需要从源码构建，也不需要运行 `npm install`。

### 4.1 VSCode 扩展

VSCode 扩展是第一优先级，负责：

- 读取 `dllbridge.json`。
- 校验配置路径。
- 从外部 C# 工程输出目录读取 DLL/PDB/XML。
- 复制产物到 Unity 指定目录。
- 生成 `manifest.json`。
- 输出同步日志。
- 提供 `Sync Only`、`Validate Configuration`、`Open Manifest`、`Open Log` 等命令。
- 打包成 VSIX，支持离线安装。

### 4.2 Unity Editor 插件

Unity 插件是增强体验，不应阻塞 v0.1。

第一版只需要：

- 提供菜单 `Tools/DLL Bridge/Refresh`。
- 调用 `AssetDatabase.Refresh()`。
- 可选查看 `manifest.json`。

后续版本再做：

- 自动监听刷新信号。
- DLL 引用检查。
- Runtime / Editor DLL 校验。
- Unity 版本兼容提示。

## 5. v0.1 范围

v0.1 的核心是 **Sync Only**。

第一版不要求工具负责编译 C# Project。使用者可以继续用 Visual Studio、Build Tools、公司内部脚本或 CI 生成 DLL。

### 5.1 v0.1 必做功能

v0.1 必须做到：

1. VSCode 中执行 `Unity DLL Bridge: Sync Only`。
2. 读取 `dllbridge.json`。
3. 校验外部 DLL 是否存在。
4. 校验 Unity 工程和目标目录是否存在。
5. 复制 `.dll`。
6. Debug 配置下可复制 `.pdb`。
7. 可选复制 `.xml`。
8. 默认不复制 `.cs/.csproj/.sln`。
9. 生成 `manifest.json`。
10. 输出同步日志。
11. Unity 中可以手动 Refresh。
12. VSCode 扩展可以打成 VSIX 离线安装。

### 5.2 v0.1 不做功能

第一版不做：

- 自动编译 C# Project。
- 自动寻找所有 DLL。
- 自动刷新 Unity。
- Webview Dashboard。
- 多项目复杂 UI。
- DLL 深度依赖分析。
- 自动修改 Unity asmdef。
- 自动打权限分发包。

这些能力有价值，但都应该放到后续版本。

## 6. 推荐使用流程

### 6.1 开发者流程

```text
1. 用 Visual Studio 或现有内部工具编译外部 C# Project
2. 在 VSCode 中打开含 dllbridge.json 的工作区
3. 执行 Unity DLL Bridge: Validate Configuration
4. 执行 Unity DLL Bridge: Sync Only
5. 工具复制 DLL/PDB/XML 到 Unity 工程
6. 工具生成 manifest.json 和日志
7. 在 Unity 菜单中执行 Tools/DLL Bridge/Refresh
```

### 6.2 离线电脑使用流程

```text
1. 从 GitHub Release 下载 VSIX、模板和离线安装说明
2. VSCode -> Extensions -> Install from VSIX
3. Unity 导入 unitypackage 或复制 Editor 插件目录
4. 在工作区放置 dllbridge.json
5. 配置 DLL 输出目录和 Unity 目标目录
6. 执行 Validate Configuration
7. 执行 Sync Only
8. Unity 手动 Refresh
```

### 6.3 关于“不用 CLI”

最终使用者不需要手动敲命令。

允许工具内部在后续版本调用 MSBuild / dotnet / 自定义脚本，但产品入口必须是 VSCode 命令、按钮或菜单。

开发者可以在云端服务器或在线环境使用 npm 进行构建和打包，但离线使用者只安装 GitHub Release 中的 `.vsix`。

### 6.4 GitHub Release 交付流程

v0.1 先采用本地打包、手动上传 Release 的方式：

```text
npm install
npm run compile
npm run package
```

Release 建议包含：

```text
UnityDllBridge-VSCode-0.1.0.vsix
UnityDllBridge-Templates-0.1.0.zip
README-offline-install.md
checksums.txt
```

后续加入 Unity 插件后再补充：

```text
UnityDllBridge-UnityPlugin-0.1.0.zip
UnityDllBridge-UnityPlugin-0.1.0.unitypackage
```

v0.1 不强制做 GitHub Actions 自动 Release。自动化发布可以放到 v0.2，在 MVP 稳定后再处理版本号、artifact 和 checksum。

## 7. 配置文件设计

配置文件名：

```text
dllbridge.json
```

查找位置：

```text
当前工作区/dllbridge.json
当前工作区/.dllbridge/dllbridge.json
```

路径解析规则：

```text
所有相对路径都相对 dllbridge.json 所在目录解析。
不要相对 VSCode 进程目录解析。
```

### 7.1 v0.1 配置示例

```json
{
  "version": 1,
  "name": "MyUnityGame",
  "unityProject": "../UnityClient",
  "defaultConfiguration": "Debug",
  "build": {
    "mode": "syncOnly"
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
          "dependencies": [
            "../Shared/bin/Debug/netstandard2.1/SharedRuntime.dll"
          ]
        },
        "Release": {
          "outputDir": "../GameLogic/bin/Release/netstandard2.1",
          "copyPdb": false,
          "copyXml": false,
          "backupBeforeOverwrite": true,
          "dependencies": [
            "../Shared/bin/Release/netstandard2.1/SharedRuntime.dll"
          ]
        }
      }
    }
  ]
}
```

### 7.2 后续构建配置示例

后续版本再加入构建能力：

```json
{
  "build": {
    "mode": "msbuild",
    "solutionPath": "../GameLogic/GameLogic.sln",
    "projectPath": "../GameLogic/GameLogic.csproj",
    "msbuildPath": "auto",
    "timeoutSeconds": 120
  }
}
```

支持模式：

```text
syncOnly
msbuild
dotnet
custom
```

v0.1 只要求 `syncOnly`。

### 7.3 字段说明

| 字段 | 说明 |
|---|---|
| version | 配置版本，便于以后升级 |
| name | 当前桥接配置名称 |
| unityProject | Unity 工程路径 |
| defaultConfiguration | 默认配置，例如 Debug / Release |
| build.mode | 构建模式，v0.1 固定使用 syncOnly |
| privacy.hideAbsolutePathsInManifest | manifest 是否隐藏绝对路径 |
| projects | 外部 C# 工程列表 |
| sourceProject | 源工程路径，只用于记录和校验，不复制到 Unity |
| assemblyName | 输出 DLL 名称，不含 `.dll` |
| targetPluginPath | Unity 中 DLL 目标目录 |
| outputDir | DLL/PDB/XML 输出目录 |
| copyPdb | 是否复制 PDB |
| copyXml | 是否复制 XML 文档 |
| backupBeforeOverwrite | 覆盖前是否备份旧 DLL |
| dependencies | 需要一起复制的依赖 DLL，建议显式配置 |
| allowSourceCopy | 是否允许复制源码，默认必须为 false |

## 8. VSCode 命令

v0.1 提供：

```text
Unity DLL Bridge: Sync Only
Unity DLL Bridge: Validate Configuration
Unity DLL Bridge: Open Manifest
Unity DLL Bridge: Open Sync Log
```

v0.2 再提供：

```text
Unity DLL Bridge: Build & Sync Debug
Unity DLL Bridge: Build & Sync Release
Unity DLL Bridge: Select Configuration
Unity DLL Bridge: Create Config Template
Unity DLL Bridge: Clean Target DLLs
```

## 9. 同步规则

### 9.1 允许复制的文件

默认只允许复制：

```text
.dll
.pdb
.xml
.json
```

其中：

- `.dll` 必须复制。
- `.pdb` Debug 默认复制，Release 默认不复制。
- `.xml` 可选复制。
- `.json` 仅用于 manifest 或同步报告。

### 9.2 禁止复制的文件

默认禁止复制：

```text
.cs
.csproj
.sln
.props
.targets
.user
.suo
```

如果扫描到源目录中有这些文件，不报错，但不能复制到 Unity。

如果配置里显式要求复制源码，工具应拒绝执行，并提示：

```text
当前配置会把源码复制到 Unity 工程，已被权限保护策略阻止。
```

### 9.3 覆盖和备份

复制 DLL 前，如果目标目录已经存在旧 DLL，且 `backupBeforeOverwrite` 为 true，则备份到：

```text
Assets/Plugins/GameLogic/.dllbridge-backup/2026-05-12_103000/
```

如果 Unity 正在占用 DLL，复制失败时提示：

```text
无法覆盖 GameLogic.dll，Unity 可能正在占用该文件。
请退出 Play Mode 或关闭 Unity 后重试。
```

### 9.4 多 DLL 依赖

第一版至少支持显式声明依赖 DLL：

```json
{
  "dependencies": [
    "../GameLogic/bin/Debug/netstandard2.1/Newtonsoft.Json.dll",
    "../Shared/bin/Debug/netstandard2.1/SharedRuntime.dll"
  ]
}
```

工具不要在 v0.1 自动猜测所有依赖，否则容易误复制内部 DLL 或测试 DLL。

## 10. manifest 设计

每次同步后，在目标目录生成：

```text
manifest.json
```

示例：

```json
{
  "tool": "Unity DLL Bridge for VSCode",
  "manifestVersion": 1,
  "name": "GameLogic",
  "assemblyName": "GameLogic.dll",
  "configuration": "Debug",
  "syncTime": "2026-05-12T10:30:00Z",
  "sourceProject": "../GameLogic/GameLogic.csproj",
  "targetPath": "Assets/Plugins/GameLogic/Runtime/GameLogic.dll",
  "privacy": {
    "absolutePathsHidden": true
  },
  "files": [
    {
      "name": "GameLogic.dll",
      "sha256": "...",
      "size": 102400
    },
    {
      "name": "GameLogic.pdb",
      "sha256": "...",
      "size": 204800
    }
  ],
  "git": null
}
```

manifest 用途：

- Unity 中查看当前 DLL 信息。
- 测试人员记录当前版本。
- 排查“代码改了但 Unity 没变化”的问题。
- 离线环境核对 hash。

注意：

- 默认不写绝对路径。
- Git 信息获取失败不能导致同步失败。
- dirty 状态只作为参考，不作为 v0.1 阻断条件。

## 11. 日志设计

日志输出到：

```text
.dllbridge/logs/latest.log
.dllbridge/logs/2026-05-12_103000.log
```

日志示例：

```text
[10:30:00] Load config: dllbridge.json
[10:30:00] Mode: syncOnly
[10:30:00] Project: GameLogic
[10:30:00] Configuration: Debug
[10:30:00] Check source DLL: ../GameLogic/bin/Debug/netstandard2.1/GameLogic.dll
[10:30:01] Backup old DLL
[10:30:01] Copy GameLogic.dll
[10:30:01] Copy GameLogic.pdb
[10:30:01] Write manifest.json
[10:30:01] Done
```

日志要求：

- 人能读懂。
- 错误信息要指向具体配置字段。
- 后续可以被程序解析。

## 12. Unity 插件设计

### 12.1 v0.1 菜单

Unity 插件第一版只提供：

```text
Tools/DLL Bridge/Refresh
Tools/DLL Bridge/Show Current DLL Info
```

刷新代码：

```csharp
using UnityEditor;
using UnityEngine;

public static class DllBridgeMenu
{
    [MenuItem("Tools/DLL Bridge/Refresh")]
    public static void Refresh()
    {
        AssetDatabase.Refresh();
        Debug.Log("[DLL Bridge] AssetDatabase.Refresh completed.");
    }
}
```

### 12.2 后续自动刷新

v0.2 再加入自动刷新信号：

```text
Assets/Plugins/.dllbridge-refresh
Assets/Plugins/.dllbridge-refresh-ack
```

逻辑：

```text
VSCode 同步完成
↓
写 refresh signal
↓
Unity 每 1 秒低频检测
↓
发现变化后 AssetDatabase.Refresh()
↓
写 ack
```

不要每帧刷新 Unity。

## 13. Unity DLL 兼容性要求

由于目标是 Unity 使用外部 DLL，文档必须明确这些风险。

### 13.1 目标框架

外部 C# Project 的目标框架应与 Unity 项目的 Api Compatibility Level 匹配。

常见情况：

```text
Unity 2021/2022/2023 项目通常需要关注 .NET Standard 2.0 / 2.1 或 .NET Framework 兼容性。
```

工具 v0.1 不强制判断，但配置校验可以提示：

```text
请确认 GameLogic.dll 的 Target Framework 与 Unity Player Settings 中的 Api Compatibility Level 兼容。
```

### 13.2 Runtime / Editor 分离

推荐目录：

```text
Assets/Plugins/GameLogic/Runtime/GameLogic.dll
Assets/Plugins/GameLogic/Editor/GameLogic.Editor.dll
```

规则：

- Runtime DLL 不允许引用 `UnityEditor.dll`。
- Editor DLL 可以引用 `UnityEditor.dll`，但必须放在 Editor 目录。
- 业务 Runtime DLL 不应引用测试 DLL。

v0.1 只写入提醒，v0.3 再做自动检查。

### 13.3 第三方依赖

如果 `GameLogic.dll` 依赖第三方 DLL，必须同步依赖 DLL，否则 Unity 可能运行时报错。

v0.1 推荐显式配置依赖，不自动扫描。

### 13.4 PDB 和调试信息

Debug：

- 可以复制 PDB，方便断点和异常堆栈。

Release：

- 默认不复制 PDB。
- 如果要给外部测试或非源码权限人员使用，建议不带 PDB 和 XML。

## 14. 安全与权限设计

这是本项目最重要的约束。

### 14.1 源码隔离

工具默认只同步编译产物，不同步源码。

禁止进入 Unity 工程的内容：

```text
.cs
.csproj
.sln
.props
.targets
源码目录结构
用户本地配置
```

### 14.2 路径隐私

manifest 默认隐藏绝对路径。

原因：

- 绝对路径可能暴露内部项目结构。
- 绝对路径可能包含用户名。
- 离线分发时不应该泄漏开发机目录。

### 14.3 Debug / Release 权限包

后续版本可以提供两种分发包：

Internal Debug 包：

```text
GameLogic.dll
GameLogic.pdb
GameLogic.xml
manifest.json
```

External Release 包：

```text
GameLogic.dll
manifest.json
checksums.txt
```

v0.1 暂不实现自动打包，但文档和配置要为它留位置。

## 15. 错误提示

错误提示要面向普通使用者，不要只抛底层异常。

### 15.1 配置文件不存在

```text
没有找到 dllbridge.json。
请在当前工作区根目录或 .dllbridge 目录下创建配置文件。
```

### 15.2 DLL 不存在

```text
没有找到 GameLogic.dll。
请检查 projects[0].configurations.Debug.outputDir 是否正确：
../GameLogic/bin/Debug/netstandard2.1
```

### 15.3 Unity 工程路径错误

```text
没有找到 Unity 工程 Assets 目录。
请检查 unityProject 是否指向正确的 Unity 工程根目录。
```

### 15.4 目标目录不在 Unity 工程内

```text
targetPluginPath 不在 unityProject 目录内。
为避免误复制，请把目标目录设置到 Unity 工程的 Assets 目录下。
```

### 15.5 构建工具缺失

这是 v0.2 之后才需要的提示：

```text
没有找到 MSBuild 或 dotnet。
你可以安装 Visual Studio Build Tools，或将 build.mode 改为 syncOnly，只同步已经编译好的 DLL。
```

## 16. 技术架构

### 16.1 VSCode 扩展目录

```text
vscode-extension/
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ extension.ts
│  ├─ commands/
│  │  ├─ syncOnly.ts
│  │  ├─ validate.ts
│  │  ├─ openManifest.ts
│  │  └─ openLog.ts
│  ├─ config/
│  │  ├─ loadConfig.ts
│  │  └─ schema.ts
│  ├─ sync/
│  │  ├─ copyArtifacts.ts
│  │  ├─ manifest.ts
│  │  └─ hash.ts
│  ├─ validation/
│  │  └─ validateConfig.ts
│  └─ utils/
│     ├─ pathUtils.ts
│     ├─ fileUtils.ts
│     └─ logger.ts
└─ README.md
```

v0.2 再增加：

```text
src/build/
├─ buildRunner.ts
├─ msbuildRunner.ts
├─ dotnetRunner.ts
└─ customRunner.ts
```

### 16.2 Unity 插件目录

```text
unity-plugin/
└─ Assets/
   └─ Editor/
      └─ DllBridge/
         ├─ DllBridgeMenu.cs
         └─ DllBridgeManifestWindow.cs
```

v0.2 再增加：

```text
DllBridgeWatcher.cs
DllBridgeSettings.cs
```

v0.3 再增加：

```text
DllBridgeValidator.cs
```

## 17. 路线图

### 17.1 第 1 周：Sync Only 原型

目标：先跑通“已有 DLL -> Unity”的同步流程。

任务：

- 创建 VSCode Extension 项目。
- 注册 `Sync Only` 命令。
- 读取 `dllbridge.json`。
- 校验路径。
- 复制 DLL/PDB/XML。
- 生成 `manifest.json`。
- 输出 `latest.log`。
- 添加 Unity 手动 Refresh 菜单。

验收：

```text
用 Visual Studio 编译 DLL 后，点击 VSCode 命令可以把 DLL 复制到 Unity 工程，并生成 manifest。
```

### 17.2 第 2 周：体验补齐

目标：让团队能稳定使用。

任务：

- 增加配置模板生成。
- 增加状态栏入口。
- 增加更清楚的错误提示。
- 支持备份旧 DLL。
- 支持显式依赖 DLL。
- 完善离线安装文档。

验收：

```text
换一台离线电脑，通过 VSIX + Unity 插件 zip 可以完成安装和同步。
```

### 17.3 第 3 周：构建接入

目标：在不破坏现有流程的前提下接入构建能力。

任务：

- 支持 msbuild 模式。
- 支持 dotnet 模式。
- 支持 custom 命令。
- 输出构建日志。
- 构建失败时显示错误。

验收：

```text
在 VSCode 中执行 Build & Sync Debug，可以调用外部构建工具并同步 DLL。
```

### 17.4 第 4 周：Unity 联动和校验

目标：减少 Unity 侧误用。

任务：

- 实现 refresh signal。
- Unity 自动低频检测刷新。
- Unity 显示 manifest。
- 初步检查 Runtime / Editor DLL 目录。
- 提醒 UnityEditor 引用风险。

验收：

```text
VSCode 同步后，Unity 能自动刷新，并能查看当前 DLL 信息。
```

## 18. MVP 验收标准

最小可交付版本必须满足：

```text
1. 可以读取 dllbridge.json。
2. 可以校验 Unity 工程路径。
3. 可以校验外部 DLL 输出路径。
4. 可以把 GameLogic.dll 复制到 Unity 指定目录。
5. Debug 下可以复制 GameLogic.pdb。
6. 可以生成 manifest.json。
7. 可以生成 latest.log。
8. 默认不会复制任何源码文件。
9. Unity 可以手动 Refresh。
10. VSCode 扩展可以打成 VSIX 离线安装。
```

## 19. 优先级

最高优先级：

```text
配置读取 -> 路径校验 -> Sync Only -> manifest -> 日志 -> VSIX 离线安装
```

第二优先级：

```text
备份旧 DLL -> 显式依赖 DLL -> 状态栏入口 -> Unity manifest 查看
```

第三优先级：

```text
Build & Sync -> Unity 自动刷新 -> 错误跳转 -> 多项目 UI
```

第四优先级：

```text
DLL 引用检查 -> Runtime/Editor 自动校验 -> 分发包 -> Dashboard
```

## 20. 最终建议

这个工具应该优先做成 **权限隔离场景下的 DLL 流程工具**，不是编译器。

最关键的价值是：

- 保持 C# 源码和 Unity 工程隔离。
- 统一 DLL 同步流程。
- 减少 Debug / Release 混用。
- 让 Unity 工程知道当前 DLL 来源。
- 降低离线环境安装和使用成本。
- 降低人工复制导致的低级错误。

第一版只要把 **VSCode 一键同步已有 DLL 到 Unity** 做稳，就已经能明显提升实际开发效率。

等这个流程稳定后，再加入 Build & Sync、Unity 自动刷新和依赖校验，工具会自然长成完整的团队工作流，而不是一开始就做得过重。
