import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import type { IconTable } from '../table';

const read = (file: string): IconTable => JSON.parse(readFileSync(file, 'utf8')) as IconTable;

/** The table beside a generated icons.gen module. */
export function tableBeside(genFile: string): IconTable | undefined {
  const file = join(dirname(genFile), 'icons.table.json');
  return existsSync(file) ? read(file) : undefined;
}

/** The namespace a generated icons.gen module binds, read from its scopedIcon call. */
export function namespaceIn(genFile: string): string | undefined {
  return /scopedIcon<[^>]*>\(\s*['"]([^'"]+)['"]\s*\)/.exec(readFileSync(genFile, 'utf8'))?.[1];
}

/** The table a package directory declares through its `weaselIcons.table` field. */
export function declaredTable(pkgDir: string): IconTable | undefined {
  const pkgFile = join(pkgDir, 'package.json');
  if (!existsSync(pkgFile)) return undefined;
  const table = (JSON.parse(readFileSync(pkgFile, 'utf8')) as { weaselIcons?: { table?: string } }).weaselIcons?.table;
  return table && existsSync(join(pkgDir, table)) ? read(join(pkgDir, table)) : undefined;
}

/** Finds the package directory a file belongs to, caching by directory. */
export function packageDirFinder() {
  const cache = new Map<string, string | undefined>();
  const find = (dir: string): string | undefined => {
    if (cache.has(dir)) return cache.get(dir);
    const parent = dirname(dir);
    const out = existsSync(join(dir, 'package.json')) ? dir : parent === dir ? undefined : find(parent);
    cache.set(dir, out);
    return out;
  };
  return (file: string) => find(dirname(file));
}

/**
 * Every package declaring a table in a `node_modules` at `root` or above it, one level down
 * and under each scope. Dev uses this: vite pre-bundles dependencies with esbuild, which skips
 * the plugin's transform, so a dev server never sees their modules.
 */
export function installedTables(root: string): IconTable[] {
  const out: IconTable[] = [];
  for (let dir = root; ; dir = dirname(dir)) {
    const nm = join(dir, 'node_modules');
    if (existsSync(nm)) {
      const dirs = readdirSync(nm).flatMap((d) =>
        d.startsWith('@') ? readdirSync(join(nm, d)).map((s) => join(nm, d, s)) : [join(nm, d)],
      );
      for (const pkg of dirs) {
        const table = declaredTable(pkg);
        if (table) out.push(table);
      }
    }
    if (dir === parse(dir).root) return out;
  }
}
