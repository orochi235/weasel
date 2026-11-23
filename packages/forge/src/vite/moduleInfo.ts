import { type ParserPlugin, parse } from '@babel/parser';
import type * as t from '@babel/types';
import { DEFAULT_LOCAL, patternNames } from './ast.ts';
import { freeNames } from './freeNames.ts';

export interface Import {
  spec: string;
  /** `*` for a namespace import or re-export. */
  imported: string;
}

type Export = { kind: 'local'; local: string } | { kind: 'from'; spec: string; imported: string };

export interface ModuleInfo {
  imports: Map<string, Import>;
  exports: Map<string, Export>;
  stars: string[];
  /** Per top-level binding, the names its declaration refers to and does not declare itself. */
  refs: Map<string, Set<string>>;
}

/** What `code`, the source of `file`, imports, exports and declares at its top level. */
export function moduleInfo(code: string, file: string): ModuleInfo {
  const plugins: ParserPlugin[] = ['typescript', 'decorators-legacy', ...(/\.[cm]?[jt]sx$/.test(file) ? (['jsx'] as const) : [])];
  const program = parse(code, { sourceType: 'module', plugins }).program;
  const imports = new Map<string, Import>();
  const exports = new Map<string, Export>();
  const stars: string[] = [];
  const refs = new Map<string, Set<string>>();
  /** `const { a: b } = ns`: each name destructured off a top-level identifier, which may be a namespace import. */
  const picked: { local: string; from: string; imported: string }[] = [];
  const declare = (name: string, node: t.Node | null | undefined) => refs.set(name, node ? freeNames(node) : new Set());

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
          if (d.id.type === 'Identifier') {
            declare(d.id.name, d.init);
            return [d.id.name];
          }
          const names = patternNames(d.id);
          for (const name of names) declare(name, d);
          if (d.id.type === 'ObjectPattern' && d.init?.type === 'Identifier') {
            for (const p of d.id.properties) {
              if (p.type === 'ObjectProperty' && !p.computed && p.value.type === 'Identifier') {
                picked.push({ local: p.value.name, from: d.init.name, imported: p.key.type === 'Identifier' ? p.key.name : nameOf(p.key as t.StringLiteral) });
              }
            }
          }
          return names;
        });
      case 'TSEnumDeclaration':
        if (decl.declare) return [];
        declare(decl.id.name, decl);
        return [decl.id.name];
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
          if (spec.type === 'ExportNamespaceSpecifier' && stmt.source) {
            exports.set(nameOf(spec.exported), { kind: 'from', spec: stmt.source.value, imported: '*' });
          }
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
  // Destructuring a namespace import binds what a named import of the same members would.
  for (const { local, from, imported } of picked) {
    const ns = imports.get(from);
    if (ns?.imported === '*' && !imports.has(local)) imports.set(local, { spec: ns.spec, imported });
  }
  return { imports, exports, stars, refs };
}

function nameOf(node: t.Identifier | t.StringLiteral): string {
  return node.type === 'Identifier' ? node.name : node.value;
}
