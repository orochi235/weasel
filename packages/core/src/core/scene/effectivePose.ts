/**
 * `effectivePose` — the pose to draw, pick and measure a node at.
 *
 * Three answers, in order: the ephemeral override a gesture published, the
 * pose the node derives from its dependencies, or the pose the document
 * stores. A reader of `node.pose` disagrees with the render about where a
 * dragged or derived node is.
 */
import { deriveRecorded, emptyDepRecord, sameDeps, type DepRecord } from './depMemo';
import type { PoseComposition } from './composeFrame';
import { carryDepPath, depFrameRebase, pathAsPainted } from './depFrame';
import { dependencyIdsOf } from './dependents';
import { resolveDerivedPath } from './derivedPath';
import { inheritedPaintIn, type InheritedPaint } from './inheritedPaint';
import { nodeAsShown } from './nodeAsShown';
import { dropPoseKeyedMemoSlots, nodeMemo } from './nodeMemo';
import type { Path } from '@weasel-js/geom';
import type { DerivedDep, DerivePathFn, DerivePoseFn, Node, NodeId, PoseOverrides } from './types';

/**
 * Which pose a resolution answers: `effective` honors overrides all the way
 * down the dependency chain, `document` ignores them all the way down. Each
 * reading memoizes in its own slots — the memo key is the node and its
 * authored pose, which is the same for both.
 */
type Reading = 'effective' | 'document';

const POSE_SLOT: Record<Reading, string> = {
  effective: 'kit:derivedPose',
  document: 'kit:derivedPose:document',
};
const PATH_SLOT: Record<Reading, string | undefined> = {
  effective: undefined,
  document: 'kit:derivedPath:document',
};

/** The subset of a node this module reads. Structural so a `Node` satisfies
 *  it without importing the full generic shape. */
export interface PosedNode<TPose> {
  id: NodeId;
  kind?: 'mark' | 'group';
  pose: TPose;
  /** Read only by the memo, which keys on its reference alongside the pose. */
  data?: unknown;
  dependsOn?: readonly NodeId[] | 'children';
  /** Read under a composing strategy, to find the frame its pose is in. */
  parent?: NodeId | null;
  derivePose?: DerivePoseFn<TPose>;
  /** Read only when something asks a dependency for its `path`. */
  derivePath?: DerivePathFn<TPose>;
}

/** What resolving a pose needs: the overrides, and enough of the scene to
 *  reach a node's dependencies. A `Scene` satisfies it. */
export interface PoseSource<TPose> {
  readonly overrides: Pick<PoseOverrides<TPose>, 'read'>;
  get(id: NodeId): PosedNode<TPose> | undefined;
  childrenOf(id: NodeId): readonly NodeId[];
  /** When it composes frames, a derivation reads each dependency in the
   *  frame of the node deriving. */
  readonly composition?: PoseComposition<TPose>;
}

/** A cached derived pose, with what it was derived from. */
interface PoseMemo<TPose> extends DepRecord<TPose> {
  value: TPose | null;
}

/** Ids whose derivation is on the stack. A dependency graph is meant to be
 *  acyclic and `dependsOn` is unvalidated, so a cycle resolves to the authored
 *  pose at whichever node closes it rather than overflowing the stack. */
const resolving = new Set<NodeId>();

/** Bumped each time the guard above fires. A derivation that closed a cycle
 *  answered from a fallback rather than from its dependencies, so its value is
 *  an artifact of which node was asked first and must not be cached. */
let cycleHits = 0;

/**
 * The pose `node` computes from its dependencies, or `null` when it derives
 * nothing — it has no `derivePose`, nothing to derive from, or its
 * `derivePose` returned `null`.
 *
 * A dependency is read through {@link effectivePose}, so a group of groups
 * resolves bottom-up and a dragged dependency's override reaches the
 * derivation the same frame it is published.
 */
export function derivedPose<TPose>(
  source: PoseSource<TPose>,
  node: PosedNode<TPose>,
): TPose | null {
  return derivedPoseIn(source, node, 'effective');
}

function derivedPoseIn<TPose>(
  source: PoseSource<TPose>,
  stored: PosedNode<TPose>,
  reading: Reading,
): TPose | null {
  const node = shownIn(source, stored, reading);
  const derive = node.derivePose;
  if (derive === undefined) return null;
  const ids = dependencyIdsOf(node, source.childrenOf);
  if (ids.length === 0) return null;
  if (resolving.has(node.id)) {
    cycleHits++;
    return null;
  }
  resolving.add(node.id);
  const hitsBefore = cycleHits;
  try {
    const depOf = depsAsRead(source, node, reading);
    // Keyed on the authored pose, which only sees a change someone pushed, so
    // the record also carries what the derivation read and re-checks it by
    // value on a hit — see `depMemo.ts`.
    let computed = false;
    const record = nodeMemo<PoseMemo<TPose>>(node, POSE_SLOT[reading], node.pose, () => {
      computed = true;
      return run(node, derive, ids.map(depOf), { ...emptyDepRecord<TPose>(), value: null });
    });
    // Mutating the record in place is what updates the memo slot, which holds
    // this object.
    if (!computed && !sameDeps(record, ids, depOf)) {
      run(node, derive, ids.map(depOf), record);
    }
    if (cycleHits !== hitsBefore) dropPoseKeyedMemoSlots(node);
    return record.value;
  } finally {
    resolving.delete(node.id);
  }
}

/** Run `derivePose` against `deps` and record what it was run against. */
function run<TPose>(
  node: PosedNode<TPose>,
  derive: NonNullable<PosedNode<TPose>['derivePose']>,
  deps: readonly (DerivedDep<TPose> | undefined)[],
  into: PoseMemo<TPose>,
): PoseMemo<TPose> {
  into.value = deriveRecorded(into, deps, (handed) => derive(node as never, handed));
  return into;
}

/**
 * `id` as a derivation sees it: the node, the pose it is painted at, and the
 * path it derives.
 *
 * The pose is resolved eagerly — every derivation reads it — and the path
 * lazily, because most do not and resolving a route costs a router run. Both
 * resolve *through* this function, so a dependency that is itself derived is
 * resolved before it is read.
 */
export function derivedDepOf<TPose>(
  source: PoseSource<TPose>,
  id: NodeId,
  reader?: PosedNode<TPose>,
): DerivedDep<TPose> | undefined {
  return reader === undefined ? depIn(source, id, 'effective') : depsAsRead(source, reader, 'effective')(id);
}

/** `id` as {@link derivedDepOf} answers it, but at the pose and path the
 *  document holds: no override anywhere down its dependencies counts. For a
 *  reader that must not see an in-flight gesture, such as an edit pass. */
export function documentDepOf<TPose>(source: PoseSource<TPose>, id: NodeId): DerivedDep<TPose> | undefined {
  return depIn(source, id, 'document');
}

/** `(id) => that dependency as `reader`'s derivation is handed it`: its pose
 *  in `reader`'s frame where the scene composes frames. A `'children'`
 *  dependent shares its children's frame, so it reads them as they are. */
function depsAsRead<TPose>(
  source: PoseSource<TPose>,
  reader: PosedNode<TPose>,
  reading: Reading,
): (id: NodeId) => DerivedDep<TPose> | undefined {
  const plain = (id: NodeId) => depIn(source, id, reading);
  if (reader.dependsOn === 'children') return plain;
  const rebase = depFrameRebase(
    source.composition,
    reader,
    (id) => source.get(id),
    (id) => poseIn(source, source.get(id)!, reading),
    (id) => {
      const n = source.get(id);
      return n === undefined || definesFrame(n);
    },
  );
  if (rebase === null) return plain;
  return (id) => {
    const dep = plain(id);
    if (dep === undefined) return undefined;
    const pose = rebase(id, dep.pose);
    return pose === dep.pose ? dep : new RebasedDep(dep, pose);
  };
}

/** A dependency read from another frame: its pose rebased, and its path
 *  carried by the same frame change when asked for. */
class RebasedDep<TPose> implements DerivedDep<TPose> {
  readonly node: Node<unknown, string, TPose>;

  constructor(private readonly dep: DerivedDep<TPose>, readonly pose: TPose) {
    this.node = dep.node;
  }

  get path(): Path | null {
    const path = this.dep.path;
    return path === null ? null : carryDepPath(path, this.dep.pose, this.pose);
  }

  get inherited(): InheritedPaint | undefined {
    return this.dep.inherited;
  }
}

function depIn<TPose>(
  source: PoseSource<TPose>,
  id: NodeId,
  reading: Reading,
): DerivedDep<TPose> | undefined {
  const node = source.get(id);
  if (node === undefined) return undefined;
  return new SceneDep(source, node, reading);
}

/**
 * A class rather than an object literal with a `get path()`: one of these is
 * built per dependency per derived node per frame, and an own accessor costs
 * an order of magnitude more to define than a prototype one does to inherit.
 */
class SceneDep<TPose> implements DerivedDep<TPose> {
  readonly node: Node<unknown, string, TPose>;
  readonly pose: TPose;
  private readonly shown: Path | undefined;

  private readonly posed: PosedNode<TPose>;

  constructor(
    private readonly source: PoseSource<TPose>,
    stored: PosedNode<TPose>,
    private readonly reading: Reading,
  ) {
    const posed = shownIn(source, stored, reading);
    this.posed = posed;
    this.node = posed as unknown as Node<unknown, string, TPose>;
    const override = reading === 'effective' ? source.overrides.read(posed.id) : undefined;
    this.shown = override?.path;
    this.pose = override?.pose ?? derivedPoseIn(source, posed, reading) ?? posed.pose;
  }

  get path(): Path | null {
    if (this.shown !== undefined) return pathAsPainted(this.shown, this.pose, this.pose);
    const { source, reading } = this;
    return resolveDerivedPath(
      this.posed,
      depsAsRead(source, this.posed, reading),
      (depId) => source.childrenOf(depId),
      PATH_SLOT[reading],
    );
  }

  get inherited(): InheritedPaint | undefined {
    const { source, reading } = this;
    return inheritedPaintIn({ get: (id: NodeId) => {
      const n = source.get(id);
      return n === undefined ? undefined : shownIn(source, n, reading);
    } }, this.posed);
  }
}

/** `node` as `reading` reads it: with the data an override shows it with in the effective
 *  reading, as stored in the document one. */
function shownIn<TPose>(source: PoseSource<TPose>, node: PosedNode<TPose>, reading: Reading): PosedNode<TPose> {
  return reading === 'effective' ? nodeAsShown(source.overrides, node) : node;
}

function poseIn<TPose>(
  source: PoseSource<TPose>,
  node: PosedNode<TPose>,
  reading: Reading,
): TPose {
  if (reading === 'effective') {
    const override = source.overrides.read(node.id)?.pose;
    if (override !== undefined) return override;
  }
  return derivedPoseIn(source, node, reading) ?? node.pose;
}

/**
 * The pose the *document* says `node` is at: derived when it derives, else
 * authored. `effectivePose` minus the override step, at every link of the
 * dependency chain — a derived node's document pose holds still while
 * something it derives from is being dragged.
 *
 * For a reader that must not see an in-flight gesture, such as an action
 * capturing the `from` of a transform op.
 */
export function documentPose<TPose>(
  source: PoseSource<TPose>,
  node: PosedNode<TPose>,
): TPose {
  return poseIn(source, node, 'document');
}

/**
 * The pose to draw, pick and measure `node` at. Every pose a reader acts on
 * comes from here.
 */
export function effectivePose<TPose>(
  source: PoseSource<TPose>,
  node: PosedNode<TPose>,
): TPose {
  return poseIn(source, node, 'effective');
}

/**
 * Whether `node`'s pose is a frame its children are expressed in, under a
 * composing strategy.
 *
 * A container that derives its pose from its children cannot be one: moving
 * the frame to cover the children would move the children, and a `RectPose`
 * frame's origin is its corner, so no envelope leaves them in place. Such a
 * container is an envelope instead — its children are stored in its own
 * frame — and the composition fold passes over it.
 */
export function definesFrame(node: { dependsOn?: unknown; derivePose?: unknown }): boolean {
  return !isEnvelope(node);
}

/** Whether `node` derives its pose from its children: a group that is its
 *  members, so moving them moves it. */
export function isEnvelope(node: { dependsOn?: unknown; derivePose?: unknown }): boolean {
  return node.dependsOn === 'children' && node.derivePose !== undefined;
}
