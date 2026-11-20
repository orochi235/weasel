import { existsSync, globSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, matchesGlob, resolve } from 'node:path';
import { KIT_PATH_ROOT, KIT_PATHS } from './vite-aliases.ts';

const SCRIPT = /\.(ts|tsx|js|jsx|mjs)$/;
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const KIT_ROOT = resolve(import.meta.dirname, '..', KIT_PATH_ROOT);

// A path is relative, or one of core's bare kit paths (`core/scene/types`), which name one file as surely.
const PATH = `(?:\\.{1,2}|${KIT_PATHS.join('|')})\\/[^']+`;
// `import type`, `export type` and `typeof import()` are erased, so they load nothing; `import { type X }` is kept under
// verbatimModuleSyntax.
const IMPORT = new RegExp(`\\b(?:import|export)\\s+(?!type\\s)(?:[^'";]*?\\bfrom\\s*)?'(${PATH})'|(?<!\\btypeof\\s*)\\bimport\\(\\s*'(${PATH})'\\s*\\)`, 'g');
const IS_PATH = new RegExp(`^${PATH}$`);

/** Whether a specifier names a file by path rather than a package. */
export const isPathImport = (specifier: string) => IS_PATH.test(specifier);

/** The specifiers by path a source file loads at run time, type-only imports left out. */
export function pathImportsIn(code: string): string[] {
  return [...code.matchAll(IMPORT)].map((m) => (m[1] ?? m[2])!);
}

// `import.meta.glob('./x/*.ts')` or `import.meta.glob(['./a/*.ts', '!./a/b.ts'])`, its patterns written as literals.
const GLOB = /\bimport\.meta\.glob(?:<[^>]*>)?\(\s*(\[[^\]]*\]|'[^']*')/g;

/** The files the relative `import.meta.glob` patterns in a source file load, found from `fromDir`; a `!` pattern excludes. */
export function globImportsIn(code: string, fromDir: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(GLOB)) {
    const patterns = [...m[1]!.matchAll(/'([^']*)'/g)].map((p) => p[1]!).filter((p) => p.replace(/^!/, '').startsWith('.'));
    const include = patterns.filter((p) => !p.startsWith('!')).map((p) => join(fromDir, p));
    const exclude = patterns.filter((p) => p.startsWith('!')).map((p) => join(fromDir, p.slice(1)));
    if (include.length === 0) continue;
    for (const path of globSync(include, { exclude: (name) => name === 'node_modules' })) {
      // A failed browser run leaves `__screenshots__/<file>.stories.tsx/` directories that match a story glob.
      if (!statSync(path).isFile()) continue;
      if (!exclude.some((pattern) => matchesGlob(path, pattern))) out.push(path);
    }
  }
  return out;
}

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

/** The script a specifier by path names, as the dev server finds it; `undefined` for a stylesheet or asset. */
export function resolvePath(fromDir: string, specifier: string): string | undefined {
  const base = resolve(specifier.startsWith('.') ? fromDir : KIT_ROOT, specifier.split('?')[0]!);
  if (SCRIPT.test(base) && isFile(base)) return base;
  for (const ext of EXTENSIONS) if (isFile(base + ext)) return base + ext;
  for (const ext of EXTENSIONS) if (isFile(`${base}/index${ext}`)) return `${base}/index${ext}`;
  return undefined;
}

/** Every script `files` load by relative path or relative glob, `files` included, read on through each reached file `follow` admits. */
export function reachByPath(files: Iterable<string>, follow: (file: string) => boolean = () => true): Set<string> {
  const seen = new Set<string>();
  const seeds = new Set(files);
  const queue = [...seeds];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!seeds.has(file) && !follow(file)) continue;
    let code: string;
    try { code = readFileSync(file, 'utf8'); } catch { continue; }
    for (const spec of pathImportsIn(code)) {
      const target = resolvePath(dirname(file), spec);
      if (target && !target.includes('/node_modules/')) queue.push(target);
    }
    for (const target of globImportsIn(code, dirname(file))) if (SCRIPT.test(target)) queue.push(target);
  }
  return seen;
}
