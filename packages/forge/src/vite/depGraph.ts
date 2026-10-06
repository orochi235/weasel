import { type ParserPlugin, parse } from '@babel/parser';
import type * as t from '@babel/types';
import { dirname, relative, sep } from 'node:path';
import { isGallery } from '../story/tags.ts';
import type { ComponentDeps, DepGraph, IndexEntry } from '../story/types.ts';

/** Resolves an import as the bundler would: an absolute file, or null for anything that is not one. */
export type ResolveImport = (specifier: string, importer: string) => Promise<string | null>;

export interface DepGraphOptions {
  root: string;
  read: (file: string) => string;
}

export interface DepGraphBuilder {
  build(entries: readonly IndexEntry[], resolve: ResolveImport): Promise<DepGraph>;
  /** Drops what was read from `file`. True when the graph had read it, so the graph may have changed. */
  invalidate(file: string): boolean;
  /** Drops every cached import resolution, keeping the parsed files. */
  reset(): void;
}

interface Import {
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

/** A declared binding: the file declaring it and its name there. */
type Key = string;
const keyOf = (file: string, local: string): Key => `${file}#${local}`;
const fileOfKey = (key: Key): string => key.slice(0, key.lastIndexOf('#'));

const SCRIPT = /\.[cm]?[jt]sx?$/;
const DEFAULT_LOCAL = '*default*';
/** Keys holding types, which name no value a component could render. */
const TYPE_KEYS = new Set(['typeAnnotation', 'typeParameters', 'typeArguments', 'returnType', 'superTypeParameters', 'implements']);

/**
 * The component graph of `entries`, derived from source: each component is the binding its story file's meta names
 * (or, when that is declared in the story file itself, the import the title's last segment names), found by
 * following imports and re-exports to the file declaring it. What a component uses is every listed component that
 * its own declaration reaches, directly or through the file's local helpers and the relative imports in its own
 * directory. Each file is read and parsed once and each import resolved once, until `invalidate` names it.
 */
export function createDepGraph({ root, read }: DepGraphOptions): DepGraphBuilder {
  const modules = new Map<string, ModuleInfo | null>();
  const resolutions = new Map<string, Map<string, Promise<string | null>>>();

  const info = (file: string): ModuleInfo | null => {
    if (!modules.has(file)) {
      let parsed: ModuleInfo | null = null;
      try {
        parsed = moduleInfo(read(file), file);
      } catch {
        parsed = null;
      }
      modules.set(file, parsed);
    }
    return modules.get(file) ?? null;
  };

  return {
    invalidate(file) {
      const known = modules.has(file) || resolutions.has(file);
      modules.delete(file);
      resolutions.delete(file);
      return known;
    },

    reset() {
      resolutions.clear();
    },

    async build(entries, resolve) {
      const resolveFrom = (spec: string, importer: string): Promise<string | null> => {
        let byImporter = resolutions.get(importer);
        if (!byImporter) {
          byImporter = new Map();
          resolutions.set(importer, byImporter);
        }
        let pending = byImporter.get(spec);
        if (!pending) {
          pending = resolve(spec, importer).then(
            (id) => {
              const file = id?.split('?')[0];
              return file && !file.startsWith('\0') && SCRIPT.test(file) && !file.split(/[\\/]/).includes('node_modules') ? file : null;
            },
            () => null,
          );
          byImporter.set(spec, pending);
        }
        return pending;
      };

      /** The binding `name` exported from `file` is declared as, through re-exports. */
      const declaring = async (file: string, name: string, depth = 0): Promise<Key | null> => {
        const mod = info(file);
        if (!mod || depth > 32) return null;
        const exp = mod.exports.get(name);
        if (exp?.kind === 'local') {
          const imp = mod.imports.get(exp.local);
          return imp ? importKey(file, imp, depth + 1) : keyOf(file, exp.local);
        }
        if (exp?.kind === 'from') {
          const target = await resolveFrom(exp.spec, file);
          return target ? declaring(target, exp.imported, depth + 1) : null;
        }
        if (name === 'default') return null;
        for (const spec of mod.stars) {
          const target = await resolveFrom(spec, file);
          const found = target ? await declaring(target, name, depth + 1) : null;
          if (found) return found;
        }
        return null;
      };

      const importKey = async (importer: string, imp: Import, depth = 0): Promise<Key | null> => {
        if (imp.imported === '*') return null;
        const target = await resolveFrom(imp.spec, importer);
        return target ? declaring(target, imp.imported, depth) : null;
      };

      /** The component a story file's meta stands for. */
      const componentOf = async (entry: IndexEntry): Promise<Key | null> => {
        const mod = info(entry.file);
        if (!mod) return null;
        const byTitle = entry.title.split('/').pop()?.replace(/\s+/g, '');
        for (const local of [entry.componentName, byTitle]) {
          const imp = local ? mod.imports.get(local) : undefined;
          const key = imp ? await importKey(entry.file, imp) : null;
          if (key) return key;
        }
        return null;
      };

      const titles = new Map<string, IndexEntry[]>();
      for (const entry of entries) {
        if (isGallery(entry)) continue;
        const list = titles.get(entry.title);
        if (list) list.push(entry);
        else titles.set(entry.title, [entry]);
      }

      const components = new Map<string, Key | null>();
      const byKey = new Map<Key, string[]>();
      for (const [title, list] of titles) {
        let key: Key | null = null;
        for (const file of new Set(list.map((e) => e.file))) {
          key = await componentOf(list.find((e) => e.file === file) as IndexEntry);
          if (key) break;
        }
        components.set(title, key);
        if (key) byKey.set(key, [...(byKey.get(key) ?? []), title]);
      }
      const componentFiles = new Set([...byKey.keys()].map(fileOfKey));

      /** The keys `key`'s own source reaches that are other components. */
      const reached = async (key: Key): Promise<Set<Key>> => {
        const out = new Set<Key>();
        const home = fileOfKey(key);
        const homeDir = dirname(home);
        const visited = new Set<string>();

        const walkFile = async (file: string, roots: readonly string[] | null): Promise<void> => {
          const mod = info(file);
          if (!mod) return;
          const locals = new Set<string>();
          if (roots === null) {
            for (const name of mod.refs.keys()) locals.add(name);
            for (const name of mod.imports.keys()) locals.add(name);
          } else {
            const queue = [...roots];
            while (queue.length > 0) {
              const name = queue.pop() as string;
              if (locals.has(name)) continue;
              locals.add(name);
              const here = keyOf(file, name);
              if (here !== key && byKey.has(here)) {
                out.add(here);
                continue;
              }
              for (const ref of mod.refs.get(name) ?? []) {
                if (mod.refs.has(ref) || mod.imports.has(ref)) queue.push(ref);
              }
            }
          }
          for (const name of locals) {
            const imp = mod.imports.get(name);
            if (!imp) continue;
            const target = await importKey(file, imp);
            if (target && byKey.has(target)) {
              if (target !== key) out.add(target);
              continue;
            }
            if (!imp.spec.startsWith('.')) continue;
            const helper = await resolveFrom(imp.spec, file);
            if (!helper || visited.has(helper) || componentFiles.has(helper)) continue;
            if (relative(homeDir, helper).startsWith('..')) continue;
            visited.add(helper);
            await walkFile(helper, null);
          }
        };

        visited.add(home);
        await walkFile(home, [key.slice(home.length + 1)]);
        return out;
      };

      const graph: DepGraph = {};
      for (const [title, key] of components) {
        graph[title] = { source: key ? relative(root, fileOfKey(key)).split(sep).join('/') : null, uses: [], usedBy: [] };
      }
      for (const [title, key] of components) {
        if (!key) continue;
        const uses = new Set<string>();
        for (const target of await reached(key)) {
          for (const other of byKey.get(target) ?? []) if (other !== title) uses.add(other);
        }
        const node = graph[title] as ComponentDeps;
        node.uses = [...uses].sort();
        for (const other of node.uses) graph[other]?.usedBy.push(title);
      }
      for (const node of Object.values(graph)) node.usedBy.sort();
      return Object.fromEntries(Object.entries(graph).sort(([a], [b]) => a.localeCompare(b)));
    },
  };
}

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
