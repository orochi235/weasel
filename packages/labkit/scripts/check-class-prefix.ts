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

const CLASS_ATTR = 'className=';
const SENTINEL = '\u0000';
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

/**
 * Reads the source of a `className=` value, whatever its form: a bare string, a
 * braced string, a ternary, or a template literal. Returns the index just past it.
 */
function readClassValue(src: string, from: number): { value: string; next: number } | null {
  let i = from;
  while (i < src.length && /\s/.test(src[i] ?? '')) i++;
  const ch = src[i];
  if (ch === '"' || ch === "'") {
    const end = src.indexOf(ch, i + 1);
    if (end === -1) return null;
    return { value: src.slice(i, end + 1), next: end + 1 };
  }
  if (ch !== '{') return null;
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) return { value: src.slice(i + 1, j), next: j + 1 };
    }
  }
  return null;
}

/**
 * Every class name a `className` value can contribute. Only string literals name
 * classes — an interpolation's operators and identifiers do not, so `?`, `:` and
 * `??` must not be mistaken for one. Interpolations are still descended into,
 * because the branches of a ternary are class names too.
 */
function classTokens(value: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < value.length) {
    const ch = value[i];
    if (ch === "'" || ch === '"') {
      const end = value.indexOf(ch, i + 1);
      if (end === -1) break;
      tokens.push(...value.slice(i + 1, end).split(/\s+/));
      i = end + 1;
      continue;
    }
    if (ch === '`') {
      // Interpolations become a sentinel so adjacency survives the split: a
      // token that is *only* the sentinel is a whole class the expression
      // produces, while one glued to text is a fragment being spliced into a
      // name (`lk-swatch--${mark}`) and names nothing on its own.
      const interps: string[] = [];
      let text = '';
      let j = i + 1;
      while (j < value.length && value[j] !== '`') {
        if (value[j] === '$' && value[j + 1] === '{') {
          let depth = 0;
          const start = j + 2;
          for (; j < value.length; j++) {
            if (value[j] === '{') depth++;
            else if (value[j] === '}') {
              depth--;
              if (depth === 0) break;
            }
          }
          interps.push(value.slice(start, j));
          text += SENTINEL;
          j++;
          continue;
        }
        text += value[j];
        j++;
      }
      let consumed = 0;
      for (const part of text.split(/\s+/).filter(Boolean)) {
        const count = part.split(SENTINEL).length - 1;
        if (count === 0) tokens.push(part);
        else if (part === SENTINEL) tokens.push(...classTokens(interps[consumed] ?? ''));
        consumed += count;
      }
      i = j + 1;
      continue;
    }
    i++;
  }
  return tokens.filter(Boolean);
}

function checkTsxFile(file: string): void {
  const content = readFileSync(file, 'utf8');
  let from = 0;
  for (;;) {
    const at = content.indexOf(CLASS_ATTR, from);
    if (at === -1) break;
    const read = readClassValue(content, at + CLASS_ATTR.length);
    from = read ? read.next : at + CLASS_ATTR.length;
    if (!read) continue;
    const line = content.slice(0, at).split('\n').length;
    for (const cls of classTokens(read.value)) {
      if (!isAllowed(cls)) {
        offenders.push({ file: relative(ROOT, file), line, match: cls });
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
