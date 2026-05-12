import { useMemo, useRef } from 'react';
import type { Op } from 'core/ops/types';
import type { AreaSelectAdapter } from 'core/adapters/types';
import type {
  AreaSelectBehavior,
  AreaSelectOverlay,
  AreaSelectPose,
  GestureContext,
  ModifierState,
} from '../types';
import type { DebugSink } from '../../../debug/types';
import { useDragRect, type DragRectCtx } from '../dragRect';

const GID = 'gesture';

/** Options for `useAreaSelect`. */
export interface UseAreaSelectOptions {
  behaviors?: AreaSelectBehavior[];
  /** When set, overrides any behavior's `defaultTransient`. Default: behaviors decide. */
  transient?: boolean;
  /** Label used when transient is false and the hook falls back to applyOps. Default 'Area select'. */
  label?: string;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Optional debug sink. When supplied, records the in-progress marquee
   *  rectangle as a `bounds` entry under the synthetic id `'area-select'`
   *  on every move. Tree-shakes via optional-chain when omitted. */
  debug?: DebugSink;
}

/** Return shape of `useAreaSelect`: lifecycle methods and live marquee overlay. */
export interface AreaSelectController {
  start(worldX: number, worldY: number, modifiers: ModifierState): void;
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  isAreaSelecting: boolean;
  overlay: AreaSelectOverlay | null;
  /** The adapter passed in. Exposed so `<Canvas>` can derive defaults. */
  adapter: AreaSelectAdapter;
}

interface AreaScratch {
  startPose: AreaSelectPose;
}

/** Drag-rectangle area-select interaction; behaviors decide replace-vs-add semantics from modifiers. */
export function useAreaSelect(
  adapter: AreaSelectAdapter,
  options: UseAreaSelectOptions = {},
): AreaSelectController {
  const {
    behaviors = [],
    transient: transientOpt,
    label = 'Area select',
    onGestureStart,
    onGestureEnd,
    debug,
  } = options;

  const behaviorsRef = useRef(behaviors);
  behaviorsRef.current = behaviors;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const labelRef = useRef(label);
  labelRef.current = label;
  const transientOptRef = useRef(transientOpt);
  transientOptRef.current = transientOpt;
  const debugRef = useRef(debug);
  debugRef.current = debug;

  // Holds the start-time shift state for the overlay getter — preserves
  // today's behavior of reporting the shift state captured at gesture start
  // rather than the live modifier value.
  const dragShiftHeldRef = useRef<boolean>(false);

  const buildGestureCtx = (
    drCtx: DragRectCtx<AreaScratch>,
    startPose: AreaSelectPose,
  ): GestureContext<AreaSelectPose> => ({
    draggedIds: [GID],
    origin: new Map([[GID, startPose]]),
    current: new Map([[
      GID,
      {
        worldX: drCtx.current.x,
        worldY: drCtx.current.y,
        shiftHeld: startPose.shiftHeld,
      },
    ]]),
    snap: null,
    modifiers: drCtx.modifiers,
    pointer: { worldX: drCtx.current.x, worldY: drCtx.current.y, clientX: 0, clientY: 0 },
    adapter: adapterRef.current as unknown as GestureContext<AreaSelectPose>['adapter'],
    scratch: {},
  });

  const dr = useDragRect<AreaScratch>({
    initScratch: () => ({ startPose: { worldX: 0, worldY: 0, shiftHeld: false } }),
    onStart: (ctx) => {
      const startPose: AreaSelectPose = {
        worldX: ctx.start.x,
        worldY: ctx.start.y,
        shiftHeld: ctx.modifiers.shift,
      };
      ctx.scratch.startPose = startPose;
      dragShiftHeldRef.current = startPose.shiftHeld;
      const gctx = buildGestureCtx(ctx, startPose);
      for (const b of behaviorsRef.current) b.onStart?.(gctx);
    },
    onMove: (ctx) => {
      const startPose = ctx.scratch.startPose;
      const gctx = buildGestureCtx(ctx, startPose);
      for (const b of behaviorsRef.current) {
        b.onMove?.(gctx, {
          start: { worldX: startPose.worldX, worldY: startPose.worldY },
          current: { worldX: ctx.current.x, worldY: ctx.current.y },
          shiftHeld: startPose.shiftHeld,
        });
      }
      debugRef.current?.recordBounds('area-select', ctx.bounds);
    },
    onEnd: (ctx) => {
      const adapter = adapterRef.current;
      const label = labelRef.current;
      const transientOpt = transientOptRef.current;
      const startPose = ctx.scratch.startPose;
      const gctx = buildGestureCtx(ctx, startPose);
      let collected: Op[] | null | undefined;
      for (const b of behaviorsRef.current) {
        const r = b.onEnd?.(gctx);
        if (r === undefined) continue;
        collected = r;
        break;
      }
      dragShiftHeldRef.current = false;
      if (collected === null) return false;
      if (collected === undefined || collected.length === 0) return false;
      const transient =
        transientOpt ?? behaviorsRef.current.some((b) => b.defaultTransient === true);
      if (transient) {
        (adapter as AreaSelectAdapter).applyOps?.(collected);
      } else {
        const adapterWithBatch = adapter as AreaSelectAdapter & {
          applyOps?: (ops: Op[], label: string) => void;
        };
        adapterWithBatch.applyOps?.(collected, label);
      }
      return true;
    },
    onCancel: () => {
      dragShiftHeldRef.current = false;
    },
    onGestureStart,
    onGestureEnd,
  });

  const overlayRef = useRef<AreaSelectOverlay | null>(null);
  overlayRef.current = dr.overlay
    ? {
        start: { worldX: dr.overlay.start.x, worldY: dr.overlay.start.y },
        current: { worldX: dr.overlay.current.x, worldY: dr.overlay.current.y },
        shiftHeld: dragShiftHeldRef.current,
      }
    : null;

  return useMemo<AreaSelectController>(
    () => ({
      start: dr.start,
      move: dr.move,
      end: dr.end,
      cancel: dr.cancel,
      get overlay() {
        return overlayRef.current;
      },
      get isAreaSelecting() {
        return overlayRef.current !== null;
      },
      get adapter() {
        return adapterRef.current;
      },
    }),
    [dr.start, dr.move, dr.end, dr.cancel],
  );
}
