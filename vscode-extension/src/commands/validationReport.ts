import * as vscode from 'vscode';

export function showValidationReport(result: { errors: string[]; warnings: string[] }): void {
  const output = vscode.window.createOutputChannel('Unity DLL Bridge');
  output.clear();
  output.appendLine('Unity DLL Bridge 配置校验报告');
  output.appendLine('');

  if (result.errors.length > 0) {
    output.appendLine('错误：');
    for (const error of result.errors) {
      output.appendLine(`- ${error}`);
    }
    output.appendLine('');
  }

  if (result.warnings.length > 0) {
    output.appendLine('提醒：');
    for (const warning of result.warnings) {
      output.appendLine(`- ${warning}`);
    }
    output.appendLine('');
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    output.appendLine('未发现错误或提醒。');
  }

  output.show(true);
}
