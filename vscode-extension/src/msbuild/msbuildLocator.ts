import * as cp from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveConfigPath } from '../utils/pathUtils';

export interface MsbuildResolveResult {
  command: string;
  label: string;
  argsPrefix?: string[];
  version?: string;
}

const VERSION_TIMEOUT_MS = 8000;

export async function resolveMsbuildCommand(configDir: string, configuredPath?: string): Promise<MsbuildResolveResult> {
  const trimmedPath = configuredPath?.trim();

  if (trimmedPath && trimmedPath.toLowerCase() !== 'auto') {
    const command = resolveMaybePath(configDir, trimmedPath);
    const version = await getMsbuildVersion(command);
    if (!version) {
      throw new Error(`已配置 build.msbuildPath，但无法运行 MSBuild：${command}`);
    }

    return {
      command,
      label: '已配置的 MSBuild 路径',
      version
    };
  }

  for (const candidate of await getAutoMsbuildCandidates()) {
    const version = await getMsbuildVersion(candidate.command, candidate.argsPrefix);
    if (version) {
      return { ...candidate, version };
    }
  }

  throw new Error('没有找到 MSBuild。请安装 Visual Studio Build Tools，或在 build.msbuildPath 中配置 MSBuild.exe。');
}

export async function tryResolveMsbuildCommand(configDir: string, configuredPath?: string): Promise<MsbuildResolveResult | undefined> {
  try {
    return await resolveMsbuildCommand(configDir, configuredPath);
  } catch {
    return undefined;
  }
}

export async function getMsbuildVersion(command: string, argsPrefix: string[] = []): Promise<string | undefined> {
  return new Promise((resolve) => {
    const child = cp.spawn(command, [...argsPrefix, '-version', '-nologo'], {
      shell: shouldUseShell(command),
      windowsHide: true
    });
    let output = '';
    const timeout = setTimeout(() => {
      child.kill();
      resolve(undefined);
    }, VERSION_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      output += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString('utf8');
    });
    child.on('error', () => {
      clearTimeout(timeout);
      resolve(undefined);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      if (exitCode !== 0) {
        resolve(undefined);
        return;
      }

      resolve(output.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean).pop());
    });
  });
}

async function getAutoMsbuildCandidates(): Promise<MsbuildResolveResult[]> {
  const candidates: MsbuildResolveResult[] = [
    {
      command: process.platform === 'win32' ? 'MSBuild.exe' : 'msbuild',
      label: 'PATH 中的 MSBuild'
    }
  ];

  if (process.platform === 'win32') {
    for (const location of getKnownWindowsMsbuildLocations()) {
      if (await fileExists(location)) {
        candidates.push({
          command: location,
          label: 'Visual Studio Build Tools 中的 MSBuild'
        });
      }
    }
  } else {
    candidates.push({
      command: 'dotnet',
      label: 'dotnet msbuild',
      argsPrefix: ['msbuild']
    });
  }

  return uniqueByCommand(candidates);
}

function getKnownWindowsMsbuildLocations(): string[] {
  const programFiles = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)']
  ].filter((value): value is string => Boolean(value));
  const years = ['2022', '2019', '2017'];
  const editions = ['BuildTools', 'Community', 'Professional', 'Enterprise'];
  const results: string[] = [];

  for (const root of programFiles) {
    for (const year of years) {
      for (const edition of editions) {
        results.push(path.join(root, 'Microsoft Visual Studio', year, edition, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe'));
        results.push(path.join(root, 'Microsoft Visual Studio', year, edition, 'MSBuild', '15.0', 'Bin', 'MSBuild.exe'));
      }
    }
  }

  return results;
}

function resolveMaybePath(configDir: string, command: string): string {
  if (command.includes('/') || command.includes('\\') || path.isAbsolute(command)) {
    return resolveConfigPath(configDir, command);
  }

  return command;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function uniqueByCommand(values: MsbuildResolveResult[]): MsbuildResolveResult[] {
  const seen = new Set<string>();
  const results: MsbuildResolveResult[] = [];

  for (const value of values) {
    const key = value.command.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(value);
    }
  }

  return results;
}

function shouldUseShell(command: string): boolean {
  if (process.platform !== 'win32') {
    return false;
  }

  const extension = path.extname(command).toLowerCase();
  return !path.isAbsolute(command) || extension === '.cmd' || extension === '.bat';
}
