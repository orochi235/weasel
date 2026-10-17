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

function specifiers(source, file, withTypes) {
  const result = parseSync(file, source, { lang: langOf(file), sourceType: 'module' });
  if (result.errors.length > 0) throw new Error(`${file}: ${result.errors[0].message}`);
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

/** `[start, specifier]` for every `require('…')` call in `program`. */
function requires(program) {
  const out = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (node === null || typeof node !== 'object') return;
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'require' &&
      node.arguments.length > 0
    ) {
      const arg = node.arguments[0];
      if (arg.type === 'Literal' && typeof arg.value === 'string') out.push([node.start, arg.value]);
      else if (arg.type === 'TemplateLiteral' && arg.expressions.length === 0) out.push([node.start, arg.quasis[0].value.cooked]);
    }
    for (const key in node) if (key !== 'parent') visit(node[key]);
  };
  visit(program);
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
