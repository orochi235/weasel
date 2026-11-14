// The names a module exports, read from its source by pattern: enough for an index.ts of re-exports and declarations.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const sourceOf = (base: string) => [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((path) => existsSync(path)) ?? null;

/** Every name `file` exports, following its relative `export *`; `seen` stops a cycle. */
export function exportNames(file: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>();
  if (seen.has(file) || !existsSync(file)) return names;
  seen.add(file);
  const source = readFileSync(file, 'utf8');
  for (const [, list] of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const item of list!.split(',')) {
      const name = item.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()!.trim();
      if (name) names.add(name);
    }
  }
  for (const [, name] of source.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) names.add(name!);
  for (const [, name] of source.matchAll(/export\s+\*\s+as\s+(\w+)\s+from/g)) names.add(name!);
  for (const [, spec] of source.matchAll(/export\s+\*\s+from\s+'(\.[^']*)'/g)) {
    const next = sourceOf(resolve(dirname(file), spec!));
    if (next) for (const name of exportNames(next, seen)) names.add(name);
  }
  return names;
}

/** `exportNames` of a folder's `index`, or none when it has no index. */
export function folderExports(folder: string): Set<string> {
  const index = sourceOf(resolve(folder, 'index'));
  return index ? exportNames(index) : new Set();
}
