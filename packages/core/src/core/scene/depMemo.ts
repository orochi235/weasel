/**
 * What a memoized derivation was derived *from*, so a hit can re-check it.
 *
 * A derivation keyed on the deriving node's own authored pose only notices a
 * change someone pushed. A dependency that changed with nothing pushed behind
 * it — an ancestor's frame moving, a removal, a dependency appearing, a lookup
 * answering nodes no scene edits — is invisible to that key. Recording what
 * the derivation was handed and comparing it on the hit path is what notices
 * it without a trigger.
 *
 * What is recorded is what a derivation may read of a dependency: its node (an
 * identity), its pose (by value), its `data` (a reference, which every edit
 * replaces), its `layer`, and its path where the derivation read it. Anything
 * else on the node — its parent, its children — still needs a push. A
 * derivation that read glyph outlines also records the face generation, since
 * a face landing changes its result with nothing in the scene changed.
 */
import type { Path } from '@weasel-js/geom';
import type { InheritedPaint } from './inheritedPaint';
import { fontGeneration, noteFontRead, withFontReads } from './fontReads';
import { samePoseValue, snapshotPose } from './poseSnapshot';
import type { DerivedDep, Node, NodeId } from './types';

/** Each dependency's node — an identity, so a restored clone is a different
 *  one — with a copy of the pose it resolved to, its `data` and `layer`, and
 *  the path it answered, `undefined` where the derivation never asked. */
export interface DepRecord<TPose> {
  nodes: (object | undefined)[];
  poses: (TPose | undefined)[];
  data: unknown[];
  layers: (string | undefined)[];
  paths: (Path | null | undefined)[];
  /** What each dependency's children resolved to, where the derivation read them. */
  children: (DepRecord<TPose> | undefined)[];
  /** The face generation it was derived under, or `null` when it read no
   *  glyph outlines. */
  faces: number | null;
}

export function emptyDepRecord<TPose>(): DepRecord<TPose> {
  return { nodes: [], poses: [], data: [], layers: [], paths: [], children: [], faces: null };
}

/** A dependency as the derivation is handed it, noting a read of its path. A
 *  class for the reason `SceneDep` is one: a prototype accessor is cheap. */
class RecordedDep<TPose> implements DerivedDep<TPose> {
  readonly node: Node<unknown, string, TPose>;
  readonly pose: TPose;

  constructor(
    private readonly dep: DerivedDep<TPose>,
    private readonly record: DepRecord<TPose>,
    private readonly index: number,
  ) {
    this.node = dep.node;
    this.pose = dep.pose;
  }

  get path(): Path | null {
    return (this.record.paths[this.index] = this.dep.path);
  }

  get inherited(): InheritedPaint | undefined {
    return this.dep.inherited;
  }

  get children(): readonly (DerivedDep<TPose> | undefined)[] | undefined {
    const kids = this.dep.children;
    if (kids === undefined) return undefined;
    const into = (this.record.children[this.index] = emptyDepRecord<TPose>());
    return recordDeps(into, kids);
  }
}

/** `deps` wrapped to note what is read of them in `into`, which is cleared first. */
function recordDeps<TPose>(
  into: DepRecord<TPose>,
  deps: readonly (DerivedDep<TPose> | undefined)[],
): (DerivedDep<TPose> | undefined)[] {
  into.nodes.length = 0;
  into.poses.length = 0;
  into.data.length = 0;
  into.layers.length = 0;
  into.paths.length = 0;
  into.children.length = 0;
  return deps.map((dep, i) => {
    into.nodes.push(dep?.node);
    into.poses.push(dep === undefined ? undefined : snapshotPose(dep.pose));
    into.data.push(dep?.node.data);
    into.layers.push(dep?.node.layer);
    into.paths.push(undefined);
    into.children.push(undefined);
    return dep === undefined ? undefined : new RecordedDep(dep, into, i);
  });
}

/** Run `derive` against `deps`, recording in place what it was run against.
 *  Mutating the record is what updates the memo slot, which holds this object. */
export function deriveRecorded<TPose, T>(
  into: DepRecord<TPose>,
  deps: readonly (DerivedDep<TPose> | undefined)[],
  derive: (deps: readonly (DerivedDep<TPose> | undefined)[]) => T,
): T {
  const handed = recordDeps(into, deps);
  const generation = fontGeneration();
  const { value, fonts } = withFontReads(() => derive(handed));
  into.faces = fonts ? generation : null;
  return value;
}

/** Whether the dependencies still resolve to what the record was taken from.
 *  Resolves them one at a time rather than taking an array: this is the hit
 *  path, and it walks every derived node's every dependency on every frame. */
export function sameDeps<TPose>(
  record: DepRecord<TPose>,
  ids: readonly NodeId[],
  depOf: (id: NodeId) => DerivedDep<TPose> | undefined,
): boolean {
  if (record.nodes.length !== ids.length) return false;
  if (record.faces !== null && record.faces !== fontGeneration()) return false;
  for (let i = 0; i < ids.length; i++) if (!sameDep(record, i, depOf(ids[i]))) return false;
  // A hit is still a read, for any derivation enclosing this one.
  if (record.faces !== null) noteFontRead();
  return true;
}

/** Whether `dep` resolves to what `record` took at `i`, its children too where they were read. */
function sameDep<TPose>(record: DepRecord<TPose>, i: number, dep: DerivedDep<TPose> | undefined): boolean {
  if (record.nodes[i] !== (dep === undefined ? undefined : dep.node)) return false;
  if (dep === undefined) return true;
  if (record.data[i] !== dep.node.data || record.layers[i] !== dep.node.layer) return false;
  if (!samePoseValue(record.poses[i], dep.pose)) return false;
  const path = record.paths[i];
  if (path !== undefined && path !== dep.path) return false;
  const kids = record.children[i];
  if (kids === undefined) return true;
  const now = dep.children;
  if (now === undefined || now.length !== kids.nodes.length) return false;
  return now.every((child, k) => sameDep(kids, k, child));
}
