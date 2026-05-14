import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import { loadBridgeConfig } from '../config/loadConfig';
import { getDotnetVersion, resolveDotnetPath, tryResolveDotnetCommand } from '../dotnet/dotnetLocator';
import { isPlainObject } from '../utils/pathUtils';

interface DotnetChoice extends vscode.QuickPickItem {
  value: 'auto' | 'folder' | 'file';
}

export function registerConfigureDotnetPathCommand(context: vscode.ExtensionContext, onDidChangeConfig?: () => void): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.configureDotnetPath', async () => {
    try {
      const loaded = await loadBridgeConfig();
      if (!isPlainObject(loaded.config)) {
        vscode.window.showErrorMessage('dllbridge.json 根节点必须是 JSON object，无法自动写入 dotnet 配置。');
        return;
      }

      const build = isPlainObject(loaded.config.build) ? loaded.config.build : {};
      const configuredPath = typeof build.dotnetPath === 'string' ? build.dotnetPath : undefined;
      const autoDotnet = await tryResolveDotnetCommand(loaded.configDir, configuredPath);
      const selected = await chooseDotnetMode(autoDotnet);

      if (!selected) {
        return;
      }

      if (selected.value === 'auto') {
        await writeDotnetPath(loaded.configPath, loaded.config, undefined);
        onDidChangeConfig?.();
        vscode.window.showInformationMessage(autoDotnet ? `已启用 dotnet 自动检测：${autoDotnet.version}` : '已启用 dotnet 自动检测。构建时会继续检查 PATH、DOTNET_ROOT 和常见安装目录。');
        return;
      }

      const selectedPath = selected.value === 'folder' ? await chooseDotnetFolder(loaded.configDir) : await chooseDotnetFile(loaded.configDir);
      if (!selectedPath) {
        return;
      }

      const dotnet = await resolveDotnetPath(loaded.configDir, selectedPath);
      const version = await getDotnetVersion(dotnet.command);
      if (!version) {
        vscode.window.showErrorMessage(`所选 dotnet 无法运行：${dotnet.command}`);
        return;
      }

      await writeDotnetPath(loaded.configPath, loaded.config, dotnet.command);
      onDidChangeConfig?.();
      vscode.window.showInformationMessage(`已保存 dotnet 路径：${version}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const selection = await vscode.window.showErrorMessage(`配置 dotnet 路径失败：${message}`, '打开配置文件');
      if (selection === '打开配置文件') {
        await vscode.commands.executeCommand('unityDllBridge.openConfiguration');
      }
    }
  });

  context.subscriptions.push(disposable);
}

async function chooseDotnetMode(autoDotnet: Awaited<ReturnType<typeof tryResolveDotnetCommand>>): Promise<DotnetChoice | undefined> {
  const choices: DotnetChoice[] = [
    {
      label: '自动检测 dotnet（推荐）',
      description: autoDotnet ? `已检测到 ${autoDotnet.version}` : '当前未检测到，但构建时会继续自动检查',
      detail: autoDotnet ? `${autoDotnet.label}: ${autoDotnet.command}` : '会检查 PATH、DOTNET_ROOT、DOTNET_ROOT_X64 和常见安装目录',
      value: 'auto'
    },
    {
      label: '浏览选择 dotnet 安装文件夹...',
      description: '例如 C:/Program Files/dotnet，或选择 sdk 子目录也可以',
      value: 'folder'
    },
    {
      label: '浏览选择 dotnet 可执行文件...',
      description: '例如 dotnet.exe 或 dotnet',
      value: 'file'
    }
  ];

  return vscode.window.showQuickPick(choices, {
    placeHolder: '选择 VSCode 调用 dotnet 的方式'
  });
}

async function chooseDotnetFolder(defaultUriPath: string): Promise<string | undefined> {
  const selected = await vscode.window.showOpenDialog({
    title: '选择 dotnet 安装文件夹',
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: vscode.Uri.file(defaultUriPath)
  });

  return selected?.[0]?.fsPath;
}

async function chooseDotnetFile(defaultUriPath: string): Promise<string | undefined> {
  const selected = await vscode.window.showOpenDialog({
    title: '选择 dotnet 可执行文件',
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    defaultUri: vscode.Uri.file(defaultUriPath)
  });

  return selected?.[0]?.fsPath;
}

async function writeDotnetPath(configPath: string, config: Record<string, unknown>, dotnetPath: string | undefined): Promise<void> {
  const build = isPlainObject(config.build) ? { ...config.build } : {};
  const projects = Array.isArray(config.projects) ? config.projects : [];

  if (build.mode === undefined && projects.some((project) => isPlainObject(project) && typeof project.sourceProject === 'string')) {
    build.mode = 'dotnet';
  }

  if (dotnetPath) {
    build.dotnetPath = dotnetPath;
  } else {
    delete build.dotnetPath;
  }

  config.build = build;
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}
