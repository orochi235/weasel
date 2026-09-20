/**
 * Every `var(--wzl-*)` in live source names a property something declares: a
 * theme token, or a custom property the same package sets itself. A read of a
 * name nothing declares resolves to nothing and silently drops the declaration
 * it sits in — how the May token vocabulary (`--wzl-text`, `--wzl-panel-bg`)
 * outlived its themes.
 *
 * The exception is an override hook: a property a component reads, with a
 * fallback, purely so a consumer can set it on a container. Those are listed
 * in `HOOKS` and must carry the fallback.
 *
 * Runs under tsx so theme modules resolve through the root tsconfig's paths to
 * source, with no build first.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Override hooks: read with a fallback, declared by no theme on purpose. */
export const HOOKS = new Set([
  '--wzl-disclosure-gap',
  '--wzl-disclosure-target',
  '--wzl-number-field-width',
  '--wzl-prefs-column-width',
  '--wzl-prop-number-width',
  '--wzl-prop-text-width',
  '--wzl-property-readout-w',
  '--wzl-swatch-size',
  '--wzl-timeline-label-w',
  '--wzl-timeline-value-axis-w',
]);

export interface SourceFile {
  readonly path: string;
  readonly source: string;
}

export interface Offender {
  readonly file: string;
  readonly line: number;
  readonly name: string;
  readonly reason: string;
}

const READ = /var\(\s*(--wzl-[\w-]+)\s*(,)?/g;
const CSS_DECL = /(?<![\w(-])(--wzl-[\w-]+)\s*:/g;
const JS_DECL = /['"`](--wzl-[\w-]+)['"`]\s*[:,)\]]/g;

/** `packages/ui/src/x.css` → `packages/ui`: the scope a local declaration covers. */
const scopeOf = (path: string) => path.split('/').slice(0, 2).join('/');

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

export function findUndeclaredReads(
  files: readonly SourceFile[],
  themeTokens: ReadonlySet<string>,
  hooks: ReadonlySet<string> = HOOKS,
): Offender[] {
  const local = new Map<string, Set<string>>();
  for (const { path, source } of files) {
    const scope = local.get(scopeOf(path)) ?? new Set();
    const code = stripComments(source);
    for (const m of code.matchAll(CSS_DECL)) scope.add(m[1]);
    for (const m of code.matchAll(JS_DECL)) scope.add(m[1]);
    local.set(scopeOf(path), scope);
  }

  const out: Offender[] = [];
  for (const { path, source } of files) {
    const declared = local.get(scopeOf(path))!;
    stripComments(source)
      .split('\n')
      .forEach((line, i) => {
        for (const [, name, comma] of line.matchAll(READ)) {
          if (themeTokens.has(name) || declared.has(name)) continue;
          if (!hooks.has(name)) {
            out.push({ file: path, line: i + 1, name, reason: 'declared by no theme' });
          } else if (!comma) {
            out.push({ file: path, line: i + 1, name, reason: 'override hook read without a fallback' });
          }
        }
      });
  }
  return out;
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-demo', 'dist-examples', 'generated']);
const isSource = (name: string) =>
  /\.(css|less|ts|tsx)$/.test(name) && !/\.(test|spec|stories)\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts');

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (isSource(entry)) yield full;
  }
}

interface ThemeLike {
  readonly tokens: Record<string, unknown>;
  readonly extends: ThemeLike | null;
}

const isTheme = (v: unknown): v is ThemeLike =>
  typeof v === 'object' && v !== null && 'tokens' in v && 'extends' in v && typeof (v as ThemeLike).tokens === 'object';

/** Every token of every baked theme, and of every theme a live module builds with `defineTheme`. */
async function themeTokens(root: string, files: readonly SourceFile[]): Promise<Set<string>> {
  const names = new Set<string>();
  const { BAKED_THEMES } = await import(pathToFileURL(join(root, 'packages/theme/src/generated/themes.ts')).href);
  for (const t of Object.values(BAKED_THEMES) as ThemeLike[]) for (const n of Object.keys(t.tokens)) names.add(`--wzl-${n}`);

  const modules = files.filter((f) => /\.tsx?$/.test(f.path) && /=\s*defineTheme\(/.test(f.source));
  for (const f of modules) {
    const mod: Record<string, unknown> = await import(pathToFileURL(join(root, f.path)).href);
    for (const v of Object.values(mod)) {
      for (let t = isTheme(v) ? v : null; t; t = t.extends) for (const n of Object.keys(t.tokens)) names.add(`--wzl-${n}`);
    }
  }
  return names;
}

const invokedDirectly = process.argv[1]?.endsWith('check-token-reads.ts');
if (invokedDirectly) {
  const root = process.cwd();
  const dirs = ['packages', 'apps'].map((d) => join(root, d));
  const files = dirs.flatMap((d) => [...walk(d)]).map((f) => ({ path: relative(root, f), source: readFileSync(f, 'utf8') }));
  const offenders = findUndeclaredReads(files, await themeTokens(root, files));
  for (const o of offenders) console.error(`${o.file}:${o.line}  ${o.name}  ${o.reason}`);
  if (offenders.length > 0) {
    console.error(`\n${offenders.length} --wzl-* read(s) nothing declares. Point them at a theme token, or add a real override hook to HOOKS in scripts/check-token-reads.ts.`);
    process.exit(1);
  }
  console.log(`token reads: clean (${files.length} files)`);
}
