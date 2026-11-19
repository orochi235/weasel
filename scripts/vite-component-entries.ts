import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A component package's build entries backing its `./components/*` subpath: one per directory under
 * `src/components` holding an `index.ts`, and one per catalog inside such a directory (Badge's `shapes`). The keys
 * mirror the source tree, which is where `tsc --emitDeclarationOnly` puts the matching `index.d.ts`, so one `*`
 * wildcard in `exports` lines up the JS and the types, and a component added later is reachable with no change to
 * the config or the manifest.
 *
 * A lowercase directory with no `index.ts` (`inspector`) groups components, each reached as
 * `./components/<group>/<Name>`. Any other directory with none (Foundations) is not an entry point; it reaches
 * consumers through whatever imports it.
 */
export function componentEntries(packageDir: string): Record<string, string> {
  const componentsDir = resolve(packageDir, 'src/components');
  const entries: Record<string, string> = {};
  const addCatalogs = (component: string): void => {
    for (const dirent of readdirSync(resolve(componentsDir, component), { withFileTypes: true })) {
      const dir = resolve(componentsDir, component, dirent.name);
      if (dirent.isDirectory() && readdirSync(dir).includes('index.ts')) entries[`components/${component}/${dirent.name}/index`] = resolve(dir, 'index.ts');
    }
  };
  const addComponents = (rel: string): void => {
    for (const dirent of readdirSync(resolve(componentsDir, rel), { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue;
      const name = rel ? `${rel}/${dirent.name}` : dirent.name;
      const dir = resolve(componentsDir, name);
      if (readdirSync(dir).includes('index.ts')) {
        entries[`components/${name}/index`] = resolve(dir, 'index.ts');
        addCatalogs(name);
      } else if (!rel && /^[a-z]/.test(dirent.name)) addComponents(name);
    }
  };
  addComponents('');
  return entries;
}
