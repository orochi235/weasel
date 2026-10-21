import { readFileSync } from 'node:fs';
import type * as t from '@babel/types';
import { type Bindings, calleeOf, exportedName, objectOf, parseFile, prop, stringOf } from './ast.ts';

/** A shell config module's default export as the object literal its source writes, with the file's top-level `const`s. */
function configOf(code: string, file: string): { config: t.ObjectExpression | null; bindings: Bindings } | null {
  let program: t.Program;
  try {
    program = parseFile(code, file);
  } catch {
    return null;
  }
  const bindings: Bindings = new Map();
  let config: t.Node | undefined;
  for (const stmt of program.body) {
    if (stmt.type === 'VariableDeclaration') {
      for (const d of stmt.declarations) if (d.id.type === 'Identifier' && d.init) bindings.set(d.id.name, d.init);
    }
    if (stmt.type === 'ExportDefaultDeclaration') config = stmt.declaration;
    if (stmt.type !== 'ExportNamedDeclaration' || stmt.source) continue;
    for (const spec of stmt.specifiers) {
      if (spec.type === 'ExportSpecifier' && exportedName(spec.exported) === 'default') config = spec.local;
    }
  }
  // Whatever wraps the object, `defineShellConfig` or a project's own helper, is taken to hand it back.
  const wrapper = calleeOf(config, bindings);
  return { config: objectOf(config, bindings, new Set(wrapper ? [wrapper] : [])), bindings };
}

/**
 * The `title` a shell config module's default export names, read from its source: the served document carries it
 * before any script runs. Undefined when the module names none, or builds it in a way that only running it tells.
 */
export function shellTitle(code: string, file: string): string | undefined {
  const read = configOf(code, file);
  return read ? stringOf(prop(read.config, 'title'), read.bindings) : undefined;
}

/** The array literal `node` is written as, through casts and top-level `const`s. */
function arrayOf(node: t.Node | undefined, bindings: Bindings, depth = 0): t.ArrayExpression | null {
  if (!node || depth > 16) return null;
  if (node.type === 'ArrayExpression') return node;
  if (node.type === 'Identifier') return arrayOf(bindings.get(node.name), bindings, depth + 1);
  if ('expression' in node && (node.type.startsWith('TS') || node.type === 'ParenthesizedExpression')) {
    return arrayOf(node.expression as t.Node, bindings, depth + 1);
  }
  return null;
}

const originOf = (url: string | undefined): string[] => {
  if (url === undefined) return [];
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? [] : [origin];
  } catch {
    return [];
  }
};

/**
 * The origins a shell config's `capture.allowOrigins` lists, read from its source as the title is: the dev server
 * reads it without running the module. An entry that is not a string written out, or not a URL, is left out.
 */
export function shellAllowOrigins(code: string, file: string): string[] {
  const read = configOf(code, file);
  if (!read) return [];
  const capture = objectOf(prop(read.config, 'capture'), read.bindings, new Set());
  const list = arrayOf(prop(capture, 'allowOrigins'), read.bindings);
  return (list?.elements ?? []).flatMap((el) => (el && el.type !== 'SpreadElement' ? originOf(stringOf(el, read.bindings)) : []));
}

/** What the dev server reads from a shell config module's source. */
export interface ShellFields {
  title: string | undefined;
  allowOrigins: readonly string[];
}

/** Reads `file`'s shell fields; none when there is no file or it cannot be read. */
export function readShellFields(file: string | undefined): ShellFields {
  let code: string;
  try {
    if (file === undefined) throw new Error('no shell config');
    code = readFileSync(file, 'utf8');
  } catch {
    return { title: undefined, allowOrigins: [] };
  }
  return { title: shellTitle(code, file), allowOrigins: shellAllowOrigins(code, file) };
}
