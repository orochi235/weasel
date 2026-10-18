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
/** A string literal, captured, or a comment. Strings come first so a glob such as `'**\/*.ts'` is not read as one. */
const TOKEN = /('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
const STRING = /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g;
/** A string literal with nothing substituted into it, at the start of the text. */
const LITERAL = /^(?:'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\$])*)`)/;
const DYNAMIC = /(?<![.\w$])import\s*\(\s*/g;
const GLOB = /\bimport\.meta\.glob\s*(?:<[^()]*?>)?\s*\(\s*/g;

function stripComments(text) {
  return text.replace(TOKEN, (match, string) => string ?? '');
}

/** `text` with every string's contents blanked to spaces, so positions still line up with it. */
function blankStrings(text) {
  return text.replace(STRING, (match) => match[0] + ' '.repeat(match.length - 2) + match[match.length - 1]);
}

/** Every specifier `source` imports at run time, as written, a `?query` included. */
export function importSpecifiers(source) {
  return specifiersIn(stripComments(source).replace(TYPE_ONLY, ''));
}

/** Every specifier `source` names in an import, the type-only ones included: what it is written against. */
export function namedSpecifiers(source) {
  return specifiersIn(stripComments(source));
}

function specifiersIn(text) {
  return [...text.matchAll(SPECIFIER)].map((match) => match[2]);
}

/** The value of the string literal at the start of `text`, or `undefined` if none is there. */
function literalAt(text) {
  const match = LITERAL.exec(text);
  return match && { value: match[1] ?? match[2] ?? match[3], length: match[0].length };
}

/** The literal patterns of an `import.meta.glob` argument at the start of `text`: one string, or an array of them. */
function globPatternsAt(text) {
  const one = literalAt(text);
  if (one) return { patterns: [one.value], length: one.length };
  if (text[0] !== '[') return undefined;
  const patterns = [];
  let at = 1;
  for (;;) {
    at += /^[\s,]*/.exec(text.slice(at))[0].length;
    if (text[at] === ']') return { patterns, length: at + 1 };
    const next = literalAt(text.slice(at));
    if (!next) return undefined;
    patterns.push(next.value);
    at += next.length;
  }
}

/**
 * Every `import.meta.glob` in `source` with literal patterns, and whether it loads the files it matches
 * as modules or, through a `query`, as text or addresses.
 */
export function globImports(source) {
  const text = stripComments(source);
  const out = [];
  for (const match of blankStrings(text).matchAll(GLOB)) {
    const rest = text.slice(match.index + match[0].length);
    const found = globPatternsAt(rest);
    if (!found) continue;
    const options = /^\s*,\s*(\{[^)]*)/.exec(rest.slice(found.length))?.[1] ?? '';
    out.push({ patterns: found.patterns, modules: !/\b(?:query|as)\s*:/.test(options) });
  }
  return out;
}

/** The text of each `import()` or `import.meta.glob()` in `source` whose argument is not a literal. */
export function unreadableImports(source) {
  const text = stripComments(source);
  const blanked = blankStrings(text);
  const out = [];
  for (const pattern of [DYNAMIC, GLOB]) {
    for (const match of blanked.matchAll(pattern)) {
      const rest = text.slice(match.index + match[0].length);
      const readable = pattern === DYNAMIC ? literalAt(rest) : globPatternsAt(rest);
      if (!readable) out.push(text.slice(match.index, match.index + match[0].length + 40).split('\n')[0]);
    }
  }
  return out;
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
