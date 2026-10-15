/**
 * TypeDoc's JSON for the whole workspace, read into one reference per package.
 *
 * The project is the one `npm run build:api` converts with
 * `entryPointStrategy: 'packages'`: each child of the root is a package, and
 * each `Module` child of a package is one of its subpath entries.
 */
import type { JSONOutput } from 'typedoc';
import type { PackageReference, ReferenceModule, ReferenceSymbol } from '../../../apps/shared/reference.ts';
import { packageRoute, symbolRoute } from '../../../apps/shared/packageRoutes.ts';
import type { Links } from './code.ts';
import { docOf, summaryOf } from './comments.ts';
import { Kind } from './kinds.ts';
import { commentOf, readSymbol } from './symbols.ts';

type Declaration = JSONOutput.DeclarationReflection;
type Child = Declaration | JSONOutput.ReferenceReflection;

/** `@weasel-js/geom` → `geom`: the name its directory and its page go by. */
export function unscoped(specifier: string): string {
  return specifier.slice(specifier.indexOf('/') + 1);
}

/** One export as the reference lists it, with the reflection it came from. */
interface Listed {
  readonly name: string;
  readonly child: Child;
}

interface ModuleSource {
  readonly package: string;
  /** The subpath; empty for the root entry. */
  readonly name: string;
  readonly specifier: string;
  readonly container: Declaration;
  readonly listed: Listed[];
}

export function readProject(project: JSONOutput.ProjectReflection): PackageReference[] {
  const packages = (project.children ?? []).filter((child): child is Declaration => child.kind === Kind.Module);
  const sources = packages.map((pkg) => modulesOf(pkg));
  const links = linksOf(sources.flat());
  return packages.map((pkg, i) => ({
    package: unscoped(pkg.name),
    specifier: pkg.name,
    modules: sources[i].map((source) => readModule(source, links)),
  }));
}

/** A package's root entry, then its subpath entries. */
function modulesOf(pkg: Declaration): ModuleSource[] {
  const name = unscoped(pkg.name);
  const subpaths = (pkg.children ?? []).filter((child): child is Declaration => child.kind === Kind.Module);
  return [
    { package: name, name: '', specifier: pkg.name, container: pkg, listed: listedIn(pkg) },
    ...subpaths.map((module) => ({
      package: name,
      name: module.name,
      specifier: `${pkg.name}/${module.name}`,
      container: module,
      listed: listedIn(module),
    })),
  ];
}

/** A module's exports. A namespace is listed as its members, each under `Namespace.member`. */
function listedIn(container: Declaration, prefix = ''): Listed[] {
  return (container.children ?? []).flatMap((child): Listed[] => {
    if (child.kind === Kind.Module) return [];
    const name = prefix + child.name;
    if (child.kind === Kind.Namespace) return listedIn(child as Declaration, `${name}.`);
    return [{ name, child }];
  });
}

function linksOf(modules: readonly ModuleSource[]): Links {
  const byId = new Map<number, string>();
  const byName = new Map<string, string>();
  const exports = new Map<number, Child>();
  for (const module of modules) {
    byId.set(module.container.id, packageRoute(module.package, 'reference', module.name));
    for (const { name, child } of module.listed) {
      exports.set(child.id, child);
      const route = symbolRoute(module.package, module.name, name);
      for (const id of idsUnder(child)) byId.set(id, route);
      const key = `${unscopedSpecifier(module)}:${name}`;
      if (!byName.has(key)) byName.set(key, route);
    }
  }
  const summary = (id: number, seen = new Set<number>()): string => {
    const child = exports.get(id);
    if (!child || seen.has(id)) return '';
    seen.add(id);
    if (child.variant === 'reference') return summary((child as JSONOutput.ReferenceReflection).target, seen);
    return summaryOf(commentOf(child));
  };
  return {
    byId: (id) => byId.get(id),
    byName: (packageName, name) => (packageName ? byName.get(`${packageName}:${name}`) : undefined),
    summary: (id) => summary(id),
  };
}

/** The package a module belongs to, which is what TypeDoc records against a name it could not resolve. */
function unscopedSpecifier(module: ModuleSource): string {
  return module.name ? module.specifier.slice(0, -(module.name.length + 1)) : module.specifier;
}

/** The ids of a reflection and of everything declared inside it: its members, signatures, and parameters. */
function idsUnder(value: unknown, ids: number[] = []): number[] {
  if (Array.isArray(value)) {
    for (const item of value) idsUnder(item, ids);
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.id === 'number' && typeof record.variant === 'string') ids.push(record.id);
    for (const key of Object.keys(record)) {
      // A type's `target` names some other reflection; only what is nested here belongs to this one.
      if (key !== 'target') idsUnder(record[key], ids);
    }
  }
  return ids;
}

function readModule(source: ModuleSource, links: Links): ReferenceModule {
  const symbols: ReferenceSymbol[] = [];
  const namesById = new Map<number, string[]>();
  for (const { name, child } of source.listed) {
    const symbol = readSymbol(child, name, links);
    if (!symbol) continue;
    const owner = namespaceOf(source.container, child) ?? child;
    namesById.set(owner.id, [...(namesById.get(owner.id) ?? []), name]);
    // A name that is both a type and a value is re-exported as two references to one page.
    if (symbol.kind === 'alias' && symbols.some((s) => s.kind === 'alias' && s.name === name && s.to === symbol.to)) continue;
    symbols.push(symbol);
  }
  const groups = groupsOf(source.container, namesById);
  return {
    name: source.name,
    specifier: source.specifier,
    doc: source.name ? docOf(source.container.comment, links) : [],
    // TypeDoc writes no groups for a container it did not sort; list what there is under one heading.
    groups: groups.length > 0 || symbols.length === 0 ? groups : [{ title: 'Exports', names: [...new Set(symbols.map((s) => s.name))] }],
    symbols,
  };
}

/** The top-level namespace of this module that holds `child`, when it is not itself top-level. */
function namespaceOf(container: Declaration, child: Child): Child | undefined {
  return (container.children ?? []).find(
    (top) => top.kind === Kind.Namespace && top !== child && idsUnder(top).includes(child.id),
  );
}

/** The module's exports under its headings: its `@category` sections when it has them, TypeDoc's kind groups otherwise. */
function groupsOf(container: Declaration, namesById: ReadonlyMap<number, string[]>): ReferenceModule['groups'] {
  const sections = container.categories?.length ? container.categories : (container.groups ?? []);
  return sections
    .map((section) => ({
      title: section.title,
      names: [...new Set((section.children ?? []).flatMap((id) => namesById.get(id) ?? []))],
    }))
    .filter((group) => group.names.length > 0);
}
