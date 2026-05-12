const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const releaseDir = path.join(repoRoot, 'releases');
const templateZip = path.join(releaseDir, 'UnityDllBridge-Templates-0.1.0.zip');
const unityPluginZip = path.join(releaseDir, 'UnityDllBridge-UnityPlugin-0.1.0.zip');
const offlineReadme = path.join(releaseDir, 'README-offline-install.md');
const checksumsFile = path.join(releaseDir, 'checksums.txt');

const CRC_TABLE = createCrcTable();

fs.mkdirSync(releaseDir, { recursive: true });
createZipFromDirectory(path.join(repoRoot, 'templates'), templateZip);
createZipFromDirectory(path.join(repoRoot, 'unity-plugin'), unityPluginZip);
fs.copyFileSync(path.join(repoRoot, 'docs', 'offline-install.md'), offlineReadme);
writeChecksums(releaseDir, checksumsFile);

function createZipFromDirectory(sourceDir, zipPath) {
  const files = listFiles(sourceDir).map((filePath) => ({
    absolutePath: filePath,
    zipPath: toZipPath(path.relative(sourceDir, filePath)),
    data: fs.readFileSync(filePath)
  }));

  const chunks = [];
  const centralDirectory = [];
  let offset = 0;

  for (const file of files) {
    const fileName = Buffer.from(file.zipPath, 'utf8');
    const crc = crc32(file.data);
    const localHeader = Buffer.alloc(30 + fileName.length);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(file.data.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);
    fileName.copy(localHeader, 30);

    chunks.push(localHeader, file.data);
    centralDirectory.push({ fileName, crc, size: file.data.length, offset });
    offset += localHeader.length + file.data.length;
  }

  const centralChunks = [];
  let centralSize = 0;

  for (const entry of centralDirectory) {
    const header = Buffer.alloc(46 + entry.fileName.length);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    header.writeUInt32LE(entry.crc, 16);
    header.writeUInt32LE(entry.size, 20);
    header.writeUInt32LE(entry.size, 24);
    header.writeUInt16LE(entry.fileName.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(entry.offset, 42);
    entry.fileName.copy(header, 46);

    centralChunks.push(header);
    centralSize += header.length;
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(centralDirectory.length, 8);
  end.writeUInt16LE(centralDirectory.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  fs.writeFileSync(zipPath, Buffer.concat([...chunks, ...centralChunks, end]));
}

function listFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function writeChecksums(directory, outputFile) {
  const files = fs
    .readdirSync(directory)
    .filter((name) => name !== path.basename(outputFile))
    .map((name) => path.join(directory, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .sort();

  const lines = files.map((filePath) => {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    return `SHA256 ${path.basename(filePath)} ${hash}`;
  });

  fs.writeFileSync(outputFile, `${lines.join('\n')}\n`, 'utf8');
}

function toZipPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
}
