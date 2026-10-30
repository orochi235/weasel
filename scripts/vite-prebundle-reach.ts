import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { KIT_PATH_ROOT, KIT_PATHS } from './vite-aliases.ts';

const SCRIPT = /\.(ts|tsx|js|jsx|mjs)$/;
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
const KIT_ROOT = resolve(import.meta.dirname, '..', KIT_PATH_ROOT);

// A path is relative, or one of core's bare kit paths (`core/scene/types`), which name one file as surely.
const PATH = `(?:\\.{1,2}|${KIT_PATHS.join('|')})\\/[^']+`;
// `import type` and `export type` are erased, so they load nothing; `import { type X }` is kept under verbatimModuleSyntax.
const IMPORT = new RegExp(`\\b(?:import|export)\\s+(?!type\\s)(?:[^'";]*?\\bfrom\\s*)?'(${PATH})'|\\bimport\\(\\s*'(${PATH})'\\s*\\)`, 'g');
const IS_PATH = new RegExp(`^${PATH}$`);

/** Whether a specifier names a file by path rather than a package. */
export const isPathImport = (specifier: string) => IS_PATH.test(specifier);

/** The specifiers by path a source file loads at run time, type-only imports left out. */
export function pathImportsIn(code: string): string[] {
  return [...code.matchAll(IMPORT)].map((m) => (m[1] ?? m[2])!);
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

/** Every script `files` load by relative path, `files` included, read on through each reached file `follow` admits. */
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
  }
  return seen;
}
