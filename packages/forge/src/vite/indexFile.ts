import type * as t from '@babel/types';
import type { Viewport } from '../protocol/messages.ts';
import { storyId, storyNameFromExport } from '../story/ids.ts';
import type { IndexEntry } from '../story/types.ts';
import {
  type Bindings,
  calleeOf,
  docOf,
  exportedName,
  isDefaultExport,
  objectOf,
  parseFile,
  prop,
  stringLiteral,
  stringProp,
} from './ast.ts';

/**
 * The stories `code` declares, in source order, without running it. `file` is absolute; `autoTitle` titles a meta
 * that names none. `wrappers` adds locals known to be forge's `meta` or `story` though imported from elsewhere.
 */
export function indexFile(code: string, file: string, autoTitle: string, wrappers: ReadonlySet<string> = new Set()): IndexEntry[] {
  try {
    return indexProgram(parseFile(code, file), file, autoTitle, wrappers);
  } catch (err) {
    throw new Error(`${file}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
}

/** An import that a story file's default export or a named export is a call to. */
export interface ForeignCallee {
  local: string;
  spec: string;
  imported: string;
}

/**
 * The imports, from anywhere but `@weasel-js/forge`, that the default export or a named export is a call to. Any of
 * them may be forge's `meta` or `story` re-exported through another module, which only resolving it can tell.
 */
export function foreignCallees(code: string, file: string): ForeignCallee[] {
  const program = parseFile(code, file);
  const { bindings } = scan(program, new Set());
  const imported = new Map<string, ForeignCallee>();
  const exported: (t.Node | null | undefined)[] = [];
  for (const stmt of program.body) {
    if (stmt.type === 'ImportDeclaration' && stmt.importKind !== 'type' && stmt.source.value !== '@weasel-js/forge') {
      for (const spec of stmt.specifiers) {
        if (spec.type === 'ImportNamespaceSpecifier' || (spec.type === 'ImportSpecifier' && spec.importKind === 'type')) continue;
        const name = spec.type === 'ImportDefaultSpecifier' ? 'default' : exportedName(spec.imported);
        imported.set(spec.local.name, { local: spec.local.name, spec: stmt.source.value, imported: name });
      }
    }
    if (stmt.type === 'ExportDefaultDeclaration') exported.push(stmt.declaration);
    if (stmt.type !== 'ExportNamedDeclaration' || stmt.exportKind === 'type') continue;
    if (stmt.declaration?.type === 'VariableDeclaration') exported.push(...stmt.declaration.declarations.map((d) => d.init));
    if (stmt.source) continue;
    for (const spec of stmt.specifiers) if (spec.type === 'ExportSpecifier') exported.push(bindings.get(exportedName(spec.local)));
  }
  const found = new Map<string, ForeignCallee>();
  for (const node of exported) {
    const hit = imported.get(calleeOf(node ?? undefined, bindings) ?? '');
    if (hit) found.set(hit.local, hit);
  }
  return [...found.values()];
}

/** The program's top-level `const` initializers, and its locals that are forge's `meta` or `story`. */
function scan(program: t.Program, extra: ReadonlySet<string>): { bindings: Bindings; wrappers: Set<string> } {
  const bindings: Bindings = new Map();
  const wrappers = new Set(extra);
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
  return { bindings, wrappers };
}

function indexProgram(program: t.Program, file: string, autoTitle: string, extra: ReadonlySet<string>): IndexEntry[] {
  const { bindings, wrappers } = scan(program, extra);

  let metaNode: t.Node | undefined;
  let metaDoc: string | undefined;
  const exported: { name: string; node: t.Node | undefined; doc: string | undefined }[] = [];
  for (const stmt of program.body) {
    if (stmt.type === 'ExportDefaultDeclaration') {
      metaNode = stmt.declaration;
      metaDoc = docOf(stmt);
    }
    if (stmt.type !== 'ExportNamedDeclaration' || stmt.exportKind === 'type') continue;
    const doc = docOf(stmt);
    const decl = stmt.declaration;
    if (decl?.type === 'VariableDeclaration') {
      for (const d of decl.declarations) {
        if (d.id.type === 'Identifier') exported.push({ name: d.id.name, node: d.init ?? undefined, doc: docOf(d) ?? doc });
      }
    } else if (decl?.type === 'FunctionDeclaration' && decl.id) {
      exported.push({ name: decl.id.name, node: undefined, doc });
    }
    for (const spec of stmt.specifiers) {
      if (spec.type !== 'ExportSpecifier' || spec.exportKind === 'type') continue;
      const name = exportedName(spec.exported);
      const node = stmt.source ? undefined : bindings.get(exportedName(spec.local));
      if (name === 'default') {
        metaNode = node;
        metaDoc ??= doc;
      } else exported.push({ name, node, doc });
    }
  }
  if (!metaNode && !program.body.some(isDefaultExport)) return [];

  const meta = objectOf(metaNode, bindings, wrappers);
  const title = stringProp(meta, 'title') ?? autoTitle;
  const include = storyFilter(meta, 'includeStories');
  const exclude = storyFilter(meta, 'excludeStories');
  const componentNode = prop(meta, 'component');
  const componentName = componentNode?.type === 'Identifier' ? componentNode.name : undefined;
  const metaIsolate = isolateOf(meta, bindings, wrappers, 'default');
  const metaTags = tagsOf(meta);
  const native = wrappers.has(calleeOf(metaNode, bindings) ?? '');

  return exported
    .filter(({ name }) => name !== '__namedExportsOrder')
    .filter(({ name }) => (!include || include(name)) && (!exclude || !exclude(name)))
    .map(({ name, node, doc }) => {
      const spec = objectOf(node, bindings, wrappers);
      const isolate = isolateOf(spec, bindings, wrappers, name) ?? metaIsolate;
      const tags = combineTags(metaTags, tagsOf(spec));
      const viewport = native ? viewportOf(spec, bindings, wrappers) : undefined;
      return {
        id: storyId(title, name),
        title,
        name: stringProp(spec, 'name') ?? stringProp(spec, 'storyName') ?? storyNameFromExport(name),
        exportName: name,
        file,
        ...(doc === undefined ? {} : { description: doc }),
        ...(metaDoc === undefined ? {} : { componentDescription: metaDoc }),
        ...(componentName === undefined ? {} : { componentName }),
        ...(isolate === undefined ? {} : { isolate }),
        ...(viewport === undefined ? {} : { viewport }),
        ...(tags === undefined ? {} : { tags }),
      };
    });
}

/**
 * The reason `obj` isolates its story: `isolate` on a native meta or story, `parameters.forge.isolate` in CSF.
 * It must be a string literal, because the shell reads it without importing the module.
 */
function isolateOf(obj: t.ObjectExpression | null, bindings: Bindings, wrappers: Set<string>, exportName: string): string | undefined {
  const parameters = objectOf(prop(obj, 'parameters'), bindings, wrappers);
  const forge = objectOf(prop(parameters, 'forge'), bindings, wrappers);
  const value = prop(obj, 'isolate') ?? prop(forge, 'isolate');
  if (value === undefined) return undefined;
  const literal = stringLiteral(value);
  if (literal === undefined) throw new Error(`${exportName}: isolate must be a string literal`);
  return literal;
}

/** A native story's `viewport`, when both sides are number literals. */
function viewportOf(obj: t.ObjectExpression | null, bindings: Bindings, wrappers: Set<string>): Viewport | undefined {
  const value = objectOf(prop(obj, 'viewport'), bindings, wrappers);
  const width = prop(value, 'width');
  const height = prop(value, 'height');
  return width?.type === 'NumericLiteral' && height?.type === 'NumericLiteral'
    ? { width: width.value, height: height.value }
    : undefined;
}

/** `obj`'s `tags`: the string literals of an array literal. */
function tagsOf(obj: t.ObjectExpression | null): string[] | undefined {
  const value = prop(obj, 'tags');
  if (value?.type !== 'ArrayExpression') return undefined;
  return value.elements.flatMap((e) => (e ? (stringLiteral(e) ?? []) : []));
}

/** A story's tags as Storybook combines them: the meta's, then its own, where `!tag` removes `tag`. */
function combineTags(meta: string[] | undefined, own: string[] | undefined): string[] | undefined {
  if (meta === undefined && own === undefined) return undefined;
  const out = new Set(meta);
  for (const tag of own ?? []) {
    if (tag.startsWith('!')) out.delete(tag.slice(1));
    else out.add(tag);
  }
  return [...out];
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
