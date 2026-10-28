import type { PresetDescription } from '@weasel-js/core';
import { memberKey, readBundles, type Bundle, type BundleMember } from './bundleTree';
import type { SchemaRoot } from './schemaEdit';
import { pairNodes, type OriginOf } from './schemaExport';

/** One edit to the presets, against the ones the editor opened on. Ids are the edited ones, but a `remove`'s and a `rename`'s own. */
export type BundleChange =
  | { op: 'create'; kind: 'bundle'; id: string; package: string; label: string }
  | { op: 'remove'; kind: 'bundle'; id: string }
  | { op: 'rename'; kind: 'bundle'; id: string; to?: string; label?: string }
  | { op: 'move'; kind: 'bundle'; id: string; from: string; to: string }
  | { op: 'move'; kind: BundleMember['kind']; id: string; from: string; to: string }
  | { op: 'include'; kind: BundleMember['kind']; id: string; bundle: string }
  | { op: 'exclude'; kind: BundleMember['kind']; id: string; bundle: string };

/** What the Bundles asset exports, for an agent to apply to the preset source and check against `describePresets`. */
export interface BundlesDocument {
  format: 'weasel-bundles/1';
  /** {@link presetsHash} of the descriptions the editor opened on. */
  base: string;
  /** Every bundle of each package a change touched, as edited. */
  bundles: Bundle[];
  changes: BundleChange[];
}

/** A short hash of `presets`, which says which descriptions an export was made against. */
export function presetsHash(presets: readonly PresetDescription[]): string {
  const text = JSON.stringify(presets);
  let a = 0xdeadbeef;
  let b = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 2654435761);
    b = Math.imul(b ^ c, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (b >>> 0).toString(16).padStart(8, '0') + (a >>> 0).toString(16).padStart(8, '0');
}

const plain = ({ path: _path, ...bundle }: Bundle & { path: string }): Bundle => bundle;

/**
 * The edits from the bundle tree `baseRoot` to `root`. A bundle is paired with its baseline by where `originOf` and
 * the tree's own pairing put it, so one renamed or moved to another package is that bundle still. A member that left
 * one bundle and joined another is one `move`; one that only joined or only left is an `include` or an `exclude`.
 */
export function bundleChanges(baseRoot: SchemaRoot, root: SchemaRoot, originOf?: OriginOf): BundleChange[] {
  const before = readBundles(baseRoot);
  const after = readBundles(root);
  const pairedTo = new Map(pairNodes(baseRoot, root, originOf).pairs);
  const at = new Map(after.map((b) => [b.path, b]));
  const now = new Map<string, Bundle & { path: string }>();
  for (const b of before) {
    const to = at.get(pairedTo.get(b.path) ?? '');
    if (to) now.set(b.id, to);
  }
  const kept = new Set(now.values());
  const renamed = (id: string): string => now.get(id)?.id ?? id;
  const out: BundleChange[] = [];
  for (const b of after) if (!kept.has(b)) out.push({ op: 'create', kind: 'bundle', id: b.id, package: b.package, label: b.label });
  for (const b of before) {
    const to = now.get(b.id);
    if (!to) continue;
    if (to.id !== b.id || to.label !== b.label) {
      out.push({ op: 'rename', kind: 'bundle', id: b.id, ...(to.id !== b.id ? { to: to.id } : {}), ...(to.label !== b.label ? { label: to.label } : {}) });
    }
    if (to.package !== b.package) out.push({ op: 'move', kind: 'bundle', id: to.id, from: b.package, to: to.package });
  }
  // Each member's bundles on both sides, by edited id; a removed bundle keeps its own.
  const held = (bundles: ReadonlyArray<Bundle>, id: (b: Bundle) => string, member: (m: BundleMember) => BundleMember) => {
    const by = new Map<string, { member: BundleMember; in: string[] }>();
    for (const b of bundles) {
      for (const raw of b.members) {
        const m = member(raw);
        const entry = by.get(memberKey(m)) ?? { member: m, in: [] };
        if (!entry.in.includes(id(b))) entry.in.push(id(b));
        by.set(memberKey(m), entry);
      }
    }
    return by;
  };
  const was = held(before, (b) => renamed(b.id), (m) => (m.kind === 'bundle' ? { ...m, id: renamed(m.id) } : m));
  const is = held(after, (b) => b.id, (m) => m);
  const gone = new Set(before.filter((b) => !now.has(b.id)).map((b) => b.id));
  for (const key of new Set([...was.keys(), ...is.keys()])) {
    const member = (is.get(key) ?? was.get(key)!).member;
    const from = was.get(key)?.in ?? [];
    const to = is.get(key)?.in ?? [];
    const left = from.filter((b) => !to.includes(b));
    const joined = to.filter((b) => !from.includes(b));
    const moves = Math.min(left.length, joined.length);
    for (let i = 0; i < moves; i++) out.push({ op: 'move', kind: member.kind, id: member.id, from: left[i]!, to: joined[i]! });
    for (const b of joined.slice(moves)) out.push({ op: 'include', kind: member.kind, id: member.id, bundle: b });
    for (const b of left.slice(moves)) if (!gone.has(b)) out.push({ op: 'exclude', kind: member.kind, id: member.id, bundle: b });
  }
  for (const id of gone) out.push({ op: 'remove', kind: 'bundle', id });
  return out;
}

/** The packages `changes` touch, of the bundles on either side. */
function touched(changes: readonly BundleChange[], before: readonly Bundle[], after: readonly Bundle[]): Set<string> {
  const pkg = new Map([...before.map((b) => [b.id, b.package] as const), ...after.map((b) => [b.id, b.package] as const)]);
  const ids = changes.flatMap((c): string[] => {
    if (c.op === 'create') return [c.id];
    if (c.op === 'include' || c.op === 'exclude') return [c.bundle];
    if (c.op === 'move' && c.kind !== 'bundle') return [c.from, c.to];
    return [c.id];
  });
  const out = new Set(ids.flatMap((id) => pkg.get(id) ?? []));
  for (const c of changes) if (c.op === 'move' && c.kind === 'bundle') out.add(c.from).add(c.to);
  return out;
}

/** The `weasel-bundles/1` document for the tree `root`, edited from `baseRoot`, which was made from `presets`. */
export function bundlesDocument(presets: readonly PresetDescription[], baseRoot: SchemaRoot, root: SchemaRoot, originOf?: OriginOf): BundlesDocument {
  const changes = bundleChanges(baseRoot, root, originOf);
  const after = readBundles(root);
  const packages = touched(changes, readBundles(baseRoot), after);
  return { format: 'weasel-bundles/1', base: presetsHash(presets), bundles: after.filter((b) => packages.has(b.package)).map(plain), changes };
}
