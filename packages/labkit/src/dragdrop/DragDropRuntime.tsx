import { openPointerSession, type PointerSession, useLatest, useVisibleRaf } from '@weasel-js/core';
import { boxContainsPoint } from '@weasel-js/geom';
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { screenToWorld } from '../canvas/canvasCoords';
import { resolveFrame, type WorldSpec } from '../canvas/worldSpec';
import type {
  DragDropCapability,
  DragFeedback,
  PaletteItem,
  Point,
  ViewTransform,
} from '../instrument/types';
import { DragGhost } from './DragGhost';

/** A palette drag in progress. `screenPos` is in client pixels; `feedback` is
 *  the last `onDragOver` answer — `null` off the canvas or without one. */
export interface DragState {
  item: PaletteItem;
  screenPos: Point;
  feedback: DragFeedback | null;
}

/** Inputs to `useDragDrop`: the capability, the element that counts as the
 *  drop target, and the trial state a drop rewrites. */
export interface UseDragDropArgs<TS, TC> {
  capability: DragDropCapability<TS, TC>;
  canvasContainerRef: RefObject<HTMLElement | null>;
  view: ViewTransform;
  /** The instrument's coordinate system, resolved against the container each
   *  time a screen point is converted — the container is what knows its size. */
  worldSpec?: WorldSpec;
  state: TS;
  config: TC;
  setState: (next: TS | ((prev: TS) => TS)) => void;
  emit: (event: string) => void;
}

/** The live drag, and the handler a palette item calls on pointerdown. */
export interface UseDragDropResult {
  drag: DragState | null;
  startDrag: (item: PaletteItem, e: ReactPointerEvent) => void;
}

/**
 * Run palette-to-canvas drags for a `DragDropCapability`. Releasing over the
 * container converts the pointer to world coordinates, applies `onDrop`'s
 * state and emits `'canvas.itemAdded'`; releasing anywhere else, or a canceled
 * gesture, drops nothing. `onDragOver` is probed at most once per frame.
 */
export function useDragDrop<TS, TC>({
  capability,
  canvasContainerRef,
  view,
  state,
  config,
  setState,
  emit,
  worldSpec,
}: UseDragDropArgs<TS, TC>): UseDragDropResult {
  const [drag, setDrag] = useState<DragState | null>(null);
  // Owned by the handlers below, which write it alongside every `setDrag`.
  const dragRef = useRef<DragState | null>(null);
  /** The move the next frame will resolve. Doubles as the throttle's flag:
   *  non-null means a frame is already queued. */
  const pendingPos = useRef<Point | null>(null);
  const sessionRef = useRef<PointerSession | null>(null);

  /** A session keeps the closure it was opened with, so everything the drop
   *  reads has to come from here rather than from that closure. */
  const liveRef = useLatest({ capability, state, config, setState, emit, view, worldSpec });

  const isOverCanvas = useCallback(
    (screenPos: Point): boolean => {
      const el = canvasContainerRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return boxContainsPoint([r.left, r.top, r.right, r.bottom], screenPos.x, screenPos.y);
    },
    [canvasContainerRef],
  );

  const screenToWorldFromContainer = useCallback(
    (screenPos: Point): Point | null => {
      const el = canvasContainerRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const frame = resolveFrame(liveRef.current.worldSpec, { width: r.width, height: r.height });
      return screenToWorld(
        { x: screenPos.x - r.left, y: screenPos.y - r.top },
        liveRef.current.view,
        frame,
      );
    },
    [canvasContainerRef, liveRef],
  );

  const frameLoop = useVisibleRaf(() => {
    const screenPos = pendingPos.current;
    pendingPos.current = null;
    const active = dragRef.current;
    if (!active || !screenPos) return;
    const live = liveRef.current;
    let feedback: DragFeedback | null = null;
    if (live.capability.onDragOver && isOverCanvas(screenPos)) {
      const world = screenToWorldFromContainer(screenPos);
      if (world) feedback = live.capability.onDragOver(world, active.item, live.state, live.config);
    }
    dragRef.current = { ...active, screenPos, feedback };
    setDrag(dragRef.current);
  });

  const clearDrag = useCallback(() => {
    pendingPos.current = null;
    frameLoop.cancel();
    sessionRef.current = null;
    dragRef.current = null;
    setDrag(null);
  }, [frameLoop]);

  const startDrag = useCallback(
    (item: PaletteItem, e: ReactPointerEvent) => {
      if (sessionRef.current) return;
      const next: DragState = { item, screenPos: { x: e.clientX, y: e.clientY }, feedback: null };
      dragRef.current = next;
      setDrag(next);
      sessionRef.current = openPointerSession(e.currentTarget, e, {
        onMove: (ev) => {
          const screenPos = { x: ev.clientX, y: ev.clientY };
          const current = dragRef.current;
          if (!current) return;
          if (pendingPos.current !== null) {
            // A frame is already queued: keep the ghost under the cursor and
            // let that frame probe the drop target from the newest position.
            pendingPos.current = screenPos;
            dragRef.current = { ...current, screenPos };
            setDrag(dragRef.current);
            return;
          }
          pendingPos.current = screenPos;
          frameLoop.request();
        },
        onEnd: (ev) => {
          const screenPos = { x: ev.clientX, y: ev.clientY };
          const active = dragRef.current;
          clearDrag();
          if (!active || !isOverCanvas(screenPos)) return;
          const world = screenToWorldFromContainer(screenPos);
          if (!world) return;
          const live = liveRef.current;
          live.setState(live.capability.onDrop(world, active.item, live.state, live.config));
          live.emit('canvas.itemAdded');
        },
        // An interrupted gesture never named a destination, so it drops nothing.
        onCancel: clearDrag,
      });
    },
    [clearDrag, frameLoop, isOverCanvas, liveRef, screenToWorldFromContainer],
  );

  useEffect(() => () => sessionRef.current?.cancel(), []);

  return { drag, startDrag };
}

/** Props for `DragOverlay`. */
export interface DragOverlayProps {
  drag: DragState | null;
}

/** The ghost for `drag`, or nothing when no drag is live. */
export function DragOverlay({ drag }: DragOverlayProps) {
  if (!drag) return null;
  return <DragGhost item={drag.item} screenPos={drag.screenPos} />;
}
