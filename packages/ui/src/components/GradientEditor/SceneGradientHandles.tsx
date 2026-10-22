import { useLayoutEffect, useRef, type ReactElement, type RefObject } from 'react';
import {
  fillInPoseFrame,
  fillToBoundsFrame,
  isGradientPaint,
  useNodeOverlayFrame,
  useOngoingAction,
  type Paint,
  type GradientPaint,
  type RectPose,
  type Scene,
  type Stroke,
  type View,
  type Fill,
  type Inherit,
  resolveFill,
  resolveStroke,
} from '@weasel-js/core';
import { isMeshGradientPaint, type MeshGradientPaint } from '@weasel-js/core/mesh';
import { MeshHandles } from '../MeshEditor/MeshHandles';
import { GradientHandles } from './GradientHandles';

/** The paint slots a node carries. Either may hold a gradient, and each has
 *  its own action, so the overlay is told which one it is editing. */
export type PaintSlot = 'fill' | 'stroke';

/** What `SceneGradientHandles` reads off a node. Every field is optional, so
 *  any richer app data shape satisfies it. */
export interface PaintedNodeData {
  fill?: Fill | Inherit | null;
  stroke?: Stroke | Inherit | null;
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
 * actions as a single undo entry per drag. A canceled drag cancels the action,
 * and so does unmounting the overlay while a handle is held.
 *
 * Renders nothing unless the targeted slot holds a gradient or a mesh. The
 * node stores its gradient in `units: 'bounds'`, fractions of its own box; the
 * handles get it resolved onto the box and every edit is normalized back on
 * the way out.
 */
export function SceneGradientHandles<
  TData extends PaintedNodeData,
  TLayer extends string,
  TPose extends RectPose,
>(props: SceneGradientHandlesProps<TData, TLayer, TPose>): ReactElement | null {
  const { scene, containerRef, nodeId, slot, view, className } = props;
  const frame = useNodeOverlayFrame(scene, containerRef, nodeId, { view });
  const edit = useOngoingAction(slot === 'fill' ? 'setFill' : 'setStroke');
  // An edit is open here only while a handle is held, so one still open at unmount is a drag cut short, and
  // that is a cancel. `useOngoingAction` would commit it in its own cleanup, which this layout cleanup runs
  // ahead of; the handle's unmount cancel comes after both and must not open a second edit to cancel.
  const gone = useRef(false);
  useLayoutEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
      edit.cancel();
    };
  }, [edit]);

  const paint = frame ? paintOf(scene, nodeId, slot) : null;
  if (!frame || !paint) return null;

  const dispatch = (next: Paint, phase: 'input' | 'commit'): void => {
    if (gone.current) return;
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
    onInput: (next: Paint) => dispatch(next, 'input'),
    onChange: (next: Paint) => dispatch(next, 'commit'),
    onCancel: () => edit.cancel(),
  };

  if (isGradientPaint(paint)) {
    return <GradientHandles value={fillInPoseFrame(paint, frame.box) as GradientPaint} {...common} />;
  }
  if (isMeshGradientPaint(paint)) {
    const resolved = fillInPoseFrame(paint, frame.box) as unknown as MeshGradientPaint;
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
): Paint | null | undefined {
  if (nodeId == null) return undefined;
  const data = (scene.nodes as ReadonlyMap<string, { data: TData }>).get(nodeId)?.data;
  if (!data) return undefined;
  // An inherited paint is its container's, and is edited there.
  return slot === 'fill' ? resolveFill(data.fill)?.paint : resolveStroke(data.stroke)?.paint;
}
