import {
  type Action,
  type Carry,
  type InvocationCtx,
  startCarry,
  useAction,
  useLatest,
  useVisibleRaf,
} from '@weasel-js/core';
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CameraContext } from '../canvas/CameraInput';
import { frameLocalToWorld } from '../canvas/cameraView';
import type { WorldFrame } from '../canvas/worldSpec';
import type {
  DragDropCapability,
  DragFeedback,
  PaletteItem,
  Point,
} from '../instrument/types';
import { DragGhost } from './DragGhost';

/** The carry type a palette item travels as. */
export const PALETTE_CARRY_TYPE = 'labkit/palette-item';

/** The action a palette drop routes through, on the canvas it lands on. */
export const PALETTE_DROP_ID = 'labkit.paletteDrop';

/** A palette drag in progress. `screenPos` is in client pixels; `feedback` is
 *  the last `onDragOver` answer — `null` off the canvas or without one; `from`
 *  is the element the drag began on. */
export interface DragState {
  item: PaletteItem;
  from: Element;
  screenPos: Point;
  feedback: DragFeedback | null;
}

/** Inputs to `useDragDrop`: the capability, and the trial state a drop rewrites. */
export interface UseDragDropArgs<TS, TC> {
  capability: DragDropCapability<TS, TC>;
  state: TS;
  config: TC;
  setState: (next: TS | ((prev: TS) => TS)) => void;
  emit: (event: string) => void;
}

/** The live drag, the handler a palette item calls on pointerdown, and the
 *  drop target to render inside the canvas the palette drops onto. */
export interface UseDragDropResult {
  drag: DragState | null;
  startDrag: (item: PaletteItem, e: ReactPointerEvent) => void;
  /** Render inside a `<CanvasStack>`: it binds the palette drop on that
   *  canvas's dispatcher, beside its pan, zoom, and tap. */
  target: ReactNode;
}

/** What the drop action calls back into the hook with, in the instrument's world. */
interface DropSink {
  over(world: Point | null): void;
  drop(world: Point, item: PaletteItem): void;
}

/**
 * Run palette-to-canvas drags for a `DragDropCapability`. A palette item's
 * press starts a carry; releasing it over the canvas `target` is rendered in
 * applies `onDrop`'s state and emits `'canvas.itemAdded'`, and releasing
 * anywhere else, or a canceled gesture, drops nothing. `onDragOver` is probed
 * at most once per frame while the carry is over the canvas.
 */
export function useDragDrop<TS, TC>({
  capability,
  state,
  config,
  setState,
  emit,
}: UseDragDropArgs<TS, TC>): UseDragDropResult {
  const [drag, setDrag] = useState<DragState | null>(null);
  // Owned by the handlers below, which write it alongside every `setDrag`.
  const dragRef = useRef<DragState | null>(null);
  /** Where the carry is over the canvas, for the next frame's probe. */
  const pendingWorld = useRef<Point | null>(null);
  const carryRef = useRef<Carry | null>(null);
  const liveRef = useLatest({ capability, state, config, setState, emit });

  const update = useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const frameLoop = useVisibleRaf(() => {
    const world = pendingWorld.current;
    const active = dragRef.current;
    if (!active || !world) return;
    const live = liveRef.current;
    const feedback = live.capability.onDragOver?.(world, active.item, live.state, live.config) ?? null;
    update({ ...active, feedback });
  });

  const sink = useMemo<DropSink>(
    () => ({
      over: (world) => {
        pendingWorld.current = world;
        if (world) {
          frameLoop.request();
          return;
        }
        frameLoop.cancel();
        const active = dragRef.current;
        if (active?.feedback) update({ ...active, feedback: null });
      },
      drop: (world, item) => {
        const live = liveRef.current;
        live.setState(live.capability.onDrop(world, item, live.state, live.config));
        live.emit('canvas.itemAdded');
      },
    }),
    [frameLoop, liveRef, update],
  );

  const clearDrag = useCallback(() => {
    pendingWorld.current = null;
    frameLoop.cancel();
    carryRef.current = null;
    update(null);
  }, [frameLoop, update]);

  const startDrag = useCallback(
    (item: PaletteItem, e: ReactPointerEvent) => {
      if (carryRef.current) return;
      update({ item, from: e.currentTarget, screenPos: { x: e.clientX, y: e.clientY }, feedback: null });
      carryRef.current = startCarry(
        e.currentTarget,
        e,
        { type: PALETTE_CARRY_TYPE, value: item },
        {
          onMove: (ev) => {
            const current = dragRef.current;
            if (current) update({ ...current, screenPos: { x: ev.clientX, y: ev.clientY } });
          },
          onEnd: clearDrag,
          // An interrupted gesture never named a destination, so it drops nothing.
          onCancel: clearDrag,
        },
      );
    },
    [clearDrag, update],
  );

  useEffect(() => () => carryRef.current?.cancel(), []);

  const target = useMemo(() => <PaletteDropTarget sink={sink} />, [sink]);
  return { drag, startDrag, target };
}

const ANY = 'optional' as const;

function paletteDropAction(sink: DropSink, frame: () => WorldFrame | undefined): Action {
  const world = (ctx: InvocationCtx): Point => frameLocalToWorld(ctx.world, frame());
  return {
    id: PALETTE_DROP_ID,
    label: 'Drop a palette item',
    defaultBinding: {
      kind: 'carry',
      types: [PALETTE_CARRY_TYPE],
      mods: { alt: ANY, ctrl: ANY, meta: ANY, shift: ANY },
    },
    invoker: {
      timing: 'ongoing',
      start: (ctx) => {
        const item = ctx.carry?.value as PaletteItem | undefined;
        if (!item) return {};
        sink.over(world(ctx));
        return {
          onMove: (c) => sink.over(world(c)),
          onEnd: (c, reason) => {
            sink.over(null);
            if (reason === 'commit') sink.drop(world(c), item);
          },
        };
      },
    },
  };
}

/** Binds the palette drop on the canvas around it. Renders nothing. */
function PaletteDropTarget({ sink }: { sink: DropSink }) {
  const camera = useContext(CameraContext);
  const frameRef = useLatest(camera?.frame);
  const action = useMemo(
    () => paletteDropAction(sink, () => frameRef.current),
    [sink, frameRef],
  );
  useAction(action);
  return null;
}

/** Props for `DragOverlay`. */
export interface DragOverlayProps {
  drag: DragState | null;
}

/** The ghost for `drag`, or nothing when no drag is live. */
export function DragOverlay({ drag }: DragOverlayProps) {
  if (!drag) return null;
  return <DragGhost item={drag.item} screenPos={drag.screenPos} from={drag.from} />;
}
