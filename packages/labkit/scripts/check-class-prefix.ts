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

// State-modifier classes follow the BEM `is-`/`has-` convention: they are never
// used standalone, only compounded onto an `lk-` block class (e.g.
// `.lk-effect-card.is-expanded`), so they can't collide globally and are exempt
// from the `lk-` prefix rule.
const STATE_CLASS_RE = /^(?:is|has)-/;

// Classes a dependency's own stylesheet defines and matches on. labkit applies
// them verbatim — `.windease-zone` (windease/styles.css) supplies the
// containing block a tiled workspace needs — so renaming one to `lk-` would
// just stop it matching. The rule is about labkit's own classes not colliding
// globally; a vendor's class is not labkit's to rename.
const VENDOR_PREFIXES = ['windease-'];

function isAllowed(cls: string): boolean {
  return (
    cls.startsWith('lk-') ||
    STATE_CLASS_RE.test(cls) ||
    VENDOR_PREFIXES.some((p) => cls.startsWith(p))
  );
}

function checkTsxFile(file: string): void {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    for (const match of line.matchAll(TSX_CLASS_RE)) {
      const classes = (match[1] ?? '').split(/\s+/).filter(Boolean);
      for (const cls of classes) {
        if (cls === '' || cls.includes('${')) continue;
        if (!isAllowed(cls)) {
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
    // Strip line comments and string literals (url() paths look like class selectors).
    const code = line
      .replace(/\/\/.*$/, '')
      .replace(/'[^']*'/g, "''")
      .replace(/"[^"]*"/g, '""');
    if (/^\s*@import\b/.test(code)) continue;
    for (const match of code.matchAll(LESS_CLASS_RE)) {
      const cls = match[1] ?? '';
      if (!isAllowed(cls)) {
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
