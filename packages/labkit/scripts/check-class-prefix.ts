#!/usr/bin/env tsx
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

const offenders: Array<{ file: string; line: number; match: string }> = [];

function walk(dir: string): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (full.endsWith('.tsx')) {
      checkFile(full);
    }
  }
}

// Matches className="..." or className={'...'} or className={`...`}.
// Captures the literal string for prefix validation.
const CLASS_RE = /className=\s*\{?\s*['"`]([^'"`]+)['"`]\s*\}?/g;

function checkFile(file: string): void {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    for (const match of line.matchAll(CLASS_RE)) {
      const classes = (match[1] ?? '').split(/\s+/).filter(Boolean);
      for (const cls of classes) {
        // Skip dynamic interpolation fragments (e.g., conditional empty strings)
        if (cls === '' || cls.includes('${')) continue;
        if (!cls.startsWith('lk-')) {
          offenders.push({ file: relative(ROOT, file), line: i + 1, match: cls });
        }
      }
    }
  }
}

walk(SRC);

if (offenders.length > 0) {
  console.error('Class names must start with "lk-":');
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}  "${o.match}"`);
  }
  process.exit(1);
} else {
  console.log('All className literals in src/ use the lk- prefix.');
}
