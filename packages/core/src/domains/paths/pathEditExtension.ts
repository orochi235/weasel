/**
 * What a feature adds to path edit without path edit knowing it: marks drawn
 * on the open path, parts of it to press, marks a click selects and Delete
 * removes, a share in shaping an anchor or handle drag, what an edit must keep
 * true when it commits, and how a path drawn from another form is edited. A
 * preset carries its extensions as `FeaturePreset.pathEdit`; core consults
 * them in preset order.
 */
import type { DrawCommand } from '@weasel-js/renderer';
import type { AnchorSet, PointOrigin, PolygonPath, View } from '@weasel-js/geom';
import type { OngoingOverlay } from '@weasel-js/routing';
import type { HandleLocks } from 'interactions/actions/edit-anchors/params';
import type { SnapDep } from 'interactions/actions/snapDep';
import type { PathRepresentation } from './pathRepresentation';

/** A mark an extension drew that is selected in place of anchors: Delete
 *  acts on it, and selecting anchors clears it. */
export interface PathEditMark {
  /** The extension that drew it. */
  owner: string;
  /** Which of its marks, in the extension's own numbering. */
  index: number;
}

/** The open path as an extension's marks and parts read it. */
export interface PathEditTarget {
  /** The node being edited. */
  id: string;
  /** Its committed pose and data. */
  node: { pose: unknown; data: unknown };
  /** The path as drawn now, in-flight edits included, in world space. */
  path: PolygonPath;
  /** `path`'s anchors. */
  anchors: AnchorSet;
}

/** What {@link PathEditExtension.marks} draws with. */
export interface PathEditMarksCtx extends PathEditTarget {
  view: View;
  /** World space to the screen space the marks are drawn in. */
  toScreen(p: { x: number; y: number }): { x: number; y: number };
  /** Chrome-caps' answer for a chrome id; marks gated by one ask it. */
  isVisible(chromeId: string): boolean;
  /** The selected mark's index when this extension owns it, else null. */
  selected: number | null;
}

/** A grabbable point an extension adds to the open path. A press on it
 *  routes as an affordance hit of kind `hitKind`. */
export interface PathEditPart {
  x: number;
  y: number;
  hitKind: string;
  /** Chrome-caps id it is hit-tested under, beside `path-edit.anchors`. */
  chromeId?: string;
  /** Hit radius in screen px; path edit's anchor radius when left out. */
  hitRadiusPx?: number;
  /** Pushes the part `px` screen pixels from (x, y) along the world-space
   *  `normal`, so it keeps its distance at any zoom. */
  standoff?: { px: number; normal: { x: number; y: number } };
}

type Point = { x: number; y: number };

/** An anchor or handle drag on the open path, as it starts. */
export interface PathEditDragStart extends Omit<PathEditTarget, 'node'> {
  /** The node's committed pose and data; null when it cannot be read. */
  node: PathEditTarget['node'] | null;
  /** What the press grabbed: an anchor, or one of its handles. */
  part: 'anchor' | 'controlIn' | 'controlOut';
  /** The pressed anchor, as a flat index. */
  anchorIndex: number;
  /** The anchors an anchor drag moves, as flat indices; empty for a handle
   *  drag, or when Shift took the pressed anchor out of the selection. */
  dragging: readonly number[];
  /** The view's world-to-screen scale at the press, to measure in screen
   *  pixels by; absent without a view. */
  scale?: { x: number; y: number };
  /** The canvas's `snap` dep, to begin a session on; absent without one. */
  snap?: SnapDep;
}

/** A handle drag's move, as {@link PathEditDrag.handle} reads it. */
export interface PathEditHandleMove {
  /** The handle locks in force this move, modifiers included. */
  locks: HandleLocks;
}

/** One extension's share of a drag in flight. Every member is optional. */
export interface PathEditDrag {
  /**
   * For an anchor drag, anchors that follow it and the share of its delta
   * each moves by, keyed by flat index. Read every move. When any extension
   * gives one, the drag moves its dragged anchors in full and every anchor
   * named by the largest share given, and moves no symmetric images.
   */
  weights?(): ReadonlyMap<number, number>;
  /** For a handle drag, where the handle goes, given `to`: where the pointer
   *  and the locks in force put it. Extensions answer in turn, each from the
   *  last one's answer. */
  handle?(to: Point, move: PathEditHandleMove): Point;
  /** A wheel turned while the drag is in flight. Return true to claim it;
   *  the drag then redoes its last move. */
  wheel?(wheel: { deltaX: number; deltaY: number; deltaZ: number }): boolean;
  /** Overlays to draw while the drag is in flight, for `current`, the path
   *  as the drag has made it. */
  overlays?(current: AnchorSet): readonly OngoingOverlay[];
  /** The drag is over, committed or canceled. */
  end?(): void;
}

/** Another node an edit changes along with the edited one. */
export interface PathEditOther {
  id: string;
  /** Its new path, in world space, stored where the node keeps its own. */
  path?: PolygonPath;
  /** Data fields to set on it. */
  data?: Record<string, unknown>;
  /** Delete it: what it kept true no longer has anything to hold. */
  remove?: boolean;
}

/** What an edit commits once an extension has finished it. */
export interface FinishedPathEdit {
  path: PolygonPath;
  /** Data fields to set beside the path. */
  data?: Record<string, unknown>;
  /** Other nodes the edit changes, committed in the same history entry and previewed with it. */
  others?: readonly PathEditOther[];
}

/** The scene as {@link PathEditExtension.finishEdit} reads it, for an edit that reaches past one node. */
export interface PathEditFinishCtx {
  /** The edited node's id. */
  id: string;
  /** A node's committed pose, data and dependencies; null when there is none. */
  node(id: string): { pose: unknown; data: unknown; dependsOn?: readonly string[] | 'children' } | null;
  /** A node's committed editable path, in world space; null when it has none. */
  path(id: string): PolygonPath | null;
  /** The nodes that list `id` in their `dependsOn`, directly or through others. */
  dependents(id: string): readonly string[];
}

/**
 * The scene as {@link PathEditExtension.finishTransform} reads it: `node` and
 * `path` answer each node as the transform leaves it, `before` as it was.
 */
export interface PathTransformFinishCtx extends Omit<PathEditFinishCtx, 'id'> {
  /** The nodes the transform moves, resizes or turns. */
  ids: readonly string[];
  /** A node's committed editable path before the transform, in world space; null when it has none. */
  before(id: string): PolygonPath | null;
}

/** One feature's share of path edit. Every member is optional. */
export interface PathEditExtension {
  /** Names it as a {@link PathEditMark}'s owner. Unique per canvas. */
  readonly id: string;
  /** Draw commands for the open path, in screen space, under its anchor
   *  markers. Called every frame the overlay paints. */
  marks?(ctx: PathEditMarksCtx): DrawCommand[];
  /** Grabbable points on the open path, pressed ahead of its segments and
   *  behind its anchors. */
  parts?(target: PathEditTarget): readonly PathEditPart[];
  /** The index of this extension's mark a click at `screen` (in the
   *  overlay's screen space) lands on, or -1. Asked when a click misses
   *  every anchor. */
  markAt?(target: PathEditTarget, toScreen: PathEditMarksCtx['toScreen'], screen: { x: number; y: number }): number;
  /** Remove mark `index` of the node `target` names, committing through
   *  `store`. Delete in path edit calls it on the selected mark. */
  deleteMark?(target: PathEditTarget, index: number, store: PathEditStore): void;
  /** Its share of an anchor or handle drag starting on the open path, or
   *  null to sit it out. Asked once, at the press. */
  drag?(start: PathEditDragStart): PathEditDrag | null;
  /**
   * `worldPath`, an edit of `node`'s committed path, finished so whatever
   * this extension keeps true holds — the path, and any data fields that
   * change with it, and any other nodes it has to move to keep it. Null when
   * it cannot hold, and the edit should then not happen. Runs on every commit
   * of an edit and every frame of one in flight. `ctx` reads the rest of the
   * scene; it is absent where an edit has no scene behind it.
   */
  finishEdit?(
    node: { pose: unknown; data: unknown },
    worldPath: PolygonPath,
    origins?: readonly (PointOrigin | null)[],
    ctx?: PathEditFinishCtx,
  ): FinishedPathEdit | null;
  /**
   * The other nodes a whole-node transform — a move, resize, rotate, flip or
   * nudge — changes along with the nodes it transforms, so whatever this
   * extension keeps true across nodes holds; committed in the transform's
   * history entry. Null when the transform should not happen. An entry
   * naming a node the transform itself moves is ignored.
   */
  finishTransform?(ctx: PathTransformFinishCtx): readonly PathEditOther[] | null;
  /** How path edit reads and writes the nodes whose `data.representation`
   *  is of its kind. */
  representation?: PathRepresentation;
}

/** Commits a node's new path and data as one history entry, with no
 *  extension finishing it. */
export type PathEditStore = (id: string, worldPath: PolygonPath, label: string, data?: Record<string, unknown>) => void;

/**
 * Data fields that describe how a node's geometry was made, or name its
 * anchors, and so mean nothing once the geometry is replaced some other way.
 * A writer replacing a node's path drops them: a held warp, path
 * constraints, a skin, the form a path was drawn from.
 */
export const GEOMETRY_BOUND_DATA: readonly string[] = ['skin', 'constraints', 'warp', 'representation'];

/** `data` without the fields in {@link GEOMETRY_BOUND_DATA}, other than `keep`. */
export function withoutGeometryBoundData<T>(data: T, keep: readonly string[] = []): T {
  if (data === null || typeof data !== 'object') return data;
  const drop = GEOMETRY_BOUND_DATA.filter((k) => k in (data as object) && !keep.includes(k));
  if (drop.length === 0) return data;
  const out = { ...(data as Record<string, unknown>) };
  for (const k of drop) delete out[k];
  return out as T;
}
