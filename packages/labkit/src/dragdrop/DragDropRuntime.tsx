import { openPointerSession, type PointerSession, useVisibleRaf } from '@weasel-js/core';
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

export interface DragState {
  item: PaletteItem;
  screenPos: Point;
  feedback: DragFeedback | null;
}

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

export interface UseDragDropResult {
  drag: DragState | null;
  startDrag: (item: PaletteItem, e: ReactPointerEvent) => void;
}

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
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  /** The move the next frame will resolve. Doubles as the throttle's flag:
   *  non-null means a frame is already queued. */
  const pendingPos = useRef<Point | null>(null);
  const sessionRef = useRef<PointerSession | null>(null);

  /** A session keeps the closure it was opened with, so everything the drop
   *  reads has to come from here rather than from that closure. */
  const liveRef = useRef({ capability, state, config, setState, emit, view, worldSpec });
  liveRef.current = { capability, state, config, setState, emit, view, worldSpec };

  const isOverCanvas = useCallback(
    (screenPos: Point): boolean => {
      const el = canvasContainerRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return (
        screenPos.x >= r.left &&
        screenPos.x <= r.right &&
        screenPos.y >= r.top &&
        screenPos.y <= r.bottom
      );
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
    [canvasContainerRef],
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
    setDrag({ ...active, screenPos, feedback });
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
    [clearDrag, frameLoop, isOverCanvas, screenToWorldFromContainer],
  );

  useEffect(() => () => sessionRef.current?.cancel(), []);

  return { drag, startDrag };
}

export interface DragOverlayProps {
  drag: DragState | null;
}

export function DragOverlay({ drag }: DragOverlayProps) {
  if (!drag) return null;
  return <DragGhost item={drag.item} screenPos={drag.screenPos} />;
}
