import * as cp from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveConfigPath } from '../utils/pathUtils';

export type DotnetSource = 'configured' | 'path' | 'environment' | 'knownLocation';

export interface DotnetResolveResult {
  command: string;
  label: string;
  source: DotnetSource;
  version?: string;
}

interface DotnetCandidate {
  command: string;
  label: string;
  source: DotnetSource;
}

const DOTNET_EXECUTABLE = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
const VERSION_TIMEOUT_MS = 8000;

export async function resolveDotnetCommand(configDir: string, configuredPath?: string): Promise<DotnetResolveResult> {
  const trimmedPath = configuredPath?.trim();

  if (trimmedPath && trimmedPath.toLowerCase() !== 'auto') {
    const candidate = await resolveDotnetPath(configDir, trimmedPath, 'configured');
    const version = await getDotnetVersion(candidate.command);

    if (!version) {
      throw new Error(
        `已配置 build.dotnetPath，但无法运行 dotnet：${candidate.command}。请执行 “Unity DLL Bridge: 配置 dotnet 路径”，选择 dotnet 安装文件夹或可执行文件。`
      );
    }

    return { ...candidate, version };
  }

  for (const candidate of await getAutoDotnetCandidates()) {
    const version = await getDotnetVersion(candidate.command);
    if (version) {
      return { ...candidate, version };
    }
  }

  throw new Error('没有找到 dotnet SDK。扩展已自动检查 PATH、DOTNET_ROOT 和常见安装目录；请安装 .NET SDK，或执行 “Unity DLL Bridge: 配置 dotnet 路径” 手动选择 dotnet 文件夹。');
}

export async function tryResolveDotnetCommand(configDir: string, configuredPath?: string): Promise<DotnetResolveResult | undefined> {
  try {
    return await resolveDotnetCommand(configDir, configuredPath);
  } catch {
    return undefined;
  }
}

export async function resolveDotnetPath(configDir: string, configuredPath: string, source: DotnetSource = 'configured'): Promise<DotnetResolveResult> {
  const trimmedPath = configuredPath.trim();

  if (!hasPathSeparator(trimmedPath) && !path.isAbsolute(trimmedPath)) {
    return {
      command: trimmedPath,
      label: source === 'configured' ? '已配置的 dotnet 命令' : 'PATH 中的 dotnet',
      source
    };
  }

  const resolvedPath = resolveConfigPath(configDir, trimmedPath);
  const executable = await findDotnetExecutableFromPath(resolvedPath);

  if (!executable) {
    throw new Error(`所选路径不是有效的 dotnet 安装目录或可执行文件：${configuredPath}`);
  }

  return {
    command: executable,
    label: source === 'configured' ? '已配置的 dotnet 路径' : '自动检测到的 dotnet',
    source
  };
}

export async function getDotnetVersion(command: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const child = cp.spawn(command, ['--version'], {
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

      resolve(output.replace(/\r/g, '').split('\n').map((line) => line.trim()).find(Boolean));
    });
  });
}

export function shouldUseShell(command: string): boolean {
  if (process.platform !== 'win32') {
    return false;
  }

  const extension = path.extname(command).toLowerCase();
  return !path.isAbsolute(command) || extension === '.cmd' || extension === '.bat';
}

async function getAutoDotnetCandidates(): Promise<DotnetCandidate[]> {
  const candidates: DotnetCandidate[] = [
    {
      command: 'dotnet',
      label: 'PATH 中的 dotnet',
      source: 'path'
    }
  ];

  for (const [name, root] of getDotnetEnvironmentRoots()) {
    const executable = root ? await findDotnetExecutableFromPath(root) : undefined;
    if (executable) {
      candidates.push({
        command: executable,
        label: `${name} 中的 dotnet`,
        source: 'environment'
      });
    }
  }

  for (const location of getKnownDotnetLocations()) {
    const executable = await findDotnetExecutableFromPath(location);
    if (executable) {
      candidates.push({
        command: executable,
        label: '常见安装目录中的 dotnet',
        source: 'knownLocation'
      });
    }
  }

  return uniqueCandidates(candidates);
}

function getDotnetEnvironmentRoots(): Array<[string, string | undefined]> {
  return [
    ['DOTNET_ROOT', process.env.DOTNET_ROOT],
    ['DOTNET_ROOT_X64', process.env.DOTNET_ROOT_X64],
    ['DOTNET_ROOT_X86', process.env.DOTNET_ROOT_X86],
    ['DOTNET_ROOT(x86)', process.env['DOTNET_ROOT(x86)']]
  ];
}

function getKnownDotnetLocations(): string[] {
  if (process.platform === 'win32') {
    const systemDrive = process.env.SystemDrive ?? 'C:';
    return [
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'dotnet') : undefined,
      process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'dotnet') : undefined,
      path.join(systemDrive, 'Program Files', 'dotnet'),
      path.join(systemDrive, 'Program Files (x86)', 'dotnet')
    ].filter((value): value is string => Boolean(value));
  }

  if (process.platform === 'darwin') {
    return [
      '/usr/local/share/dotnet',
      '/usr/local/bin/dotnet',
      '/opt/homebrew/bin/dotnet',
      '/usr/bin/dotnet'
    ];
  }

  return [
    '/usr/bin/dotnet',
    '/usr/local/bin/dotnet',
    '/snap/bin/dotnet',
    '/usr/share/dotnet',
    '/usr/local/share/dotnet'
  ];
}

async function findDotnetExecutableFromPath(inputPath: string): Promise<string | undefined> {
  const stat = await statPath(inputPath);

  if (!stat) {
    return undefined;
  }

  if (stat.isFile()) {
    return inputPath;
  }

  if (!stat.isDirectory()) {
    return undefined;
  }

  let current = inputPath;
  for (let depth = 0; depth < 3; depth += 1) {
    const candidate = path.join(current, DOTNET_EXECUTABLE);
    if (await fileExists(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return undefined;
}

async function statPath(inputPath: string): Promise<import('fs').Stats | undefined> {
  try {
    return await fs.stat(inputPath);
  } catch {
    return undefined;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  const stat = await statPath(filePath);
  return stat?.isFile() ?? false;
}

function uniqueCandidates(candidates: DotnetCandidate[]): DotnetCandidate[] {
  const seen = new Set<string>();
  const result: DotnetCandidate[] = [];

  for (const candidate of candidates) {
    const key = candidate.command.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(candidate);
  }

  return result;
}

function hasPathSeparator(value: string): boolean {
  return value.includes('/') || value.includes('\\') || value.includes(path.sep);
}
