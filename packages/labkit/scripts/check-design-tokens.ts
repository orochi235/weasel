#!/usr/bin/env tsx
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

export interface Offender {
  file: string;
  line: number;
  match: string;
}

/** Files whose literals are deliberate: the starfield is structure rather than
 *  color, and the Foundations and story pages render literals to document what
 *  a token resolves to. */
const ALLOWLIST = ['theme/base.less', 'theme/Interstellar.stories.less', 'Foundations'];

const TOKENS_REL = 'packages/theme/src/generated/tokens.css';

// Anchored on cwd rather than import.meta.url: vitest serves this module over a
// non-file URL, so fileURLToPath throws there.
function repoRoot(): string {
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    if (existsSync(join(dir, TOKENS_REL))) return dir;
    if (dirname(dir) === dir)
      throw new Error(`could not locate ${TOKENS_REL} above ${process.cwd()}`);
  }
}

const ROOT = repoRoot();
const TOKENS_CSS = join(ROOT, TOKENS_REL);

const SCALE_TOKEN = /(--wzl-(?:font-size|font-weight|radius)[\w-]*)\s*:\s*([^;]+);/g;

/**
 * The size, weight and radius scales, read from the generated theme so this
 * check can't itself drift from the tokens it enforces.
 */
export function readTokenValues(file: string = TOKENS_CSS): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [, token, value] of readFileSync(file, 'utf8').matchAll(SCALE_TOKEN)) {
    if (token && value && !value.includes('var(')) values[token] = value.trim();
  }
  return values;
}

const TOKEN_VALUES = readTokenValues();

const RAW = [
  { name: 'font-size', re: /font-size:[^;}]*\b\d*\.?\d+(px|rem|em|pt|ex|ch)\b/ },
  { name: 'font-weight', re: /font-weight:[^;}]*(?<!-)\b[1-9]00\b/ },
  { name: 'border-radius', re: /border-radius:[^;}]*\b\d*\.?\d+(px|rem|em)\b/ },
];

// Five spellings of one semantic color, collapsed onto --wzl-danger in arc 4.
const STRAY_DANGER_COLORS = ['#ff5b5b', '#c43c3c', '#f04438', '#ffb3a8'];

// Innermost-first: `[^()]*` refuses a fallback containing parens, so repeated
// passes collapse nested var() from the inside out.
const VAR_CALL = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g;

/**
 * Rewrites `var()` away so the raw-literal rules see only literals the author
 * actually wrote. A known token's fallback is vetted against the scale and
 * dropped; an unknown token's fallback is left in place, because a literal
 * behind a local variable is still a literal.
 */
function resolveVars(
  line: string,
  tokens: Record<string, string>,
  onDisagree: (message: string) => void,
): string {
  let out = line;
  for (;;) {
    const next = out.replace(VAR_CALL, (_all, token: string, fallback?: string) => {
      const expected = tokens[token];
      if (expected === undefined) return fallback === undefined ? ' ' : ` ${fallback} `;
      if (fallback !== undefined && fallback.trim() !== expected) {
        onDisagree(
          `fallback disagrees with ${token}: got ${fallback.trim()}, token is ${expected}`,
        );
      }
      return ' ';
    });
    if (next === out) return out;
    out = next;
  }
}

export function findOffenders(
  file: string,
  source: string,
  tokens: Record<string, string> = TOKEN_VALUES,
): Offender[] {
  const allowlisted = ALLOWLIST.some((a) => file.includes(a));
  const out: Offender[] = [];
  source.split('\n').forEach((raw, i) => {
    const line = raw.replace(/\/\*.*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/, '$1');
    // The allowlist covers files that legitimately render literal scale values
    // to document them; a stray color is never legitimate, so it's checked everywhere.
    if (!allowlisted) {
      const code = resolveVars(line, tokens, (match) => out.push({ file, line: i + 1, match }));
      for (const { name, re } of RAW) {
        if (re.test(code)) out.push({ file, line: i + 1, match: `raw ${name}: ${raw.trim()}` });
      }
    }
    const stray = STRAY_DANGER_COLORS.find((c) => line.toLowerCase().includes(c));
    if (stray) {
      out.push({ file, line: i + 1, match: `stray danger color ${stray} — use var(--wzl-danger)` });
    }
  });
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.less') || full.endsWith('.css')) out.push(full);
  }
  return out;
}

const invokedDirectly = process.argv[1]?.endsWith('check-design-tokens.ts');
if (invokedDirectly) {
  const roots = [join(ROOT, 'packages/labkit/src'), join(ROOT, 'packages/ui/src')];
  const offenders = roots.flatMap((root) =>
    walk(root).flatMap((f) => findOffenders(relative(root, f), readFileSync(f, 'utf8'))),
  );
  for (const o of offenders) console.error(`${o.file}:${o.line}  ${o.match}`);
  if (offenders.length > 0) {
    console.error(`\n${offenders.length} design-token violation(s).`);
    process.exit(1);
  }
  console.log('design tokens: clean');
}
