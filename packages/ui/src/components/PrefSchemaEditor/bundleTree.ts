import type { PresetDescription } from '@weasel-js/core';
import { isPrefLeaf, isPrefSection, type PrefAction, type PrefAlias, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { actionLeafKey } from './editorActions';
import type { CustomKinds } from './kindSchemas';
import { childrenOf, joinPath, keysOf, nodeAt, uniqueKey, valuePathOf, type ChildMap, type LinkRule, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** What a bundle holds, by id: another bundle, or an action, a tool, or an atom. */
export interface BundleMember {
  kind: 'bundle' | 'action' | 'tool' | 'atom';
  id: string;
}

/** A bundle as the tree holds it. */
export interface Bundle {
  id: string;
  package: string;
  label: string;
  members: BundleMember[];
}

/** A leaf naming a tool a bundle registers. */
export type PrefTool = PrefLeaf & { kind: 'tool'; tool: string };

/** A leaf naming an atom: what it holds rides along, to be shown, and nothing in the tree edits it. */
export type PrefAtom = PrefLeaf & { kind: 'atom'; atom: string; actions: readonly string[]; tools: readonly string[]; includes: readonly string[] };

/** The leaf kinds a bundle tree adds to the editor's. An atom offers no attribute of its own to edit. */
export const BUNDLE_KINDS: CustomKinds = {
  tool: { tool: { kind: 'symbol', name: 'Tool', description: 'The id of the tool it registers.', default: '' } as PrefLeaf },
  atom: {},
};

/** The tree key a bundle with id `id` sits under: an id like `tools:select` is no key. */
export const bundleKey = (id: string): string => actionLeafKey(id);

/** The id of the bundle group keyed `key`: the id it was made with, until it is given a key that id would not take. */
export function bundleIdOf(key: string, group: SchemaNode): string {
  const held = (group as { bundle?: string }).bundle;
  return held !== undefined && bundleKey(held) === key ? held : key;
}

/** Whether the node at `path` is a bundle: a group in a package's section. */
export function isBundleAt(root: SchemaRoot, path: string): boolean {
  const node = nodeAt(root, path);
  return keysOf(path).length === 2 && node !== undefined && !isPrefLeaf(node) && !isPrefSection(node);
}

export const isAtomLeaf = (node: SchemaNode | undefined): node is PrefAtom => !!node && isPrefLeaf(node) && node.kind === 'atom';

const actionNode = (id: string): PrefLeaf => ({ kind: 'action', name: id, description: '', default: undefined, action: id } satisfies PrefAction);
const toolNode = (id: string): PrefLeaf => ({ kind: 'tool', name: id, description: '', default: undefined, tool: id } as PrefTool);
const atomNode = (d: PresetDescription): PrefLeaf =>
  ({ kind: 'atom', name: d.label, description: '', default: undefined, atom: d.id, actions: d.actions, tools: d.tools, includes: d.includes } as PrefAtom);

/** A link to the bundle group at `path`: an alias naming its value path, which a move or a rename of the group carries along. */
const linkTo = (root: SchemaRoot, path: string): PrefAlias => ({ kind: 'alias', name: '', description: '', default: undefined, of: valuePathOf(root, path) });

/** A bundle tree's links: a bundle shown inside another, which then includes it. A link can be linked again. */
export const BUNDLE_LINKS: LinkRule = {
  can: (root, path) => {
    const node = nodeAt(root, path);
    return isBundleAt(root, path) || (node !== undefined && isPrefLeaf(node) && node.kind === 'alias');
  },
  of: (root, path) => (isBundleAt(root, path) ? linkTo(root, path) : nodeAt(root, path)!),
  label: 'Include',
  title: 'Include each selected bundle again, to be dragged into the bundle that takes it',
};

/** What a group under a group root holds. */
type GroupKids = Record<string, PrefGroup | PrefLeaf>;

/** The leaves a bundle's description makes, keyed as the tree keys them. */
function leavesOf(d: PresetDescription, byId: ReadonlyMap<string, PresetDescription>, pathOf: (id: string) => string): GroupKids {
  const kids: GroupKids = {};
  const put = (id: string, node: PrefLeaf) => { kids[uniqueKey(kids, actionLeafKey(id))] = node; };
  for (const inner of d.includes) {
    const held = byId.get(inner);
    if (held?.atom) put(inner, atomNode(held));
    else put(inner, { kind: 'alias', name: '', description: '', default: undefined, of: pathOf(inner) } as PrefAlias);
  }
  for (const id of d.actions) put(id, actionNode(id));
  for (const id of d.tools) put(id, toolNode(id));
  return kids;
}

/**
 * The tree the Bundles asset edits: a section per package, a group in it per bundle, holding a leaf for each action,
 * tool, and atom it names and a link to each bundle it includes. An atom no bundle includes sits in its package's
 * section on its own.
 */
export function bundleTree(presets: readonly PresetDescription[]): PrefGroup {
  const byId = new Map(presets.map((d) => [d.id, d]));
  const packages = [...new Set(presets.map((d) => d.package))];
  const packageKeys = new Map<string, string>();
  const taken: ChildMap = {};
  for (const pkg of packages) {
    const key = uniqueKey(taken, actionLeafKey(pkg.split('/').pop()!));
    taken[key] = { name: pkg, description: '', children: {} };
    packageKeys.set(pkg, key);
  }
  const pathOf = (id: string): string => {
    const d = byId.get(id);
    return d ? `${packageKeys.get(d.package)}.${bundleKey(id)}` : bundleKey(id);
  };
  const included = new Set(presets.filter((d) => !d.atom).flatMap((d) => d.includes));
  const children = Object.fromEntries(packages.map((pkg) => {
    const own = presets.filter((d) => d.package === pkg);
    const kids: GroupKids = {};
    for (const d of own.filter((p) => !p.atom)) {
      kids[bundleKey(d.id)] = { name: d.label, description: '', bundle: d.id, children: leavesOf(d, byId, pathOf) } as PrefGroup;
    }
    for (const d of own.filter((p) => p.atom && !included.has(p.id))) kids[uniqueKey(kids, actionLeafKey(d.id))] = atomNode(d);
    const section: PrefGroup = { name: pkg, description: '', as: 'section', children: kids };
    return [packageKeys.get(pkg)!, section];
  }));
  return { name: 'Bundles', description: '', children };
}

/** The member a leaf of `root` names, `undefined` for one that names none. A link names the bundle it reaches. */
export function memberOf(root: SchemaRoot, leaf: SchemaNode): BundleMember | undefined {
  if (!isPrefLeaf(leaf)) return undefined;
  const held = leaf as unknown as Record<string, unknown>;
  if (leaf.kind === 'action' && typeof held.action === 'string') return { kind: 'action', id: held.action };
  if (leaf.kind === 'tool' && typeof held.tool === 'string') return { kind: 'tool', id: held.tool };
  if (leaf.kind === 'atom' && typeof held.atom === 'string') return { kind: 'atom', id: held.atom };
  if (leaf.kind !== 'alias') return undefined;
  const keys = String(held.of).split('.');
  const path = keys.join('/');
  const group = nodeAt(root, path);
  return { kind: 'bundle', id: group ? bundleIdOf(keys.at(-1)!, group) : keys.at(-1)! };
}

/** Every bundle `root` holds, in its order, each with its tree path. */
export function readBundles(root: SchemaRoot): Array<Bundle & { path: string }> {
  const out: Array<Bundle & { path: string }> = [];
  for (const [pkgKey, pkg] of Object.entries(childrenOf(root) ?? {})) {
    if (isPrefLeaf(pkg)) continue;
    for (const [key, group] of Object.entries(childrenOf(pkg) ?? {})) {
      if (isPrefLeaf(group)) continue;
      const members = Object.values(childrenOf(group) ?? {}).flatMap((leaf) => memberOf(root, leaf) ?? []);
      out.push({ id: bundleIdOf(key, group), package: pkg.name, label: group.name, members, path: joinPath(pkgKey, key) });
    }
  }
  return out;
}

/** The atoms `root` names, by id, from the first leaf naming each. */
export function atomsIn(root: SchemaRoot): Map<string, PrefAtom> {
  const out = new Map<string, PrefAtom>();
  const walk = (node: SchemaNode): void => {
    for (const kid of Object.values(childrenOf(node) ?? {})) {
      if (isAtomLeaf(kid) && !out.has(kid.atom)) out.set(kid.atom, kid);
      walk(kid);
    }
  };
  walk(root);
  return out;
}

/** One key for a member, by its kind and id. */
export const memberKey = (m: BundleMember): string => `${m.kind}:${m.id}`;

/** Every action, tool, and atom the presets name, once each, as leaves to drag into a bundle: a group of each kind. */
export function bundleParts(presets: readonly PresetDescription[]): PrefGroup {
  const group = (name: string, leaves: Array<[string, PrefLeaf]>): PrefGroup => {
    const kids: GroupKids = {};
    for (const [id, leaf] of leaves) kids[uniqueKey(kids, actionLeafKey(id))] = leaf;
    return { name, description: '', children: kids };
  };
  const once = (ids: string[]): string[] => [...new Set(ids)];
  return {
    name: 'Parts',
    description: '',
    children: {
      actions: group('Actions', once(presets.flatMap((d) => d.actions)).map((id) => [id, actionNode(id)])),
      tools: group('Tools', once(presets.flatMap((d) => d.tools)).map((id) => [id, toolNode(id)])),
      atoms: group('Atoms', presets.filter((d) => d.atom).map((d) => [d.id, atomNode(d)])),
    },
  };
}

/** The bundles each member is in, by {@link memberKey}. */
export function membership(root: SchemaRoot): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const bundle of readBundles(root)) {
    for (const m of bundle.members) {
      const key = memberKey(m);
      const held = out.get(key) ?? [];
      if (!held.includes(bundle.id)) out.set(key, [...held, bundle.id]);
    }
  }
  return out;
}
