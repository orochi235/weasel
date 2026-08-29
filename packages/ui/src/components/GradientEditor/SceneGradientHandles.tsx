import { useRef, type ReactElement, type RefObject } from 'react';
import {
  fillInPoseFrame,
  fillToBoundsFrame,
  isGradientFill,
  useActionsRegistry,
  useNodeOverlayFrame,
  type FillStyle,
  type GradientFill,
  type RectPose,
  type Scene,
  type Stroke,
  type UiOngoingControl,
  type View,
} from '@weasel-js/core';
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
 * Scene-aware `GradientHandles`: on-canvas geometry handles for the gradient
 * in one node's `fill` or `stroke`, committed through the `setFill` /
 * `setStroke` actions as a single undo entry per drag.
 *
 * Renders nothing unless the targeted slot holds a gradient. The node stores
 * its gradient in `units: 'bounds'` — fractions of its own box, so the paint
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
  const actions = useActionsRegistry();
  const frame = useNodeOverlayFrame(scene, containerRef, nodeId, { view });
  const ctrlRef = useRef<UiOngoingControl | null>(null);

  const gradient = frame ? gradientInSlot(paintOf(scene, nodeId, slot)) : null;
  if (!frame || !gradient) return null;

  const dispatch = (next: GradientFill, phase: 'input' | 'commit'): void => {
    const paint = fillToBoundsFrame(next, frame.box);
    const id = slot === 'fill' ? 'setFill' : 'setStroke';
    if (!ctrlRef.current) ctrlRef.current = actions?.begin(id, { paint }) ?? null;
    else ctrlRef.current.update({ paint });
    if (phase === 'commit' && ctrlRef.current) {
      ctrlRef.current.end('commit');
      ctrlRef.current = null;
    }
  };

  return (
    <GradientHandles
      value={fillInPoseFrame(gradient, frame.box) as GradientFill}
      toScreen={frame.toScreen}
      toLocal={frame.toLocal}
      width={frame.width}
      height={frame.height}
      className={className}
      onInput={(next) => dispatch(next, 'input')}
      onChange={(next) => dispatch(next, 'commit')}
    />
  );
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

function gradientInSlot(paint: FillStyle | null | undefined): GradientFill | null {
  return isGradientFill(paint) ? paint : null;
}
