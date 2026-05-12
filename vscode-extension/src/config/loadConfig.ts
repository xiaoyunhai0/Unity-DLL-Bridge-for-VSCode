import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { LoadedBridgeConfig } from './types';

const CONFIG_CANDIDATES = [
  'dllbridge.json',
  path.join('.dllbridge', 'dllbridge.json')
];

export async function loadBridgeConfig(): Promise<LoadedBridgeConfig> {
  const workspaceFolder = getPrimaryWorkspaceFolder();

  for (const candidate of CONFIG_CANDIDATES) {
    const configPath = path.join(workspaceFolder.uri.fsPath, candidate);

    if (await fileExists(configPath)) {
      return {
        configPath,
        configDir: path.dirname(configPath),
        workspaceRoot: workspaceFolder.uri.fsPath,
        config: await readJson(configPath)
      };
    }
  }

  throw new Error('没有找到 dllbridge.json。请在工作区根目录或 .dllbridge 目录下创建配置文件。');
}

function getPrimaryWorkspaceFolder(): vscode.WorkspaceFolder {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    throw new Error('当前没有打开 VSCode 工作区。请先打开包含 dllbridge.json 的文件夹。');
  }

  return folders[0];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function readJson(filePath: string): Promise<unknown> {
  let content: string;

  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`无法读取配置文件：${filePath}。${formatUnknownError(error)}`);
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`配置文件 JSON 语法错误：${filePath}。${formatUnknownError(error)}`);
  }
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
