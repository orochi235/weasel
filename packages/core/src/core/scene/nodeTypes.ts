/** The scene tree's node types: a mark, a group, and what `Scene.add` takes to mint one. */
import type { UnitScope } from '@weasel-js/quantity';
import type { LayoutStrategy } from '../../layout/types';
import type { RectPose } from '../geometry/rectPose';
import type { PageInfo, PageRunInfo } from '../pages/pageNodes';
import type { StatedNodeFields } from './statedFields';
import type { NodeId } from '@weasel-js/routing';
import type { DerivePathFn, DerivePoseFn, ClipFromPoseFn, CopiesFromPoseFn } from './nodeFnTypes';

/** A clip a node declares by name rather than by function: see `SceneNode.clip`. */
export type NodeClip = 'outline';

/** The fields every scene node carries, whatever its kind. */
export interface NodeBase<TData, TLayer extends string, TPose> {
  readonly id: NodeId;
  readonly layer: TLayer;
  readonly pose: TPose;
  readonly data: TData;
  readonly parent: NodeId | null;
  /** Nodes whose poses this node's geometry is computed from. Fixed at add
   *  time. Absent or empty means the node's geometry is authored, which is the
   *  normal case.
   *
   *  `'children'` means "my own children, in child order" — a container that
   *  hugs its contents, which a fixed id list cannot express because
   *  reparenting would have to maintain it. The two forms differ in lifetime
   *  as well as in membership: deleting a node deletes everything that names
   *  it in `dependsOn`, but a container outlives the children it derives
   *  from — an emptied group is still a group. */
  readonly dependsOn?: readonly NodeId[] | 'children';
  /** Whether the hit-test walk can return this node. Default `true`; `false`
   *  makes it transparent to picking, so a click on it lands on whatever is
   *  behind — normally its own container.
   *
   *  For content a container owns rather than content the user selects on its
   *  own: the label inside a box, a body's rows. It does not hide the node
   *  from anything else — it still paints, still clips, and a consumer can
   *  still select it by id. */
  readonly pickable?: boolean;
  /** Not drawn, with its whole subtree: picking, area selection, select-all,
   *  snapping and the selection pass over it, and an SVG export writes it with
   *  `display="none"`. Absent means shown; `Scene.isHidden` folds in its
   *  ancestors' flags and its layer's visibility. */
  readonly hidden?: boolean;
  /** Out of reach, with its whole subtree: still drawn, but picking and area
   *  selection pass over it, the selection drops it, and every edit to it
   *  throws, as on a locked layer. Absent means unlocked; `Scene.isLocked`
   *  folds in its ancestors' and its layer's. */
  readonly locked?: boolean;
  /** Computes this node's path from its dependencies, in `dependsOn` order —
   *  each one the node and the pose it is painted at.
   *  A dependency that has been removed arrives as `undefined`.
   *  Returning `null` means "nothing to draw right now". Re-evaluated when a
   *  dependency's world pose changes, never authored. */
  readonly derivePath?: DerivePathFn<TPose, TData, TLayer>;
  /** Computes this node's pose from its dependencies' poses, the same way
   *  `derivePath` computes its path — same `dependsOn` list, same
   *  registry-keyed serialization.
   *
   *  Where a derived path is resolved at paint time and reaches only the
   *  painter, a derived pose is what the node *is* at: it feeds bounds,
   *  hit-testing, selection chrome, snapping and layout, and every reader
   *  gets it through `effectivePose`. A pose override still wins over it.
   *
   *  Returning `null` means "I have nothing to derive from right now", and
   *  the node falls back to its authored `pose`. `setPose` on a derived node
   *  still writes that authored pose; it is simply not what anything reads. */
  readonly derivePose?: DerivePoseFn<TPose, TData, TLayer>;
  /** Ordered child ids. Absent until the node gets its first child. */
  readonly children?: readonly NodeId[];
  /** Optional clip-path source. Re-evaluated each render. Returning `null`
   *  means "no clip for this node right now"; an empty / zero-area path
   *  means "clip everything out" (children render nowhere). Wins over `clip`. */
  readonly clipFromPose?: ClipFromPoseFn<TPose>;
  /** `'outline'` clips the children to this node's own outline: a mark's
   *  painter silhouette, or for a group the silhouette of its `data.path`,
   *  else its box. Absent, and with no `clipFromPose`, the children are not clipped. */
  readonly clip?: NodeClip;
  /** Draws the whole subtree again under each affine it returns, on top of
   *  the original, which still draws once as authored. The copies are paint,
   *  not nodes: nothing stores them, so they follow every edit to the
   *  children, and a pick that lands on one answers with the child it copies.
   *  A copy is a copy of the clipped content — the clip travels with it.
   *  Re-evaluated each render; `null` or `[]` draws no copies. */
  readonly copiesFromPose?: CopiesFromPoseFn<TPose, TData, TLayer>;
  /** Its children are the operands of its own geometry, drawn only through
   *  it: the render walk paints none of them, and a press, a region select
   *  or select-all reaches one only while this node, or a group inside it, is
   *  entered. A node that consumes its children is entered as a group is.
   *  The boolean group (`booleanGroupFields`) is the kit's one. */
  readonly consumesChildren?: boolean;
  /** How this node arranges its children. Whenever the node's
   *  child set or order changes, its bounds change size, or a child's pose is
   *  written, the scene hands the change to the strategy — `depart` for children that left it,
   *  `arrive` for children that joined it, `childPoses` otherwise — and records the poses it writes in the same
   *  undo entry as the change. A drag reads it too: it is the layout `move`
   *  reflows and drops against. */
  readonly layout?: LayoutStrategy<TPose>;
  /** The units its children are shown, typed and snapped in (poses stay in the root's base units), their
   *  worth in the enclosing scope's, and the magnification they are drawn at (`drawnAt`). It covers the
   *  children, not the node; `sceneUnitScopes` reads the chain. */
  readonly units?: UnitScope;
  /** Makes this node a page: a sheet whose pose is its rect, framing what is on it. A child of the page run. */
  readonly page?: PageInfo;
  /** Makes this root the page run: the container that lays out its child pages (`pageRunLayout`). */
  readonly pageRun?: PageRunInfo;
}

/** A node that is drawn and picked as one thing — a shape, a label, an image.
 *  It may still hold children, which are what it is made of. */
export interface MarkNode<TData, TLayer extends string, TPose = RectPose>
  extends NodeBase<TData, TLayer, TPose> {
  readonly kind: 'mark';
}

/** A node the user gathers things into: what Cmd+G creates, what SVG `<g>`
 *  round-trips to. An emptied group is still a group. It paints only its box,
 *  under its children, from `data.background` and `data.border` (`GroupBoxData`). */
export interface GroupNode<TData, TLayer extends string, TPose = RectPose>
  extends NodeBase<TData, TLayer, TPose> {
  readonly kind: 'group';
}

/** A node in the scene tree: either a mark or a group. Re-exported
 *  publicly as `SceneNode`, to avoid colliding with the DOM's `Node`. */
export type Node<TData, TLayer extends string, TPose = RectPose> =
  | MarkNode<TData, TLayer, TPose>
  | GroupNode<TData, TLayer, TPose>;

/** What `Scene.add` needs to mint a node. Everything except the id is
 *  required; the id is generated unless one is supplied. The stated fields
 *  (`pickable`, `hidden`, `units`, `page`, …) mirror the node's. */
export interface AddNodeSpec<TData, TLayer extends string, TPose = RectPose> extends StatedNodeFields {
  kind: 'mark' | 'group';
  layer: TLayer;
  pose: TPose;
  data: TData;
  parent?: NodeId | null;
  index?: number;
  /** Explicit id wins over the Scene's `generateId` and the kit default. */
  id?: NodeId;
  /** Attach a clip-path function to the node; mirrors `SceneNode.clipFromPose`. */
  clipFromPose?: ClipFromPoseFn<TPose>;
  /** Mirrors `SceneNode.copiesFromPose`. */
  copiesFromPose?: CopiesFromPoseFn<TPose, TData, TLayer>;
  /** Mirrors `SceneNode.dependsOn`. */
  dependsOn?: readonly NodeId[] | 'children';
  /** Mirrors `SceneNode.derivePath`. Taken as a live function; its registry key is
   *  looked up from it, never passed in. */
  derivePath?: DerivePathFn<TPose, TData, TLayer>;
  /** Mirrors `SceneNode.derivePose`, on the same terms as `derivePath`. */
  derivePose?: DerivePoseFn<TPose, TData, TLayer>;
  /** Mirrors `SceneNode.layout`. */
  layout?: LayoutStrategy<TPose>;
}

type Writable<T> = { -readonly [K in keyof T]: T[K] };

/** A node as the scene stores it: the same fields as {@link Node}, writable.
 *  Kit-internal — the scene hands out `Node`, and only its own edits write. */
export type MutableNode<TData, TLayer extends string, TPose = RectPose> =
  | (Writable<Omit<MarkNode<TData, TLayer, TPose>, 'children'>> & { children?: NodeId[] })
  | (Writable<Omit<GroupNode<TData, TLayer, TPose>, 'children'>> & { children?: NodeId[] });
