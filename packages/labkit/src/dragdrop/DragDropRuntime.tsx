import { useVisibleRaf } from '@weasel-js/core';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { screenToWorld } from '../canvas/canvasCoords';
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
  state: TS;
  config: TC;
  setState: (next: TS | ((prev: TS) => TS)) => void;
  emit: (event: string) => void;
}

export interface UseDragDropResult {
  drag: DragState | null;
  startDrag: (item: PaletteItem, originScreenPos: Point) => void;
}

export function useDragDrop<TS, TC>({
  capability,
  canvasContainerRef,
  view,
  state,
  config,
  setState,
  emit,
}: UseDragDropArgs<TS, TC>): UseDragDropResult {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  /** The move the next frame will resolve. Doubles as the throttle's flag:
   *  non-null means a frame is already queued. */
  const pendingPos = useRef<Point | null>(null);

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
      return screenToWorld({ x: screenPos.x - r.left, y: screenPos.y - r.top }, view);
    },
    [canvasContainerRef, view],
  );

  const frameLoop = useVisibleRaf(() => {
    const screenPos = pendingPos.current;
    pendingPos.current = null;
    const active = dragRef.current;
    if (!active || !screenPos) return;
    let feedback: DragFeedback | null = null;
    if (capability.onDragOver && isOverCanvas(screenPos)) {
      const world = screenToWorldFromContainer(screenPos);
      if (world) feedback = capability.onDragOver(world, active.item, state, config);
    }
    setDrag({ ...active, screenPos, feedback });
  });

  useEffect(() => {
    if (!drag) return;
    const handleMove = (e: PointerEvent) => {
      const screenPos = { x: e.clientX, y: e.clientY };
      const current = dragRef.current;
      if (!current) return;
      if (pendingPos.current !== null) {
        // A frame is already queued: keep the ghost under the cursor and let
        // that frame probe the drop target from the newest position.
        pendingPos.current = screenPos;
        dragRef.current = { ...current, screenPos };
        setDrag(dragRef.current);
        return;
      }
      pendingPos.current = screenPos;
      frameLoop.request();
    };
    const handleUp = (e: PointerEvent) => {
      const screenPos = { x: e.clientX, y: e.clientY };
      const active = dragRef.current;
      if (!active) return;
      pendingPos.current = null;
      frameLoop.cancel();
      if (isOverCanvas(screenPos)) {
        const world = screenToWorldFromContainer(screenPos);
        if (world) {
          const nextState = capability.onDrop(world, active.item, state, config);
          setState(nextState);
          emit('canvas.itemAdded');
        }
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [
    drag,
    capability,
    state,
    config,
    setState,
    emit,
    frameLoop,
    isOverCanvas,
    screenToWorldFromContainer,
  ]);

  const startDrag = useCallback((item: PaletteItem, originScreenPos: Point) => {
    setDrag({ item, screenPos: originScreenPos, feedback: null });
  }, []);

  return { drag, startDrag };
}

export interface DragOverlayProps {
  drag: DragState | null;
}

export function DragOverlay({ drag }: DragOverlayProps) {
  if (!drag) return null;
  return <DragGhost item={drag.item} screenPos={drag.screenPos} />;
}
