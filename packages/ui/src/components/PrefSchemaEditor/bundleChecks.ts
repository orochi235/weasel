import { atomsIn, memberKey, memberOf, readBundles, type BundleMember } from './bundleTree';
import { childrenOf, joinPath, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** What is wrong with a row of a bundle tree, shown on it and enforced nowhere. */
export interface BundleProblem {
  /** It is a bundle that includes itself, or a link that closes such a loop. */
  cycle?: boolean;
  /** It names something another bundle loaded with it names too: the sentence that says which. */
  twice?: string;
}

/** A bundle or an atom, as what it names directly and what it includes. */
interface Holder {
  id: string;
  /** Actions, tools, and atoms, by {@link memberKey}. */
  names: string[];
  includes: string[];
}

function holdersOf(root: SchemaRoot): Map<string, Holder> {
  const out = new Map<string, Holder>();
  for (const [id, atom] of atomsIn(root)) {
    const names = [...atom.actions.map((a) => memberKey({ kind: 'action', id: a })), ...atom.tools.map((t) => memberKey({ kind: 'tool', id: t }))];
    out.set(id, { id, names, includes: [...atom.includes] });
  }
  for (const bundle of readBundles(root)) {
    const named = (m: BundleMember) => m.kind !== 'bundle';
    out.set(bundle.id, {
      id: bundle.id,
      names: bundle.members.filter(named).map(memberKey),
      includes: bundle.members.filter((m) => m.kind === 'bundle' || m.kind === 'atom').map((m) => m.id),
    });
  }
  return out;
}

/** Every holder `from` reaches through its includes, itself first, each once. */
function reach(holders: ReadonlyMap<string, Holder>, from: string): string[] {
  const seen = new Set<string>();
  const visit = (id: string): void => {
    if (seen.has(id) || !holders.has(id)) return;
    seen.add(id);
    for (const inner of holders.get(id)!.includes) visit(inner);
  };
  visit(from);
  return [...seen];
}

/** What a canvas loading the bundle `id` gets: every bundle and atom it reaches, and what those name. */
export function bundleLoads(root: SchemaRoot, id: string): { holders: string[]; names: string[] } {
  const holders = holdersOf(root);
  const reached = reach(holders, id);
  return { holders: reached, names: [...new Set(reached.flatMap((h) => holders.get(h)!.names))] };
}

/** Each leaf of a bundle, by its tree path, with the bundle it sits in and what it names. */
function leavesIn(root: SchemaRoot): Array<{ path: string; bundle: string | undefined; member: BundleMember }> {
  const bundles = new Map(readBundles(root).map((b) => [b.path, b.id]));
  const out: Array<{ path: string; bundle: string | undefined; member: BundleMember }> = [];
  const walk = (node: SchemaNode, path: string | null): void => {
    for (const [key, kid] of Object.entries(childrenOf(node) ?? {})) {
      const at = joinPath(path, key);
      const member = memberOf(root, kid);
      if (member) out.push({ path: at, bundle: path === null ? undefined : bundles.get(path), member });
      walk(kid, at);
    }
  };
  walk(root, null);
  return out;
}

/**
 * The rows of a bundle tree to mark, by tree path: a bundle that reaches itself through what it includes, and each
 * link that does it; and a leaf naming what another bundle or atom names, where some bundle loads both.
 */
export function bundleProblems(root: SchemaRoot): Map<string, BundleProblem> {
  const holders = holdersOf(root);
  const out = new Map<string, BundleProblem>();
  const mark = (path: string, problem: BundleProblem) => out.set(path, { ...out.get(path), ...problem });
  const reached = new Map([...holders.keys()].map((id) => [id, reach(holders, id)]));
  const looped = (id: string): boolean => holders.get(id)!.includes.some((inner) => reached.get(inner)?.includes(id));
  for (const bundle of readBundles(root)) if (looped(bundle.id)) mark(bundle.path, { cycle: true });
  const leaves = leavesIn(root);
  for (const leaf of leaves) {
    if (leaf.member.kind !== 'bundle' || leaf.bundle === undefined) continue;
    if (reached.get(leaf.member.id)?.includes(leaf.bundle)) mark(leaf.path, { cycle: true });
  }
  // Who names each thing, and the first bundle found that loads two of them.
  const said = new Map<string, string>();
  for (const bundle of readBundles(root)) {
    const loaded = reached.get(bundle.id)!;
    const owners = new Map<string, string[]>();
    for (const h of loaded) for (const name of holders.get(h)!.names) owners.set(name, [...(owners.get(name) ?? []), h]);
    for (const [name, by] of owners) {
      const distinct = [...new Set(by)];
      if (distinct.length > 1 && !said.has(name)) said.set(name, `${distinct.join(' and ')} both name it, and ${bundle.id} loads them together`);
    }
  }
  for (const leaf of leaves) {
    if (leaf.bundle === undefined) continue;
    // An atom shows what it names on its own row.
    const named = leaf.member.kind === 'atom' ? holders.get(leaf.member.id)?.names ?? [] : [];
    const why = [memberKey(leaf.member), ...named].map((name) => said.get(name)).find((w) => w !== undefined);
    if (why !== undefined) mark(leaf.path, { twice: why });
  }
  return out;
}
