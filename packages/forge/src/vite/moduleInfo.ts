import { type ParserPlugin, parse } from '@babel/parser';
import type * as t from '@babel/types';

export interface Import {
  spec: string;
  /** `*` for a namespace import. */
  imported: string;
}

type Export = { kind: 'local'; local: string } | { kind: 'from'; spec: string; imported: string };

export interface ModuleInfo {
  imports: Map<string, Import>;
  exports: Map<string, Export>;
  stars: string[];
  /** Per top-level binding, the names its declaration refers to. */
  refs: Map<string, Set<string>>;
}

const DEFAULT_LOCAL = '*default*';
/** Keys holding types, which name no value a component could render. */
const TYPE_KEYS = new Set(['typeAnnotation', 'typeParameters', 'typeArguments', 'returnType', 'superTypeParameters', 'implements']);

/** What `code`, the source of `file`, imports, exports and declares at its top level. */
export function moduleInfo(code: string, file: string): ModuleInfo {
  const plugins: ParserPlugin[] = ['typescript', 'decorators-legacy', ...(/\.[cm]?[jt]sx$/.test(file) ? (['jsx'] as const) : [])];
  const program = parse(code, { sourceType: 'module', plugins }).program;
  const imports = new Map<string, Import>();
  const exports = new Map<string, Export>();
  const stars: string[] = [];
  const refs = new Map<string, Set<string>>();
  const declare = (name: string, node: t.Node | null | undefined) => refs.set(name, node ? namesIn(node) : new Set());

  const declareStatement = (decl: t.Node | null | undefined): string[] => {
    if (!decl) return [];
    switch (decl.type) {
      case 'FunctionDeclaration':
      case 'ClassDeclaration':
        if (!decl.id) return [];
        declare(decl.id.name, decl);
        return [decl.id.name];
      case 'VariableDeclaration':
        return decl.declarations.flatMap((d) => {
          if (d.id.type !== 'Identifier') return [];
          declare(d.id.name, d.init);
          return [d.id.name];
        });
      default:
        return [];
    }
  };

  for (const stmt of program.body) {
    switch (stmt.type) {
      case 'ImportDeclaration':
        if (stmt.importKind === 'type') break;
        for (const spec of stmt.specifiers) {
          if (spec.type === 'ImportSpecifier' && spec.importKind === 'type') continue;
          const imported =
            spec.type === 'ImportNamespaceSpecifier' ? '*' : spec.type === 'ImportDefaultSpecifier' ? 'default' : nameOf(spec.imported);
          imports.set(spec.local.name, { spec: stmt.source.value, imported });
        }
        break;
      case 'ExportNamedDeclaration':
        if (stmt.exportKind === 'type') break;
        for (const name of declareStatement(stmt.declaration)) exports.set(name, { kind: 'local', local: name });
        for (const spec of stmt.specifiers) {
          if (spec.type === 'ExportSpecifier' && spec.exportKind === 'type') continue;
          if (spec.type !== 'ExportSpecifier') continue;
          const exported = nameOf(spec.exported);
          const local = nameOf(spec.local);
          exports.set(exported, stmt.source ? { kind: 'from', spec: stmt.source.value, imported: local } : { kind: 'local', local });
        }
        break;
      case 'ExportAllDeclaration':
        if (stmt.exportKind !== 'type') stars.push(stmt.source.value);
        break;
      case 'ExportDefaultDeclaration': {
        const decl = stmt.declaration;
        const named = (decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') && decl.id ? decl.id.name : null;
        if (named) declare(named, decl);
        else if (decl.type === 'Identifier') {
          exports.set('default', { kind: 'local', local: decl.name });
          break;
        } else declare(DEFAULT_LOCAL, decl);
        exports.set('default', { kind: 'local', local: named ?? DEFAULT_LOCAL });
        break;
      }
      default:
        declareStatement(stmt);
    }
  }
  return { imports, exports, stars, refs };
}

function nameOf(node: t.Identifier | t.StringLiteral): string {
  return node.type === 'Identifier' ? node.name : node.value;
}

/** Every identifier `node` refers to as a value, JSX tags included. Types and property names are left out. */
function namesIn(node: t.Node): Set<string> {
  const out = new Set<string>();
  const walk = (value: unknown, key?: string): void => {
    if (key !== undefined && TYPE_KEYS.has(key)) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!value || typeof value !== 'object' || typeof (value as { type?: unknown }).type !== 'string') return;
    const n = value as t.Node;
    if (n.type.startsWith('TS') && !('expression' in n)) return;
    if (n.type === 'Identifier' || n.type === 'JSXIdentifier') {
      out.add(n.name);
      return;
    }
    for (const [k, child] of Object.entries(n)) {
      if (k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments' || k === 'loc') continue;
      if ((n.type === 'MemberExpression' || n.type === 'OptionalMemberExpression') && k === 'property' && !n.computed) continue;
      if (n.type === 'JSXMemberExpression' && k === 'property') continue;
      if ((n.type === 'ObjectProperty' || n.type === 'ObjectMethod' || n.type === 'ClassMethod' || n.type === 'ClassProperty') && k === 'key' && !n.computed) continue;
      if (n.type === 'JSXAttribute' && k === 'name') continue;
      walk(child, k);
    }
  };
  walk(node);
  return out;
}
