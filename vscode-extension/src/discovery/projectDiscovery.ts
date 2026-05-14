import * as fs from 'fs/promises';
import * as path from 'path';

export interface UnityProjectCandidate {
  path: string;
  solutions: string[];
  manifests: string[];
}

export interface CsProjectCandidate {
  path: string;
  directory: string;
  assemblyName?: string;
  targetFrameworks: string[];
  debugOutputDirs: string[];
  releaseOutputDirs: string[];
}

export interface DllOutputCandidate {
  path: string;
  dlls: string[];
  pdbs: string[];
}

export interface DiscoveryResult {
  roots: string[];
  unityProjects: UnityProjectCandidate[];
  csProjects: CsProjectCandidate[];
  solutions: string[];
  dllOutputDirs: DllOutputCandidate[];
}

interface FindOptions {
  maxDepth: number;
  maxResults: number;
}

const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.vs',
  '.vscode',
  'Library',
  'Temp',
  'Obj',
  'obj',
  'node_modules',
  'out',
  'releases'
]);

export async function discoverWorkspace(workspaceRoot: string): Promise<DiscoveryResult> {
  const roots = getNearbySearchRoots(workspaceRoot);
  const unityProjectPaths = await findDirectoriesInRoots(roots, isUnityProjectDirectory, { maxDepth: 4, maxResults: 20 });
  const csprojPaths = await findFilesInRoots(roots, '.csproj', { maxDepth: 7, maxResults: 120 });
  const solutionPaths = await findFilesInRoots(roots, '.sln', { maxDepth: 5, maxResults: 80 });
  const dllPaths = await findFilesInRoots(roots, '.dll', { maxDepth: 8, maxResults: 220 });

  const unityProjects = await Promise.all(
    unityProjectPaths.map(async (projectPath) => ({
      path: projectPath,
      solutions: solutionPaths.filter((solutionPath) => isInsideOrEqual(projectPath, solutionPath)),
      manifests: await findFiles(path.join(projectPath, 'Assets', 'Plugins'), 'manifest.json', { maxDepth: 8, maxResults: 80 })
    }))
  );

  const csProjects = await Promise.all(csprojPaths.map(loadCsProjectCandidate));
  const dllOutputDirs = collectDllOutputDirs(dllPaths);

  return {
    roots,
    unityProjects,
    csProjects,
    solutions: solutionPaths,
    dllOutputDirs
  };
}

export function getNearbySearchRoots(workspaceRoot: string): string[] {
  const roots = [workspaceRoot];
  let current = workspaceRoot;

  for (let depth = 0; depth < 3; depth += 1) {
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    roots.push(parent);
    current = parent;
  }

  return unique(roots);
}

export async function findFilesInRoots(roots: string[], extensionOrName: string, options: FindOptions): Promise<string[]> {
  const results: string[] = [];

  for (const root of roots) {
    if (results.length >= options.maxResults) {
      break;
    }

    results.push(...(await findFiles(root, extensionOrName, {
      maxDepth: options.maxDepth,
      maxResults: options.maxResults - results.length
    })));
  }

  return unique(results).sort();
}

export async function findFiles(root: string, extensionOrName: string, options: FindOptions): Promise<string[]> {
  const results: string[] = [];
  const expected = extensionOrName.toLowerCase();

  async function visit(directory: string, depth: number): Promise<void> {
    if (results.length >= options.maxResults || depth > options.maxDepth) {
      return;
    }

    let entries: Array<import('fs').Dirent>;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= options.maxResults) {
        return;
      }

      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry.name)) {
          await visit(path.join(directory, entry.name), depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const name = entry.name.toLowerCase();
      if (expected.startsWith('.') ? name.endsWith(expected) : name === expected) {
        results.push(path.join(directory, entry.name));
      }
    }
  }

  await visit(root, 0);
  return results.sort();
}

async function findDirectoriesInRoots(
  roots: string[],
  predicate: (directory: string) => Promise<boolean>,
  options: FindOptions
): Promise<string[]> {
  const results: string[] = [];

  for (const root of roots) {
    if (results.length >= options.maxResults) {
      break;
    }

    results.push(...(await findDirectories(root, predicate, {
      maxDepth: options.maxDepth,
      maxResults: options.maxResults - results.length
    })));
  }

  return unique(results).sort();
}

async function findDirectories(
  root: string,
  predicate: (directory: string) => Promise<boolean>,
  options: FindOptions
): Promise<string[]> {
  const results: string[] = [];

  async function visit(directory: string, depth: number): Promise<void> {
    if (results.length >= options.maxResults || depth > options.maxDepth) {
      return;
    }

    if (await predicate(directory)) {
      results.push(directory);
      return;
    }

    let entries: Array<import('fs').Dirent>;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= options.maxResults || !entry.isDirectory() || shouldSkipDirectory(entry.name)) {
        continue;
      }

      await visit(path.join(directory, entry.name), depth + 1);
    }
  }

  await visit(root, 0);
  return results.sort();
}

async function loadCsProjectCandidate(projectPath: string): Promise<CsProjectCandidate> {
  const projectInfo = await readCsprojInfo(projectPath);
  const directory = path.dirname(projectPath);

  return {
    path: projectPath,
    directory,
    assemblyName: projectInfo.assemblyName,
    targetFrameworks: projectInfo.targetFrameworks,
    debugOutputDirs: projectInfo.targetFrameworks.map((framework) => path.join(directory, 'bin', 'Debug', framework)),
    releaseOutputDirs: projectInfo.targetFrameworks.map((framework) => path.join(directory, 'bin', 'Release', framework))
  };
}

export async function readCsprojInfo(projectPath: string): Promise<{ assemblyName?: string; targetFrameworks: string[]; postBuildEvents: string[] }> {
  let content = '';
  try {
    content = await fs.readFile(projectPath, 'utf8');
  } catch {
    return { targetFrameworks: [], postBuildEvents: [] };
  }

  const assemblyName = firstXmlValue(content, 'AssemblyName');
  const targetFrameworks = unique([
    ...splitFrameworks(firstXmlValue(content, 'TargetFrameworks')),
    ...splitFrameworks(firstXmlValue(content, 'TargetFramework'))
  ]).filter(Boolean);
  const postBuildEvents = allXmlValues(content, 'PostBuildEvent');

  return {
    assemblyName,
    targetFrameworks,
    postBuildEvents
  };
}

function collectDllOutputDirs(dllPaths: string[]): DllOutputCandidate[] {
  const byDirectory = new Map<string, DllOutputCandidate>();

  for (const dllPath of dllPaths) {
    const normalized = dllPath.split(path.sep).join('/').toLowerCase();
    if (!normalized.includes('/bin/') || normalized.includes('/obj/')) {
      continue;
    }

    const directory = path.dirname(dllPath);
    const existing = byDirectory.get(directory) ?? {
      path: directory,
      dlls: [],
      pdbs: []
    };
    existing.dlls.push(dllPath);
    byDirectory.set(directory, existing);
  }

  return [...byDirectory.values()].sort((left, right) => left.path.localeCompare(right.path));
}

async function isUnityProjectDirectory(directory: string): Promise<boolean> {
  return (await directoryExists(path.join(directory, 'Assets'))) && (await directoryExists(path.join(directory, 'ProjectSettings')));
}

async function directoryExists(directoryPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(directoryPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

function shouldSkipDirectory(name: string): boolean {
  return SKIPPED_DIRECTORIES.has(name);
}

function firstXmlValue(content: string, tagName: string): string | undefined {
  const match = new RegExp(`<${tagName}>\\s*([^<]+?)\\s*</${tagName}>`, 'i').exec(content);
  return match?.[1]?.trim();
}

function allXmlValues(content: string, tagName: string): string[] {
  return [...content.matchAll(new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*</${tagName}>`, 'gi'))]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function splitFrameworks(value: string | undefined): string[] {
  return value?.split(';').map((item) => item.trim()).filter(Boolean) ?? [];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isInsideOrEqual(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
