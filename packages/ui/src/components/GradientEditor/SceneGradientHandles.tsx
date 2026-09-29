import { type ReactElement, type RefObject } from 'react';
import {
  fillInPoseFrame,
  fillToBoundsFrame,
  isGradientFill,
  useNodeOverlayFrame,
  useOngoingAction,
  type FillStyle,
  type GradientFill,
  type RectPose,
  type Scene,
  type Stroke,
  type View,
} from '@weasel-js/core';
import { isMeshGradientFill, type MeshGradientFill } from '@weasel-js/core/mesh';
import { MeshHandles } from '../MeshEditor/MeshHandles';
import { GradientHandles } from './GradientHandles';

/** The paint slots a node carries. Either may hold a gradient, and each has
 *  its own action, so the overlay is told which one it is editing. */
export type PaintSlot = 'fill' | 'stroke';

/** What `SceneGradientHandles` reads off a node. Every field is optional, so
 *  any richer app data shape satisfies it. */
export interface PaintedNodeData {
  fill?: FillStyle | null;
  stroke?: Stroke | null;
}

/** Props for {@link SceneGradientHandles}. */
export interface SceneGradientHandlesProps<
  TData extends PaintedNodeData,
  TLayer extends string,
  TPose extends RectPose,
> {
  scene: Scene<TData, TLayer, TPose>;
  /** The element the overlay is positioned in. Must be the canvas's own box,
   *  or the handles land somewhere other than the paint. */
  containerRef: RefObject<HTMLElement | null>;
  /** The node whose paint is being edited — usually the lone selected id. */
  nodeId: string | null | undefined;
  /** Which of the node's two paints these handles move. */
  slot: PaintSlot;
  /** Current viewport; a thunk is re-read per projection. See
   *  `useNodeOverlayFrame`. */
  view?: View | (() => View);
  className?: string;
}

/**
 * Scene-aware paint handles: on-canvas geometry handles for the gradient in
 * one node's `fill` or `stroke` — `GradientHandles` for the three ramps,
 * `MeshHandles` for a mesh — committed through the `setFill` / `setStroke`
 * actions as a single undo entry per drag.
 *
 * Renders nothing unless the targeted slot holds a gradient or a mesh. The
 * node stores its gradient in `units: 'bounds'` — fractions of its own box, so the paint
 * survives pan, zoom and resize — which is not a frame polar math can work
 * in; the handles get it resolved onto the box and every edit is normalized
 * back on the way out.
 *
 * `slot` is a prop rather than state the kit keeps: an app that edits fill
 * and stroke separately already knows which one has focus.
 */
export function SceneGradientHandles<
  TData extends PaintedNodeData,
  TLayer extends string,
  TPose extends RectPose,
>(props: SceneGradientHandlesProps<TData, TLayer, TPose>): ReactElement | null {
  const { scene, containerRef, nodeId, slot, view, className } = props;
  const frame = useNodeOverlayFrame(scene, containerRef, nodeId, { view });
  const edit = useOngoingAction(slot === 'fill' ? 'setFill' : 'setStroke');

  const paint = frame ? paintOf(scene, nodeId, slot) : null;
  if (!frame || !paint) return null;

  const dispatch = (next: FillStyle, phase: 'input' | 'commit'): void => {
    const normalized = fillToBoundsFrame(next, frame.box);
    if (phase === 'commit') edit.commit({ paint: normalized });
    else edit.input({ paint: normalized });
  };
  const common = {
    toScreen: frame.toScreen,
    toLocal: frame.toLocal,
    width: frame.width,
    height: frame.height,
    className,
    onInput: (next: FillStyle) => dispatch(next, 'input'),
    onChange: (next: FillStyle) => dispatch(next, 'commit'),
  };

  if (isGradientFill(paint)) {
    return <GradientHandles value={fillInPoseFrame(paint, frame.box) as GradientFill} {...common} />;
  }
  if (isMeshGradientFill(paint)) {
    const resolved = fillInPoseFrame(paint, frame.box) as unknown as MeshGradientFill;
    // Still in the bounds frame means the mesh kind has not loaded, and
    // handles drawn now would sit in fractions of the box.
    if (resolved.units === 'bounds') return null;
    return <MeshHandles value={resolved} {...common} />;
  }
  return null;
}

function paintOf<TData extends PaintedNodeData, TLayer extends string, TPose extends RectPose>(
  scene: Scene<TData, TLayer, TPose>,
  nodeId: string | null | undefined,
  slot: PaintSlot,
): FillStyle | null | undefined {
  if (nodeId == null) return undefined;
  const data = (scene.nodes as ReadonlyMap<string, { data: TData }>).get(nodeId)?.data;
  if (!data) return undefined;
  return slot === 'fill' ? data.fill : data.stroke?.paint;
}
