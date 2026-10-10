import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES = join(import.meta.dirname, 'packages');

/** Every published package, each converted with the `typedoc.config.mjs` beside it. */
function publishedPackages() {
  const dirs = [];
  for (const name of readdirSync(PACKAGES).sort()) {
    const manifest = join(PACKAGES, name, 'package.json');
    if (!existsSync(manifest)) continue;
    if (JSON.parse(readFileSync(manifest, 'utf8')).private) continue;
    if (!existsSync(join(PACKAGES, name, 'typedoc.config.mjs'))) {
      throw new Error(`packages/${name} is published but has no typedoc.config.mjs`);
    }
    dirs.push(`packages/${name}`);
  }
  return dirs;
}

/** @type {Partial<import('typedoc').TypeDocOptions>} */
export default {
  entryPointStrategy: 'packages',
  entryPoints: publishedPackages(),
  out: 'dist-demo/api',
  name: 'weasel API',
  readme: 'README.md',
  plugin: ['./typedoc/plugin.mjs'],
  categorizeByGroup: false,
  navigation: {
    includeCategories: true,
    includeGroups: false,
  },
  packageOptions: {
    excludePrivate: true,
    excludeInternal: true,
    excludeExternals: true,
    exclude: ['**/*.test.ts', '**/*.test.tsx'],
    skipErrorChecking: true,
  },
};
