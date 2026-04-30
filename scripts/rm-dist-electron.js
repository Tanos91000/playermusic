#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '..', 'dist-electron');
try {
  fs.rmSync(dir, { recursive: true, force: true });
} catch {
  /* ignore */
}
