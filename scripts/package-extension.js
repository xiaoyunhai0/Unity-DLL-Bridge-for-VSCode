const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const extensionDir = path.join(repoRoot, 'vscode-extension');
const releaseDir = path.join(repoRoot, 'releases');
const extensionPackage = require(path.join(extensionDir, 'package.json'));
const vsixPath = path.join(releaseDir, `UnityDllBridge-VSCode-${extensionPackage.version}.vsix`);
const vsceBin = require.resolve('@vscode/vsce/vsce', {
  paths: [extensionDir]
});

fs.mkdirSync(releaseDir, { recursive: true });

const result = cp.spawnSync(process.execPath, [vsceBin, 'package', '--out', vsixPath], {
  cwd: extensionDir,
  stdio: 'inherit'
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
