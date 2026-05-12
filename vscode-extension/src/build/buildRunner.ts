import * as cp from 'child_process';
import * as path from 'path';
import { BridgeBuildConfig, ResolvedBridgeConfig } from '../config/types';
import { resolveConfigPath } from '../utils/pathUtils';

export interface BuildResult {
  skipped: boolean;
  success: boolean;
  exitCode?: number | null;
  command?: string;
  args: string[];
  lines: string[];
  durationMs: number;
}

export async function runBuild(resolvedConfig: ResolvedBridgeConfig): Promise<BuildResult> {
  const startedAt = Date.now();
  const build = resolvedConfig.config.build ?? { mode: 'syncOnly' };
  const mode = build.mode ?? 'syncOnly';

  if (mode === 'syncOnly') {
    return {
      skipped: true,
      success: true,
      args: [],
      lines: ['Build skipped: build.mode is syncOnly.'],
      durationMs: Date.now() - startedAt
    };
  }

  const commandLine = getBuildCommand(build, resolvedConfig);
  const lines = [
    `Build mode: ${mode}`,
    `Command: ${commandLine.command} ${commandLine.args.join(' ')}`
  ];

  const result = await runProcess(commandLine.command, commandLine.args, resolvedConfig.configDir, build.timeoutSeconds ?? 120, lines);

  return {
    skipped: false,
    success: result.exitCode === 0,
    exitCode: result.exitCode,
    command: commandLine.command,
    args: commandLine.args,
    lines,
    durationMs: Date.now() - startedAt
  };
}

function getBuildCommand(build: BridgeBuildConfig, resolvedConfig: ResolvedBridgeConfig): { command: string; args: string[] } {
  const mode = build.mode ?? 'syncOnly';

  if (mode === 'dotnet') {
    const projectOrSolution = build.projectPath ?? build.solutionPath ?? firstSourceProject(resolvedConfig);
    return {
      command: build.dotnetPath ?? 'dotnet',
      args: ['build', resolveConfigPath(resolvedConfig.configDir, projectOrSolution), '-c', resolvedConfig.activeConfiguration]
    };
  }

  if (mode === 'msbuild') {
    const projectOrSolution = build.projectPath ?? build.solutionPath ?? firstSourceProject(resolvedConfig);
    return {
      command: build.msbuildPath && build.msbuildPath !== 'auto' ? build.msbuildPath : 'MSBuild.exe',
      args: [resolveConfigPath(resolvedConfig.configDir, projectOrSolution), `/p:Configuration=${resolvedConfig.activeConfiguration}`]
    };
  }

  if (mode === 'custom') {
    if (!build.command) {
      throw new Error('build.mode 为 custom 时必须配置 build.command。');
    }

    return {
      command: resolveMaybeRelativeCommand(resolvedConfig.configDir, build.command),
      args: (build.args ?? []).map((arg) => arg.replace(/\{configuration\}/g, resolvedConfig.activeConfiguration))
    };
  }

  throw new Error(`暂不支持 build.mode：${mode}`);
}

function firstSourceProject(resolvedConfig: ResolvedBridgeConfig): string {
  const sourceProject = resolvedConfig.config.projects.find((project) => project.sourceProject)?.sourceProject;

  if (!sourceProject) {
    throw new Error('没有找到 sourceProject。请配置 build.projectPath、build.solutionPath 或 projects[].sourceProject。');
  }

  return sourceProject;
}

function resolveMaybeRelativeCommand(configDir: string, command: string): string {
  if (command.includes(path.sep) || command.includes('/') || command.includes('\\')) {
    return resolveConfigPath(configDir, command);
  }

  return command;
}

function runProcess(command: string, args: string[], cwd: string, timeoutSeconds: number, lines: string[]): Promise<{ exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(command, args, {
      cwd,
      shell: process.platform === 'win32'
    });
    const timeout = setTimeout(() => {
      child.kill();
      lines.push(`Build timed out after ${timeoutSeconds} seconds.`);
    }, timeoutSeconds * 1000);

    child.stdout.on('data', (chunk) => appendProcessOutput(lines, chunk));
    child.stderr.on('data', (chunk) => appendProcessOutput(lines, chunk));
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      lines.push(`Build exit code: ${exitCode}`);
      resolve({ exitCode });
    });
  });
}

function appendProcessOutput(lines: string[], chunk: Buffer): void {
  const text = chunk.toString('utf8').replace(/\r/g, '');
  for (const line of text.split('\n')) {
    if (line.length > 0) {
      lines.push(line);
    }
  }
}
