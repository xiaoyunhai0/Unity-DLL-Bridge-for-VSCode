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
