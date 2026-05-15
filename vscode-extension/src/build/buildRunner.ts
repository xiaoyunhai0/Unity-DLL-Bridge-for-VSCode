import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { BridgeBuildConfig, ResolvedBridgeConfig } from '../config/types';
import { resolveDotnetCommand, shouldUseShell } from '../dotnet/dotnetLocator';
import { resolveMsbuildCommand } from '../msbuild/msbuildLocator';
import { resolveConfigPath } from '../utils/pathUtils';
import { BuildProblem, parseBuildProblems, publishBuildProblems } from './problemMatcher';

export interface BuildResult {
  skipped: boolean;
  success: boolean;
  exitCode?: number | null;
  command?: string;
  args: string[];
  lines: string[];
  problems: BuildProblem[];
  durationMs: number;
}

export async function runBuild(resolvedConfig: ResolvedBridgeConfig, diagnostics?: vscode.DiagnosticCollection): Promise<BuildResult> {
  const startedAt = Date.now();
  const build = resolvedConfig.config.build ?? { mode: 'syncOnly' };
  const mode = build.mode ?? 'syncOnly';

  if (mode === 'syncOnly') {
    return {
      skipped: true,
      success: true,
      args: [],
      lines: ['Build skipped: build.mode is syncOnly.'],
      problems: [],
      durationMs: Date.now() - startedAt
    };
  }

  const commandLine = await getBuildCommand(build, resolvedConfig);
  const lines = [
    `Build mode: ${mode}`,
    `Command: ${commandLine.command} ${commandLine.args.join(' ')}`
  ];
  if (commandLine.note) {
    lines.push(commandLine.note);
  }

  const result = await runProcess(commandLine.command, commandLine.args, resolvedConfig.configDir, build.timeoutSeconds ?? 120, lines);
  const problems = parseBuildProblems(lines, resolvedConfig.configDir);
  if (diagnostics) {
    publishBuildProblems(diagnostics, problems);
  }

  return {
    skipped: false,
    success: result.exitCode === 0,
    exitCode: result.exitCode,
    command: commandLine.command,
    args: commandLine.args,
    lines,
    problems,
    durationMs: Date.now() - startedAt
  };
}

async function getBuildCommand(build: BridgeBuildConfig, resolvedConfig: ResolvedBridgeConfig): Promise<{ command: string; args: string[]; note?: string }> {
  const mode = build.mode ?? 'syncOnly';

  if (mode === 'dotnet') {
    const projectOrSolution = build.projectPath ?? build.solutionPath ?? firstSourceProject(resolvedConfig);
    const dotnet = await resolveDotnetCommand(resolvedConfig.configDir, build.dotnetPath);
    return {
      command: dotnet.command,
      args: [
        'build',
        resolveConfigPath(resolvedConfig.configDir, projectOrSolution),
        '-c',
        resolvedConfig.activeConfiguration,
        ...getSolutionContextProperties(build, resolvedConfig.configDir)
      ],
      note: `Dotnet: ${dotnet.label}${dotnet.version ? ` (${dotnet.version})` : ''}`
    };
  }

  if (mode === 'msbuild') {
    const projectOrSolution = build.projectPath ?? build.solutionPath ?? firstSourceProject(resolvedConfig);
    const msbuild = await resolveMsbuildCommand(resolvedConfig.configDir, build.msbuildPath);
    return {
      command: msbuild.command,
      args: [
        ...(msbuild.argsPrefix ?? []),
        resolveConfigPath(resolvedConfig.configDir, projectOrSolution),
        `/p:Configuration=${resolvedConfig.activeConfiguration}`,
        ...getSolutionContextProperties(build, resolvedConfig.configDir)
      ],
      note: `MSBuild: ${msbuild.label}${msbuild.version ? ` (${msbuild.version})` : ''}`
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

function getSolutionContextProperties(build: BridgeBuildConfig, configDir: string): string[] {
  if (!build.projectPath || !build.solutionPath) {
    return [];
  }

  const solutionPath = resolveConfigPath(configDir, build.solutionPath);
  const solutionDir = toMsbuildDirectory(path.dirname(solutionPath));
  const solutionFileName = path.basename(solutionPath);
  const solutionExt = path.extname(solutionPath);
  const solutionName = path.basename(solutionPath, solutionExt);

  return [
    `/p:SolutionDir=${solutionDir}`,
    `/p:SolutionPath=${toMsbuildPath(solutionPath)}`,
    `/p:SolutionFileName=${solutionFileName}`,
    `/p:SolutionName=${solutionName}`,
    `/p:SolutionExt=${solutionExt}`
  ];
}

function toMsbuildDirectory(directoryPath: string): string {
  const separator = process.platform === 'win32' ? '\\' : '/';
  return `${toMsbuildPath(directoryPath).replace(/[\\/]+$/, '')}${separator}`;
}

function toMsbuildPath(filePath: string): string {
  const normalizedPath = path.normalize(filePath);
  return process.platform === 'win32'
    ? normalizedPath.replace(/\//g, '\\')
    : normalizedPath.split(path.sep).join('/');
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
      shell: shouldUseShell(command)
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
