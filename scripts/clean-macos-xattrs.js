const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

if (process.platform !== 'darwin') {
  process.exit(0);
}

const targets = [
  path.join(__dirname, '..', 'node_modules', 'electron', 'dist'),
  path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec')
].filter(existsSync);

for (const target of targets) {
  const result = spawnSync('xattr', ['-cr', target], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
