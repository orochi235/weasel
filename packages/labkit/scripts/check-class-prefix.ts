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
      checkTsxFile(full);
    } else if (full.endsWith('.less')) {
      checkLessFile(full);
    }
  }
}

// Matches className="..." or className={'...'} or className={`...`}.
const TSX_CLASS_RE = /className=\s*\{?\s*['"`]([^'"`]+)['"`]\s*\}?/g;
// Matches CSS class selectors: a `.` followed by an identifier starting with a letter.
const LESS_CLASS_RE = /\.([a-zA-Z][\w-]*)/g;

function checkTsxFile(file: string): void {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    for (const match of line.matchAll(TSX_CLASS_RE)) {
      const classes = (match[1] ?? '').split(/\s+/).filter(Boolean);
      for (const cls of classes) {
        if (cls === '' || cls.includes('${')) continue;
        if (!cls.startsWith('lk-')) {
          offenders.push({ file: relative(ROOT, file), line: i + 1, match: cls });
        }
      }
    }
  }
}

function checkLessFile(file: string): void {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    // Strip line comments and `@import` lines (paths look like class selectors).
    const code = line.replace(/\/\/.*$/, '');
    if (/^\s*@import\b/.test(code)) continue;
    for (const match of code.matchAll(LESS_CLASS_RE)) {
      const cls = match[1] ?? '';
      if (!cls.startsWith('lk-')) {
        offenders.push({ file: relative(ROOT, file), line: i + 1, match: `.${cls}` });
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
  console.log(
    'All className literals (.tsx) and class selectors (.less) in src/ use the lk- prefix.',
  );
}
