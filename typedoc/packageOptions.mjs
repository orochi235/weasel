import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { packageEntries } from '../scripts/lib/packageEntries.mjs';

// A package's own tsconfig maps only some siblings to source; the rest resolve to
// `dist/*.d.ts`, which documents a build artifact and needs a build to exist.
const BASE_TSCONFIG = join(import.meta.dirname, 'tsconfig.json');

/** The file `docsTsconfig` writes in a package. Gitignored. */
const DOCS_TSCONFIG = 'tsconfig.docs.json';

/**
 * Write the tsconfig one package's reference is built from, and answer its path: the
 * shared options over that package's sources alone, so its program holds them and
 * what they import. A program over every package's sources also holds each
 * `declare module` a sibling aims at this package, and TypeScript then hands out
 * one symbol for the interface the barrel exports and another for the one a type in
 * it names. TypeDoc documents the first and cannot find the second.
 *
 * @param {string} packageDir absolute path to the package
 */
export function docsTsconfig(packageDir) {
  const path = join(packageDir, DOCS_TSCONFIG);
  const config = { extends: relative(packageDir, BASE_TSCONFIG), include: ['src'] };
  const text = `${JSON.stringify(config, null, 2)}\n`;
  if (!existsSync(path) || readFileSync(path, 'utf8') !== text) writeFileSync(path, text);
  return path;
}

/** `exports` keys that are not API a consumer imports types from. */
const NOT_DOCUMENTED = new Set(['./test-seams', './internal']);

/**
 * The source file behind each public entry in a package's `exports` map.
 *
 * @param {string} packageDir absolute path to the package
 * @returns {{ specifier: string, source: string }[]} what a consumer imports, and the
 *   file that defines it, relative to the package
 */
export function publicEntries(packageDir) {
  const entries = [];
  for (const { key, specifier, source, types } of packageEntries(packageDir)) {
    // `./components/*` republishes what the root barrel already exports.
    if (NOT_DOCUMENTED.has(key) || key.endsWith('.css') || key.includes('*')) continue;
    if (!types) throw new Error(`${nameOf(specifier, key)}: export "${key}" names no .d.ts file`);
    if (!source) throw new Error(`${nameOf(specifier, key)}: export "${key}" has no source under src/`);
    entries.push({ specifier, source });
  }
  return entries;
}

const nameOf = (specifier, key) => (key === '.' ? specifier : specifier.slice(0, -(key.length - 1)));

/**
 * One package's TypeDoc options. Everything the packages share lives in the
 * root config's `packageOptions`.
 *
 * @param {string} packageDir absolute path to the package
 * @param {Record<string, unknown>} [own] passed to TypeDoc
 */
export function packageOptions(packageDir, own = {}) {
  const entries = publicEntries(packageDir);
  ENTRY_SPECIFIERS.set(packageDir, new Map(entries.map((e) => [join(packageDir, e.source), e.specifier])));
  return { entryPoints: entries.map((e) => e.source), tsconfig: docsTsconfig(packageDir), ...own };
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
