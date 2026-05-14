import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { discoverWorkspace } from '../discovery/projectDiscovery';
import { getRelativePath } from '../utils/pathUtils';

export function registerDiscoverProjectsCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('unityDllBridge.discoverProjects', async () => {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('当前没有打开 VSCode 工作区。');
        return;
      }

      const workspaceRoot = workspaceFolder.uri.fsPath;
      const discovery = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Unity DLL Bridge: 正在自动发现项目',
          cancellable: false
        },
        () => discoverWorkspace(workspaceRoot)
      );

      const outputDir = path.join(workspaceRoot, '.dllbridge');
      await fs.mkdir(outputDir, { recursive: true });
      const reportPath = path.join(outputDir, 'discovery-report.md');
      await fs.writeFile(reportPath, renderDiscoveryReport(workspaceRoot, discovery), 'utf8');

      const document = await vscode.workspace.openTextDocument(reportPath);
      await vscode.window.showTextDocument(document);
      vscode.window.showInformationMessage(`发现完成：Unity 工程 ${discovery.unityProjects.length} 个，C# 工程 ${discovery.csProjects.length} 个，DLL 输出目录 ${discovery.dllOutputDirs.length} 个。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`自动发现项目失败：${message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function renderDiscoveryReport(workspaceRoot: string, discovery: Awaited<ReturnType<typeof discoverWorkspace>>): string {
  const lines = [
    '# Unity DLL Bridge 自动发现报告',
    '',
    `生成时间：${new Date().toISOString()}`,
    `工作区：${workspaceRoot}`,
    '',
    '## Unity 工程',
    ''
  ];

  if (discovery.unityProjects.length === 0) {
    lines.push('- 未发现 Unity 工程。');
  } else {
    for (const candidate of discovery.unityProjects) {
      lines.push(`- ${getRelativePath(workspaceRoot, candidate.path)}`);
      lines.push(`  - 解决方案：${candidate.solutions.length}`);
      lines.push(`  - Manifest：${candidate.manifests.length}`);
    }
  }

  lines.push('', '## C# 工程', '');
  if (discovery.csProjects.length === 0) {
    lines.push('- 未发现 .csproj。');
  } else {
    for (const candidate of discovery.csProjects) {
      lines.push(`- ${getRelativePath(workspaceRoot, candidate.path)}`);
      lines.push(`  - 程序集：${candidate.assemblyName ?? path.basename(candidate.path, '.csproj')}`);
      lines.push(`  - 目标框架：${candidate.targetFrameworks.join(', ') || '未知'}`);
    }
  }

  lines.push('', '## 解决方案', '');
  if (discovery.solutions.length === 0) {
    lines.push('- 未发现 .sln。');
  } else {
    lines.push(...discovery.solutions.map((solution) => `- ${getRelativePath(workspaceRoot, solution)}`));
  }

  lines.push('', '## DLL 输出目录', '');
  if (discovery.dllOutputDirs.length === 0) {
    lines.push('- 未发现 bin 目录下的 DLL 输出。');
  } else {
    for (const candidate of discovery.dllOutputDirs) {
      lines.push(`- ${getRelativePath(workspaceRoot, candidate.path)}（DLL: ${candidate.dlls.length}）`);
    }
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}
