/**
 * What a module imports, read by parsing it with oxc.
 *
 * `check:imports`, `check:react-free`, the `browser` project's dependency list and the
 * package docs all read imports through this, so they cannot disagree about what counts
 * as one — and text that only looks like an import (a string, a template, a comment) is
 * never read as one.
 */
import { parseSync } from 'oxc-parser';

export const SOURCE = /\.(ts|tsx|mts|js|mjs)$/;

/** Every specifier `file` (named for its grammar) imports at run time, as written, a `?query`
 *  included, in source order. A type-only import or re-export is erased at build and is not
 *  listed. */
export function importSpecifiers(source, file) {
  return specifiers(source, file, false);
}

/** Every specifier `file` names in an import, the type-only ones included: what it is written
 *  against. */
export function namedSpecifiers(source, file) {
  return specifiers(source, file, true);
}

/**
 * What a browser-test scan needs from `file` in one parse: its run-time specifiers, every
 * `import.meta.glob` with literal patterns (and whether it loads the matches as modules or, through
 * a `query`, as text or addresses), and the text of each `import()` or glob whose argument is not a
 * literal.
 */
export function scanImports(source, file) {
  const result = parse(source, file);
  const { globs, unreadable } = dynamicReads(result, source);
  return { specifiers: collect(result, source, false), globs, unreadable };
}

function specifiers(source, file, withTypes) {
  return collect(parse(source, file), source, withTypes);
}

function parse(source, file) {
  const result = parseSync(file, source, { lang: langOf(file), sourceType: 'module' });
  if (result.errors.length > 0) throw new Error(`${file}: ${result.errors[0].message}`);
  return result;
}

function collect(result, source, withTypes) {
  const { staticImports, staticExports, dynamicImports } = result.module;
  const found = [];
  for (const { start, moduleRequest, entries } of staticImports) {
    // An import naming nothing is kept for its side effects.
    if (withTypes || entries.length === 0 || entries.some((e) => !e.isType)) found.push([start, moduleRequest.value]);
  }
  for (const { start, entries } of staticExports) {
    const from = entries.filter((e) => e.moduleRequest !== null);
    if (from.length === 0) continue;
    if (withTypes || from.some((e) => !e.isType)) found.push([start, from[0].moduleRequest.value]);
  }
  for (const { start, moduleRequest } of dynamicImports) {
    const value = literal(source.slice(moduleRequest.start, moduleRequest.end));
    if (value !== null) found.push([start, value]);
  }
  if (/\brequire\s*\(/.test(source)) found.push(...requires(result.program));
  return found.sort((a, b) => a[0] - b[0]).map(([, value]) => value);
}

/** The grammar a file's extension names; anything unrecognized parses as JS. */
function langOf(file) {
  const m = /\.[cm]?([jt])s(x?)$/.exec(file);
  return m ? `${m[1]}s${m[2]}` : 'js';
}

/** The value of a string or substitution-free template literal, or `null` for any other
 *  expression. */
function literal(text) {
  const m = /^(['"])(.*)\1$/s.exec(text) ?? /^`([^`]*)`$/.exec(text);
  if (m === null) return null;
  const value = m[m.length - 1];
  return m[0][0] === '`' && value.includes('${') ? null : value;
}

function dynamicReads(result, source) {
  const globs = [];
  const unreadable = [];
  for (const { start, end, moduleRequest } of result.module.dynamicImports) {
    if (literal(source.slice(moduleRequest.start, moduleRequest.end)) === null) {
      unreadable.push(source.slice(start, end).split('\n')[0]);
    }
  }
  walk(result.program, (node) => {
    if (node.type !== 'CallExpression' || !isMetaGlob(node.callee)) return;
    const patterns = globPatterns(node.arguments[0]);
    if (patterns === null) {
      unreadable.push(source.slice(node.start, node.end).split('\n')[0]);
      return;
    }
    const options = node.arguments[1];
    const loadsText =
      options?.type === 'ObjectExpression' &&
      options.properties.some((p) => p.type === 'Property' && ['query', 'as'].includes(p.key.name ?? p.key.value));
    globs.push({ patterns, modules: !loadsText });
  });
  return { globs, unreadable };
}

function isMetaGlob(callee) {
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.name === 'glob' &&
    callee.object.type === 'MetaProperty' &&
    callee.object.meta.name === 'import' &&
    callee.object.property.name === 'meta'
  );
}

/** A glob argument's patterns: one string, or an array of them; `null` for anything else. */
function globPatterns(arg) {
  const one = stringOf(arg);
  if (one !== null) return [one];
  if (arg?.type !== 'ArrayExpression') return null;
  const all = arg.elements.map(stringOf);
  return all.includes(null) ? null : all;
}

function stringOf(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

function walk(node, visit) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  visit(node);
  for (const key in node) if (key !== 'parent') walk(node[key], visit);
}

/** `[start, specifier]` for every `require('…')` call in `program`. */
function requires(program) {
  const out = [];
  walk(program, (node) => {
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'require' &&
      node.arguments.length > 0
    ) {
      const value = stringOf(node.arguments[0]);
      if (value !== null) out.push([node.start, value]);
    }
  });
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
