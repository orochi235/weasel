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
  /** The face generation it was derived under, or `null` when it read no
   *  glyph outlines. */
  faces: number | null;
}

export function emptyDepRecord<TPose>(): DepRecord<TPose> {
  return { nodes: [], poses: [], data: [], layers: [], paths: [], faces: null };
}

/** A dependency as the derivation is handed it, noting a read of its path. A
 *  class for the reason `SceneDep` is one: a prototype accessor is cheap. */
class RecordedDep<TPose> implements DerivedDep<TPose> {
  readonly node: Node<unknown, string, TPose>;
  readonly pose: TPose;

  constructor(
    private readonly dep: DerivedDep<TPose>,
    private readonly paths: (Path | null | undefined)[],
    private readonly index: number,
  ) {
    this.node = dep.node;
    this.pose = dep.pose;
  }

  get path(): Path | null {
    return (this.paths[this.index] = this.dep.path);
  }
}

/** Run `derive` against `deps`, recording in place what it was run against.
 *  Mutating the record is what updates the memo slot, which holds this object. */
export function deriveRecorded<TPose, T>(
  into: DepRecord<TPose>,
  deps: readonly (DerivedDep<TPose> | undefined)[],
  derive: (deps: readonly (DerivedDep<TPose> | undefined)[]) => T,
): T {
  into.nodes.length = 0;
  into.poses.length = 0;
  into.data.length = 0;
  into.layers.length = 0;
  into.paths.length = 0;
  const handed = deps.map((dep, i) => {
    into.nodes.push(dep?.node);
    into.poses.push(dep === undefined ? undefined : snapshotPose(dep.pose));
    into.data.push(dep?.node.data);
    into.layers.push(dep?.node.layer);
    into.paths.push(undefined);
    return dep === undefined ? undefined : new RecordedDep(dep, into.paths, i);
  });
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
  for (let i = 0; i < ids.length; i++) {
    const dep = depOf(ids[i]);
    if (record.nodes[i] !== (dep === undefined ? undefined : dep.node)) return false;
    if (dep === undefined) continue;
    if (record.data[i] !== dep.node.data || record.layers[i] !== dep.node.layer) return false;
    if (!samePoseValue(record.poses[i], dep.pose)) return false;
    const path = record.paths[i];
    if (path !== undefined && path !== dep.path) return false;
  }
  // A hit is still a read, for any derivation enclosing this one.
  if (record.faces !== null) noteFontRead();
  return true;
}
