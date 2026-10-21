import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SCRIPT = /\.(ts|tsx|js|jsx|mjs)$/;
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

// `import type` and `export type` are erased, so they load nothing; `import { type X }` is kept under verbatimModuleSyntax.
const RELATIVE = /\b(?:import|export)\s+(?!type\s)(?:[^'";]*?\bfrom\s*)?'(\.{1,2}\/[^']+)'|\bimport\(\s*'(\.{1,2}\/[^']+)'\s*\)/g;

/** The relative specifiers a source file loads at run time, type-only imports left out. */
export function relativeImportsIn(code: string): string[] {
  return [...code.matchAll(RELATIVE)].map((m) => (m[1] ?? m[2])!);
}

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

/** The script a relative specifier names, as the dev server finds it; `undefined` for a stylesheet or asset. */
export function resolveRelative(fromDir: string, specifier: string): string | undefined {
  const base = resolve(fromDir, specifier.split('?')[0]!);
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
    for (const spec of relativeImportsIn(code)) {
      const target = resolveRelative(dirname(file), spec);
      if (target && !target.includes('/node_modules/')) queue.push(target);
    }
  }
  return seen;
}
