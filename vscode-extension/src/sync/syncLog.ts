import * as fs from 'fs/promises';
import * as path from 'path';
import { ensureDirectory } from '../utils/pathUtils';

export async function writeSyncLog(workspaceRoot: string, lines: string[], timestampForFileName: string): Promise<string> {
  const logDir = path.join(workspaceRoot, '.dllbridge', 'logs');
  const latestPath = path.join(logDir, 'latest.log');
  const timestampedPath = path.join(logDir, `${timestampForFileName}.log`);
  const content = `${lines.join('\n')}\n`;

  await ensureDirectory(logDir);
  await fs.writeFile(latestPath, content, 'utf8');
  await fs.writeFile(timestampedPath, content, 'utf8');

  return latestPath;
}
