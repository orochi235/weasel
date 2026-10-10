import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// A package's own tsconfig maps only some siblings to source; the rest resolve to
// `dist/*.d.ts`, which documents a build artifact and needs a build to exist.
const DOCS_TSCONFIG = join(import.meta.dirname, 'tsconfig.json');

/** `exports` keys that are not API a consumer imports types from. */
const NOT_DOCUMENTED = new Set(['./package.json', './test-seams', './internal']);

/**
 * The source file behind each public entry in a package's `exports` map.
 *
 * @param {string} packageDir absolute path to the package
 * @param {(exportKey: string) => string | undefined} [sourceOf] names the source of an
 *   export built from somewhere other than the `src/` mirror of its `dist/` path
 * @returns {{ specifier: string, source: string }[]} what a consumer imports, and the
 *   file that defines it, relative to the package
 */
export function publicEntries(packageDir, sourceOf = () => undefined) {
  const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  const entries = [];

  for (const [key, value] of Object.entries(pkg.exports ?? {})) {
    // `./components/*` republishes what the root barrel already exports.
    if (NOT_DOCUMENTED.has(key) || key.endsWith('.css') || key.includes('*')) continue;

    const types = typesOf(value);
    if (!types?.endsWith('.d.ts')) {
      throw new Error(`${pkg.name}: export "${key}" names no .d.ts file`);
    }

    const stem = types.replace(/^\.\/dist\//, 'src/').replace(/\.d\.ts$/, '');
    const candidates = [sourceOf(key) ?? `${stem}.ts`, `${stem}.tsx`];
    const source = candidates.find((file) => existsSync(join(packageDir, file)));
    if (!source) {
      throw new Error(`${pkg.name}: export "${key}" has no source at ${candidates.join(' or ')}`);
    }
    entries.push({ specifier: pkg.name + key.slice(1), source });
  }
  return entries;
}

/** @param {unknown} value an `exports` target: a path, or conditions nesting one */
function typesOf(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  return typesOf(value.types ?? value.import ?? value.default);
}

/**
 * One package's TypeDoc options. Everything the packages share lives in the
 * root config's `packageOptions`.
 *
 * @param {string} packageDir absolute path to the package
 * @param {{ sourceOf?: (exportKey: string) => string | undefined } & Record<string, unknown>} [own]
 *   `sourceOf` as in `publicEntries`; everything else is passed to TypeDoc
 */
export function packageOptions(packageDir, { sourceOf, ...own } = {}) {
  const entries = publicEntries(packageDir, sourceOf);
  ENTRY_SPECIFIERS.set(packageDir, new Map(entries.map((e) => [join(packageDir, e.source), e.specifier])));
  return { entryPoints: entries.map((e) => e.source), tsconfig: DOCS_TSCONFIG, ...own };
}

/** Per package directory: absolute entry source to the specifier it is imported by. */
const ENTRY_SPECIFIERS = new Map();

/**
 * @param {string} sourceFile absolute path to an entry point's source
 * @returns {string | undefined} the specifier that entry is imported by
 */
export function specifierOf(sourceFile) {
  for (const bySource of ENTRY_SPECIFIERS.values()) {
    const specifier = bySource.get(sourceFile);
    if (specifier) return specifier;
  }
  return undefined;
}
