/**
 * The params the kit's own actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them. An action that
 * reads params gets its entry here, beside the others.
 */
import type { WorldPoint } from '@weasel-js/routing';
import type { IngestItem } from '@weasel-js/gestures';
import type { LassoHitMode } from 'core/adapters/types';
import type { GestureLifecycleOptions } from './gestureLifecycle';
import type { ReparentOnDrop } from './move/session';
import type { DragPanParams } from './defaults/viewportDragPan';
import type { Paint, VertexWidth } from '@weasel-js/paint';
import type { OffsetPathOptions } from '@weasel-js/stroke';
import type { AlignReference } from './align/align';
import type { DistributeMode } from './distribute/distribute';
import type { FlipAxis, FlipPivot } from './flip/helpers';
import type { EditAnchorsParams } from './edit-anchors/params';
import type { SetAnchorFieldParams } from './defaults/anchorFields';

/** `align.*`'s params. */
export type AlignParams = {
  /** The point a reference of `'pointer'` resolves to in place of the pointer dep. */
  world?: WorldPoint;
  /** Default the selection. */
  to?: AlignReference;
};
/** `flip`'s params. */
export type FlipParams = {
  /** The point a pivot of `'pointer'` resolves to in place of the pointer dep. */
  world?: WorldPoint;
  /** Default `'x'`. */
  axis?: FlipAxis;
  /** Default `'each'`. */
  pivot?: FlipPivot;
};
/** A `distribute.*` action's params: what it spaces evenly. */
export type DistributeParams = { mode: DistributeMode };
/** A reorder action's params: one step, or all the way to the front or back. */
export type ReorderParams = { distance: 'adjacent' | 'extreme' };
/** A nudge action's params: the small or the big step. */
export type NudgeParams = { magnitude: 'small' | 'big' };
/** `insert`'s and `place`'s params: the kind of node to make, `'rect'` by default, and whatever else the node
 *  factory for that kind reads — a polygon's `sides`, a star's `points`, a sticky's look. */
export type InsertParams = { kind?: string; [param: string]: unknown };
/** `move`'s params: its history and lifecycle, where a drop lands the moved nodes, and the ids a drag carries. */
export type MoveParams = GestureLifecycleOptions & {
  reparentOnDrop?: ReparentOnDrop;
  expandIds?: (ids: string[]) => string[];
};
/** `rotate`'s params: its history and lifecycle, and the pivot a multi-selection turns about. */
export type RotateParams = GestureLifecycleOptions & { pivot?: 'each' | 'union' };
/** The params of an action finishing a path being drawn: `viaDoubleClick` when a double-click finished it, whose
 *  first click placed a point to take back. */
export type FinishPathParams = { viaDoubleClick?: boolean };
/** `setFill`'s and `setStroke`'s params: a hex color, or a whole paint, which shadows the color. */
export type PaintParams = { color?: string; paint?: Paint | null };
/** `offsetPath`'s params: how far to grow each outline (a negative distance shrinks it), and how its corners join. */
export type OffsetPathParams = { distance?: number; join?: OffsetPathOptions['join']; miterLimit?: number };
/** `ingest`'s params: what a drop or a paste brings and where it landed. */
export type IngestParams = { items?: readonly IngestItem[]; world?: WorldPoint };

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'align.left': AlignParams;
    'align.centerX': AlignParams;
    'align.right': AlignParams;
    'align.top': AlignParams;
    'align.centerY': AlignParams;
    'align.bottom': AlignParams;
    flip: FlipParams;
    'distribute.horizontal': DistributeParams;
    'distribute.vertical': DistributeParams;
    'reorder.forward': ReorderParams;
    'reorder.backward': ReorderParams;
    'nudge.up': NudgeParams;
    'nudge.down': NudgeParams;
    'nudge.left': NudgeParams;
    'nudge.right': NudgeParams;
    'tool.activate': { toolId: string };
    insert: InsertParams;
    place: InsertParams;
    'polygon.adjustSides': { delta?: number };
    'star.adjustPoints': { delta?: number };
    'pen.finishOpen': FinishPathParams;
    'slice.finish': FinishPathParams;
    slice: { cut?: 'freehand' };
    measure: { angleStep?: number };
    lassoSelect: { mode?: LassoHitMode; minVertexSpacing?: number };
    move: MoveParams;
    rotate: RotateParams;
    'viewport.dragPan': DragPanParams;
    ingest: IngestParams;
    'present.step': { by?: number; to?: 'first' | 'last' };
    'present.go': { to?: string | number };
    setFill: PaintParams;
    setStroke: PaintParams;
    setStrokeWidth: { width?: number; vertexWidths?: readonly VertexWidth[] | null };
    setVertexColor: { index?: number; rgba?: readonly [number, number, number, number] | null };
    simplifyPath: { tolerance?: number };
    offsetPath: OffsetPathParams;
    editAnchors: EditAnchorsParams;
    setAnchorField: SetAnchorFieldParams;
  }
}

export type { ActionParamSchema, ActionTunings } from '@weasel-js/routing';
