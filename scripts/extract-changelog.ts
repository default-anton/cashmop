#!/usr/bin/env pnpm dlx tsx

import * as fs from 'fs';
import * as path from 'path';

const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
const version = process.argv[2];

if (!version) {
  console.error('Usage: extract-changelog.ts <version>');
  process.exit(1);
}

const content = fs.readFileSync(changelogPath, 'utf-8');
const lines = content.split('\n');

const startPattern = `## [${version}]`;
let startIdx = -1;
let endIdx = lines.length;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith(startPattern)) {
    startIdx = i;
  } else if (startIdx !== -1 && lines[i].startsWith('## [')) {
    endIdx = i;
    break;
  }
}

if (startIdx === -1) {
  console.error(`Version [${version}] not found in CHANGELOG.md`);
  process.exit(1);
}

const section = lines.slice(startIdx, endIdx).join('\n');
console.log(section);
