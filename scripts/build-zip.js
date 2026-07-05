#!/usr/bin/env node
'use strict';

/*
  Build reproducible release ZIP for NetWizard static distribution.
  It intentionally excludes transient folders and generated test reports.
*/
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const outDir = path.join(root, 'dist');
const outName = `netwizard_v${String(pkg.version).replace(/\./g, '_')}_release.zip`;
const outPath = path.join(outDir, outName);

fs.mkdirSync(outDir, { recursive: true });
if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

const excludes = [
  'node_modules/*',
  'dist/*',
  'playwright-report/*',
  'test-results/*',
  '.git/*',
  '.DS_Store'
];

const args = ['-qr', outPath, '.', ...excludes.flatMap(e => ['-x', e])];
execFileSync('zip', args, { cwd: root, stdio: 'inherit' });
console.log(outPath);
