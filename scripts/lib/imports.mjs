/**
 * What a source file imports, read from its text.
 *
 * `check:imports` and the `browser` project's dependency list both read imports through this,
 * so the two cannot disagree about what counts as one.
 */

export const SOURCE = /\.(ts|tsx|mts|js|mjs)$/;

/** `from '…'`, `import '…'`, `import('…')`, and `require('…')`, on code with comments removed.
 *  A type-only import is erased at build and is not matched. */
const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g;
const TYPE_ONLY = /\b(?:import|export)\s+type\b[^;'"]*?\bfrom\s*(['"])[^'"\n]+\1/g;

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Every specifier `source` imports at run time, as written, a `?query` included. */
export function importSpecifiers(source) {
  const text = stripComments(source).replace(TYPE_ONLY, '');
  return [...text.matchAll(SPECIFIER)].map((match) => match[2]);
}

/** `@scope/name/sub` → `@scope/name`; `name/sub` → `name`. */
export function packageOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export function isBare(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return false;
  if (specifier.startsWith('node:') || specifier.startsWith('virtual:')) return false;
  return /^(@[\w.-]+\/)?[\w.-]+(\/.*)?$/.test(specifier);
}
