/**
 * The source file behind each entry in a package's `exports` map.
 *
 * `exports` says what a consumer may import; this says which file in `src/`
 * that is. The dev aliases, the API reference, and the check on tsconfig
 * `paths` all read it, so a specifier resolves to one module everywhere.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * Entries built from somewhere other than the `src/` mirror of their `dist/`
 * path, by package directory. A `*` stands for the entry's name.
 */
const BUILT_FROM = {
  core: { './*': 'src/import-shims/*.ts' },
  forge: {
    './preview-api': 'src/csf/shims/preview-api.ts',
    './shell.css': 'src/shell/shell.css',
    './frame.css': 'src/frame/frame.css',
  },
  'icons-plugin': { './virtual': 'virtual.d.ts' },
  labkit: { './styles.css': 'src/styles.less' },
  theme: { './tokens.css': 'src/generated/tokens.css' },
};

/** An app's source, importable from another app as `<alias>/<path>`. */
export const APP_SOURCES = { '@draw': 'apps/draw/src', '@editor': 'apps/shared/editor/src' };

/** In-repo test helpers every package may keep under `src/testing/`, importable here and never published. */
export const TESTING = 'testing';

/**
 * @typedef {object} PackageEntry
 * @property {string} key the `exports` key, `./react`
 * @property {string} specifier what a consumer imports, `@weasel-js/prefs/react`; `*` intact for a wildcard
 * @property {string | null} source the file it is built from, relative to the package and `*` intact; `null`
 *   for a file only a build produces
 * @property {string | null} types the `.d.ts` it publishes, or `null` for an asset
 */

/**
 * @param {string} packageDir absolute path to the package
 * @returns {PackageEntry[]}
 */
export function packageEntries(packageDir) {
  const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  const builtFrom = BUILT_FROM[basename(packageDir)] ?? {};
  const entries = [];
  for (const [key, value] of Object.entries(pkg.exports ?? {})) {
    if (key === './package.json') continue;
    const target = targetOf(value);
    if (!target) continue;
    const specifier = key === '.' ? pkg.name : pkg.name + key.slice(1);
    const source = sourceOf(packageDir, key, target, builtFrom);
    entries.push({ key, specifier, source, types: target.endsWith('.d.ts') ? target : null });
  }
  return entries;
}

/** @param {unknown} value an `exports` target: a path, or conditions nesting one */
function targetOf(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  return targetOf(value.types ?? value.import ?? value.default);
}

function sourceOf(packageDir, key, target, builtFrom) {
  const has = (file) => {
    const [dir, rest] = file.split('*');
    if (rest === undefined) return existsSync(join(packageDir, file));
    const holder = join(packageDir, dir);
    return existsSync(holder) && readdirSync(holder).some((name) => existsSync(join(holder, name + rest)));
  };
  const mirror = target.replace(/^\.\/dist\//, 'src/');
  const stem = mirror.replace(/\.d\.ts$/, '');
  const named = builtFrom[key];
  const shimmed = key !== '.' && builtFrom['./*']?.replace('*', key.slice(2));
  const candidates = target.endsWith('.d.ts')
    ? [named, shimmed, `${stem}.entry.ts`, `${stem}.ts`, `${stem}.tsx`]
    : [named, mirror];
  return candidates.find((file) => file && has(file)) ?? null;
}

/**
 * Every workspace package under `packages/`, with its entries.
 *
 * @param {string} repoRoot
 * @returns {{ dir: string, name: string, private: boolean, entries: PackageEntry[] }[]}
 */
export function workspaceEntries(repoRoot) {
  const packagesDir = join(repoRoot, 'packages');
  const out = [];
  for (const name of readdirSync(packagesDir).sort()) {
    const dir = join(packagesDir, name);
    if (!statSync(dir).isDirectory() || !existsSync(join(dir, 'package.json'))) continue;
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    out.push({ dir, name: pkg.name, private: pkg.private === true, entries: packageEntries(dir) });
  }
  return out;
}
