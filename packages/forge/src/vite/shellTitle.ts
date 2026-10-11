import type * as t from '@babel/types';
import { type Bindings, calleeOf, exportedName, objectOf, parseFile, prop, stringOf } from './ast.ts';

/**
 * The `title` a shell config module's default export names, read from its source: the served document carries it
 * before any script runs. Undefined when the module names none, or builds it in a way that only running it tells.
 */
export function shellTitle(code: string, file: string): string | undefined {
  let program: t.Program;
  try {
    program = parseFile(code, file);
  } catch {
    return undefined;
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
  return stringOf(prop(objectOf(config, bindings, new Set(wrapper ? [wrapper] : [])), 'title'), bindings);
}
