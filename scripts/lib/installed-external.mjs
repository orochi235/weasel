import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A package build's `external`: everything a consumer installs stays external, subpaths included, so each resolves
 * to one copy and a context is never split from its readers. Every `@weasel-js/` specifier does too, declared or not,
 * so an undeclared one reaches `check:declared-imports` and the smoke test's audit instead of being inlined through
 * the tsconfig paths. `npm run check:bundled-deps` fails a build that inlines one.
 * @param {string} packageDir
 * @returns {(id: string) => boolean}
 */
export function installedExternal(packageDir) {
  const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  const installed = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {}), 'react-dom'];
  return (id) => id.startsWith('@weasel-js/') || installed.some((d) => id === d || id.startsWith(`${d}/`));
}
