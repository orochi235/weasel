import { type ParserPlugin, parse } from '@babel/parser';
import type * as t from '@babel/types';
import { storyId, storyNameFromExport } from '../story/ids';
import type { IndexEntry } from '../story/types';

type Bindings = Map<string, t.Node>;

/** The stories `code` declares, in source order, without running it. `file` is absolute; `autoTitle` titles a meta that names none. */
export function indexFile(code: string, file: string, autoTitle: string): IndexEntry[] {
  try {
    const plugins: ParserPlugin[] = ['typescript', 'decorators-legacy', ...(/\.[jt]sx$/.test(file) ? (['jsx'] as const) : [])];
    return indexProgram(parse(code, { sourceType: 'module', plugins }).program, file, autoTitle);
  } catch (err) {
    throw new Error(`${file}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
}

function indexProgram(program: t.Program, file: string, autoTitle: string): IndexEntry[] {
  const bindings: Bindings = new Map();
  const wrappers = new Set<string>();
  for (const stmt of program.body) {
    if (stmt.type === 'ImportDeclaration' && stmt.source.value === '@weasel-js/forge') {
      for (const spec of stmt.specifiers) {
        if (spec.type === 'ImportSpecifier' && ['meta', 'story'].includes(exportedName(spec.imported))) {
          wrappers.add(spec.local.name);
        }
      }
    }
    const decl = stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt;
    if (decl?.type === 'VariableDeclaration') {
      for (const d of decl.declarations) if (d.id.type === 'Identifier' && d.init) bindings.set(d.id.name, d.init);
    }
  }

  let metaNode: t.Node | undefined;
  const exported: { name: string; node: t.Node | undefined }[] = [];
  for (const stmt of program.body) {
    if (stmt.type === 'ExportDefaultDeclaration') metaNode = stmt.declaration;
    if (stmt.type !== 'ExportNamedDeclaration' || stmt.exportKind === 'type') continue;
    const decl = stmt.declaration;
    if (decl?.type === 'VariableDeclaration') {
      for (const d of decl.declarations) {
        if (d.id.type === 'Identifier') exported.push({ name: d.id.name, node: d.init ?? undefined });
      }
    } else if (decl?.type === 'FunctionDeclaration' && decl.id) {
      exported.push({ name: decl.id.name, node: undefined });
    }
    for (const spec of stmt.specifiers) {
      if (spec.type !== 'ExportSpecifier' || spec.exportKind === 'type') continue;
      const name = exportedName(spec.exported);
      const node = stmt.source ? undefined : bindings.get(spec.local.name);
      if (name === 'default') metaNode = node;
      else exported.push({ name, node });
    }
  }
  if (!metaNode && !program.body.some(isDefaultExport)) return [];

  const meta = objectOf(metaNode, bindings, wrappers);
  const title = stringProp(meta, 'title') ?? autoTitle;
  const include = storyFilter(meta, 'includeStories');
  const exclude = storyFilter(meta, 'excludeStories');

  return exported
    .filter(({ name }) => name !== '__namedExportsOrder')
    .filter(({ name }) => (!include || include(name)) && (!exclude || !exclude(name)))
    .map(({ name, node }) => {
      const spec = objectOf(node, bindings, wrappers);
      return {
        id: storyId(title, name),
        title,
        name: stringProp(spec, 'name') ?? stringProp(spec, 'storyName') ?? storyNameFromExport(name),
        exportName: name,
        file,
      };
    });
}

function isDefaultExport(stmt: t.Statement): boolean {
  if (stmt.type === 'ExportDefaultDeclaration') return true;
  return (
    stmt.type === 'ExportNamedDeclaration' &&
    stmt.specifiers.some((s) => s.type === 'ExportSpecifier' && exportedName(s.exported) === 'default')
  );
}

function exportedName(node: t.Identifier | t.StringLiteral): string {
  return node.type === 'Identifier' ? node.name : node.value;
}

/** The object literal `node` evaluates to, through casts, `meta(…)`/`story(…)` and top-level `const`s. */
function objectOf(node: t.Node | undefined, bindings: Bindings, wrappers: Set<string>, depth = 0): t.ObjectExpression | null {
  if (!node || depth > 16) return null;
  switch (node.type) {
    case 'ObjectExpression':
      return node;
    case 'TSSatisfiesExpression':
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return objectOf(node.expression, bindings, wrappers, depth + 1);
    case 'CallExpression':
      return node.callee.type === 'Identifier' && wrappers.has(node.callee.name)
        ? objectOf(node.arguments[0], bindings, wrappers, depth + 1)
        : null;
    case 'Identifier':
      return objectOf(bindings.get(node.name), bindings, wrappers, depth + 1);
    default:
      return null;
  }
}

function prop(obj: t.ObjectExpression | null, key: string): t.Node | undefined {
  for (const p of obj?.properties ?? []) {
    if (p.type !== 'ObjectProperty' || p.computed) continue;
    const name = p.key.type === 'Identifier' ? p.key.name : p.key.type === 'StringLiteral' ? p.key.value : null;
    if (name === key) return p.value;
  }
  return undefined;
}

function stringProp(obj: t.ObjectExpression | null, key: string): string | undefined {
  const value = prop(obj, key);
  return value?.type === 'StringLiteral' ? value.value : undefined;
}

/** `includeStories`/`excludeStories` as a predicate, when written as a string array or a regex literal. */
function storyFilter(obj: t.ObjectExpression | null, key: string): ((name: string) => boolean) | null {
  const value = prop(obj, key);
  if (value?.type === 'RegExpLiteral') {
    const re = new RegExp(value.pattern, value.flags.replace(/[gy]/g, ''));
    return (name) => re.test(name);
  }
  if (value?.type === 'ArrayExpression' && value.elements.every((e) => e?.type === 'StringLiteral')) {
    const names = new Set(value.elements.map((e) => (e as t.StringLiteral).value));
    return (name) => names.has(name);
  }
  return null;
}
