/**
 * The params the kit's own actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them. An action that
 * reads params gets its entry here, beside the others.
 */
import type { DragSample, ImmediateParams, WorldPoint } from '@weasel-js/routing';
import type { IngestItem } from '@weasel-js/gestures';
import type { LassoHitMode } from 'core/adapters/types';
import type { GestureLifecycleOptions } from './gestureLifecycle';
import type { ReparentOnDrop } from './move/session';
import type { DragPanParams } from './defaults/viewportDragPan';
import type { Paint, VertexWidth } from '@weasel-js/paint';
import type { EditAnchorsParams } from './edit-anchors/params';
import type { SetAnchorFieldParams } from 'domains/paths/useAnchorFields';

/** A nudge action's params: the small or the big step. */
export type NudgeParams = { magnitude: 'small' | 'big' };
/** `insert`'s and `place`'s params: the kind of node to make, `'rect'` by default, and whatever else the node
 *  factory for that kind reads — a polygon's `sides`, a star's `points`, a sticky's look. */
export type InsertParams = { kind?: string; samples?: ReadonlyArray<DragSample>; [param: string]: unknown };
/** `place`'s params: an insert's, the size of the node to center on the click, and where the click landed. */
export type PlaceParams = InsertParams & { size?: { width: number; height: number } } & Pick<ImmediateParams, 'world' | 'mods'>;
/** The params of an action stepping a tool's count option: a key binding's `delta`, or a wheel's `deltaY`. */
export type CountStepParams = { delta?: number } & Pick<ImmediateParams, 'deltaY'>;
/** `setFillOpacity`'s and `setStrokeOpacity`'s params: the paint's opacity, 0..1. */
export type OpacityParams = { alpha01?: number };
/** `viewport.zoom`'s params: the zoom a binding asks for, and the wheel or pinch it read. */
export type ViewportZoomParams = { kind?: 'wheel' | 'pinch' | 'in' | 'out' | 'reset' | 'fit' } &
  Pick<ImmediateParams, 'clientX' | 'clientY' | 'deltaY' | 'scale'>;
/** A wheel scroll's params: the axis it is held to, whether Shift turned it across, and the wheel's deltas. */
export type WheelScrollParams = { axis?: 'both' | 'x' | 'y'; swapAxis?: boolean } & Pick<ImmediateParams, 'deltaX' | 'deltaY'>;
/** The params of a click picking what is under it. */
export type PickParams = Pick<ImmediateParams, 'world' | 'mods' | 'viewId'>;
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
/** `ingest`'s params: what a drop or a paste brings and where it landed. */
export type IngestParams = { items?: readonly IngestItem[]; world?: WorldPoint };

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'nudge.up': NudgeParams;
    'nudge.down': NudgeParams;
    'nudge.left': NudgeParams;
    'nudge.right': NudgeParams;
    'tool.activate': { toolId: string };
    insert: InsertParams;
    place: PlaceParams;
    'insert.adjustRotation': Pick<ImmediateParams, 'deltaY'>;
    'polygon.adjustSides': CountStepParams;
    'star.adjustPoints': CountStepParams;
    lassoSelect: { mode?: LassoHitMode; minVertexSpacing?: number };
    move: MoveParams;
    rotate: RotateParams;
    'viewport.dragPan': DragPanParams;
    ingest: IngestParams;
    'clipboard.pasteEvent': IngestParams;
    'clipboard.paste': Pick<ImmediateParams, 'world'>;
    'viewport.wheelPan': WheelScrollParams;
    'viewport.zoom': ViewportZoomParams;
    'container.scroll': WheelScrollParams & Pick<ImmediateParams, 'world'>;
    'select.pick': PickParams;
    'select.deep': PickParams;
    'select.collapseDeferred': Pick<ImmediateParams, 'mods'>;
    'group.enter': Pick<ImmediateParams, 'world' | 'viewId'>;
    'group.leave': Pick<ImmediateParams, 'world'>;
    'eyedropper.pick': Pick<ImmediateParams, 'press'>;
    'present.step': { by?: number; to?: 'first' | 'last' };
    'present.go': { to?: string | number };
    setFill: PaintParams;
    setStroke: PaintParams;
    setFillOpacity: OpacityParams;
    setStrokeOpacity: OpacityParams;
    setStrokeWidth: { width?: number; vertexWidths?: readonly VertexWidth[] | null };
    setVertexColor: { index?: number; rgba?: readonly [number, number, number, number] | null };
    editAnchors: EditAnchorsParams;
    setAnchorField: SetAnchorFieldParams;
  }
}

export type { ActionParamSchema, ActionTunings } from '@weasel-js/routing';
