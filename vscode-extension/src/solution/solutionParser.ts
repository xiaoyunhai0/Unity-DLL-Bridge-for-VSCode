import * as fs from 'fs/promises';
import * as path from 'path';

export interface SolutionProject {
  name: string;
  relativePath: string;
  absolutePath: string;
  projectGuid: string;
}

export async function parseSolutionProjects(solutionPath: string): Promise<SolutionProject[]> {
  const content = await fs.readFile(solutionPath, 'utf8');
  const solutionDir = path.dirname(solutionPath);
  const projects: SolutionProject[] = [];
  const projectPattern = /^Project\("[^"]+"\)\s*=\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"/gm;
  let match: RegExpExecArray | null;

  while ((match = projectPattern.exec(content)) !== null) {
    const [, name, relativeProjectPath, projectGuid] = match;

    if (!relativeProjectPath.toLowerCase().endsWith('.csproj')) {
      continue;
    }

    const normalizedRelativePath = relativeProjectPath.replace(/\\/g, path.sep);
    const absolutePath = path.isAbsolute(normalizedRelativePath)
      ? path.normalize(normalizedRelativePath)
      : path.normalize(path.join(solutionDir, normalizedRelativePath));

    projects.push({
      name,
      relativePath: relativeProjectPath,
      absolutePath,
      projectGuid
    });
  }

  return projects.sort((left, right) => left.name.localeCompare(right.name));
}

export async function solutionContainsProject(solutionPath: string, projectPath: string): Promise<boolean> {
  const projects = await parseSolutionProjects(solutionPath);
  const normalizedProjectPath = normalizeForCompare(projectPath);
  const projectFileName = path.basename(projectPath).toLowerCase();

  return projects.some((project) => {
    return normalizeForCompare(project.absolutePath) === normalizedProjectPath || path.basename(project.absolutePath).toLowerCase() === projectFileName;
  });
}

export function normalizeForCompare(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/').toLowerCase();
}
