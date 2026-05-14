# 任务清单

## VSCode 复刻 Visual Studio 外部工程工作流

- [x] 新增命令：把外部 `.csproj` 加入 Unity 生成的 `.sln`。
- [x] 支持自动查找 Unity 工程根目录下的 `.sln`，必要时手动选择。
- [x] 优先使用 `dotnet sln add`，失败时给出清晰错误和日志。
- [x] 从 `dllbridge.json` 读取 `unityProject` 与 `projects[].sourceProject`，减少重复选择。
- [x] 在侧边栏和状态栏中加入“添加工程到 Unity 解决方案”入口。
- [x] 更新 README、VSCode 扩展说明和离线安装说明。
- [x] 编译、打包、提交，并通过 GitHub Actions 刷新 Release。

## dotnet 自动检测与手动选择优化

- [x] 构建 DLL 时自动检测 PATH、`DOTNET_ROOT` 和常见 dotnet 安装目录。
- [x] 添加工程到 Unity 解决方案时复用同一套 dotnet 检测逻辑。
- [x] 配置向导选择 `dotnet build` 时展示检测结果，未检测到时支持选择 dotnet 安装文件夹。
- [x] 新增命令：`Unity DLL Bridge: 配置 dotnet 路径`。
- [x] 在侧边栏和状态栏加入 dotnet 路径配置入口。
- [x] 更新 README、VSCode 扩展说明和离线安装说明。

## 全量工作流增强

- [x] 新增一键环境诊断报告，覆盖 Unity、`.sln`、`.csproj`、dotnet、MSBuild、DLL/PDB。
- [x] 新增自动发现报告，扫描附近 Unity 工程、C# 工程、解决方案和 DLL 输出目录。
- [x] 新增打开 Unity 解决方案命令。
- [x] 构建错误解析到 VSCode Problems 面板，支持跳转源码行。
- [x] 新增 MSBuild 自动探测，支持 Visual Studio Build Tools 常见路径和 `dotnet msbuild`。
- [x] 新增批量构建并同步命令。
- [x] 新增源码变化后自动构建并同步开关和 `watch` 配置。
- [x] 新增多种配置模板：只同步、dotnet、MSBuild、多项目。
- [x] 新增 Unity Editor 附加调试配置生成命令。
- [x] 增强 Unity 插件 manifest 窗口，显示 PDB 状态、主 DLL 缺失提醒和打开文件夹入口。
