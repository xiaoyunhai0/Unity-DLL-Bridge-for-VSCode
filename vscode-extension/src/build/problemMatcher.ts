import * as path from 'path';
import * as vscode from 'vscode';

export interface BuildProblem {
  filePath: string;
  line: number;
  column: number;
  severity: vscode.DiagnosticSeverity;
  code?: string;
  message: string;
}

const CSC_PATTERN = /^(?<file>.+?)\((?<line>\d+),(?<column>\d+)\):\s*(?<kind>error|warning)\s+(?<code>[A-Z]+\d+):\s*(?<message>.+?)(?:\s+\[(?<project>.+?)\])?$/i;
const MSBUILD_PATTERN = /^(?<file>.+?)\((?<line>\d+)\):\s*(?<kind>error|warning)\s+(?<code>[A-Z]+\d+):\s*(?<message>.+?)(?:\s+\[(?<project>.+?)\])?$/i;

export function parseBuildProblems(lines: string[], cwd: string): BuildProblem[] {
  const problems: BuildProblem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = CSC_PATTERN.exec(trimmed) ?? MSBUILD_PATTERN.exec(trimmed);
    if (!match?.groups) {
      continue;
    }

    problems.push({
      filePath: path.isAbsolute(match.groups.file) ? match.groups.file : path.resolve(cwd, match.groups.file),
      line: Number(match.groups.line),
      column: match.groups.column ? Number(match.groups.column) : 1,
      severity: match.groups.kind.toLowerCase() === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
      code: match.groups.code,
      message: match.groups.message
    });
  }

  return problems;
}

export function publishBuildProblems(collection: vscode.DiagnosticCollection, problems: BuildProblem[]): void {
  collection.clear();
  const byFile = new Map<string, vscode.Diagnostic[]>();

  for (const problem of problems) {
    const line = Math.max(problem.line - 1, 0);
    const column = Math.max(problem.column - 1, 0);
    const range = new vscode.Range(line, column, line, column + 1);
    const diagnostic = new vscode.Diagnostic(range, problem.message, problem.severity);
    diagnostic.source = 'Unity DLL Bridge';
    diagnostic.code = problem.code;
    const diagnostics = byFile.get(problem.filePath) ?? [];
    diagnostics.push(diagnostic);
    byFile.set(problem.filePath, diagnostics);
  }

  for (const [filePath, diagnostics] of byFile) {
    collection.set(vscode.Uri.file(filePath), diagnostics);
  }
}
