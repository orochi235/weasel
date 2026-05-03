import { useCallback, useMemo, useRef, useState } from 'react';
import type { Op } from '../../../core/ops/types';
import type { AreaSelectAdapter } from '../../../core/adapters/types';
import type {
  AreaSelectBehavior,
  AreaSelectOverlay,
  AreaSelectPose,
  GestureContext,
  ModifierState,
} from '../types';

const GID = 'gesture';

/** Options for `useAreaSelect`. */
export interface UseAreaSelectOptions {
  behaviors?: AreaSelectBehavior[];
  /** When set, overrides any behavior's `defaultTransient`. Default: behaviors decide. */
  transient?: boolean;
  /** Label used when transient is false and the hook falls back to applyBatch. Default 'Area select'. */
  label?: string;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
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

interface State {
  active: boolean;
  ctx: GestureContext<AreaSelectPose> | null;
}

/** Drag-rectangle area-select interaction; behaviors decide replace-vs-add semantics from modifiers. */
export function useAreaSelect(
  adapter: AreaSelectAdapter,
  options: UseAreaSelectOptions = {},
): AreaSelectController {
  const { behaviors = [], transient: transientOpt, label = 'Area select', onGestureStart, onGestureEnd } = options;
  const behaviorsRef = useRef(behaviors);
  behaviorsRef.current = behaviors;
  // Latest-value refs so controller methods stay referentially stable.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const labelRef = useRef(label);
  labelRef.current = label;
  const transientOptRef = useRef(transientOpt);
  transientOptRef.current = transientOpt;
  const onGestureStartRef = useRef(onGestureStart);
  onGestureStartRef.current = onGestureStart;
  const onGestureEndRef = useRef(onGestureEnd);
  onGestureEndRef.current = onGestureEnd;

  const stateRef = useRef<State>({ active: false, ctx: null });
  const [overlay, setOverlay] = useState<AreaSelectOverlay | null>(null);

  const cleanup = useCallback(() => {
    stateRef.current.active = false;
    stateRef.current.ctx = null;
    setOverlay(null);
  }, []);

  const start = useCallback((worldX: number, worldY: number, modifiers: ModifierState) => {
    const adapter = adapterRef.current;
    const startPose: AreaSelectPose = { worldX, worldY, shiftHeld: modifiers.shift };
    const ctx: GestureContext<AreaSelectPose> = {
      draggedIds: [GID],
      origin: new Map([[GID, startPose]]),
      current: new Map([[GID, startPose]]),
      snap: null,
      modifiers,
      pointer: { worldX, worldY, clientX: 0, clientY: 0 },
      adapter: adapter as unknown as GestureContext<AreaSelectPose>['adapter'],
      scratch: {},
    };
    for (const b of behaviorsRef.current) b.onStart?.(ctx);
    stateRef.current = { active: true, ctx };
    onGestureStartRef.current?.();
    setOverlay({
      start: { worldX, worldY },
      current: { worldX, worldY },
      shiftHeld: modifiers.shift,
    });
  }, []);

  const move = useCallback((worldX: number, worldY: number, modifiers: ModifierState): boolean => {
    const s = stateRef.current;
    if (!s.active || !s.ctx) return false;
    const ctx = s.ctx;
    ctx.modifiers = modifiers;
    ctx.pointer = { worldX, worldY, clientX: 0, clientY: 0 };
    const start = ctx.origin.get(GID)!;
    const current: AreaSelectPose = { worldX, worldY, shiftHeld: start.shiftHeld };
    ctx.current.set(GID, current);
    for (const b of behaviorsRef.current) {
      b.onMove?.(ctx, {
        start: { worldX: start.worldX, worldY: start.worldY },
        current: { worldX, worldY },
        shiftHeld: start.shiftHeld,
      });
    }
    setOverlay({
      start: { worldX: start.worldX, worldY: start.worldY },
      current: { worldX, worldY },
      shiftHeld: start.shiftHeld,
    });
    return true;
  }, []);

  const end = useCallback(() => {
    const s = stateRef.current;
    const adapter = adapterRef.current;
    const label = labelRef.current;
    const transientOpt = transientOptRef.current;
    const onGestureEnd = onGestureEndRef.current;
    if (!s.active || !s.ctx) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    const ctx = s.ctx;
    let collected: Op[] | null | undefined;
    for (const b of behaviorsRef.current) {
      const r = b.onEnd?.(ctx);
      if (r === undefined) continue;
      collected = r;
      break;
    }
    if (collected === null) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }
    if (collected === undefined || collected.length === 0) {
      cleanup();
      onGestureEnd?.(false);
      return;
    }

    const transient = transientOpt ?? behaviorsRef.current.some((b) => b.defaultTransient === true);

    if (transient) {
      (adapter as AreaSelectAdapter).applyOps(collected);
    } else {
      const adapterWithBatch = adapter as AreaSelectAdapter & {
        applyBatch?: (ops: Op[], label: string) => void;
      };
      adapterWithBatch.applyBatch?.(collected, label);
    }
    cleanup();
    onGestureEnd?.(true);
  }, [cleanup]);

  const cancel = useCallback(() => {
    cleanup();
    onGestureEndRef.current?.(false);
  }, [cleanup]);

  // Stable controller identity — see useMove for rationale.
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const controller = useMemo<AreaSelectController>(() => ({
    start, move, end, cancel,
    get overlay() { return overlayRef.current; },
    get isAreaSelecting() { return overlayRef.current !== null; },
    get adapter() { return adapterRef.current; },
  }), [start, move, end, cancel]);
  return controller;
}
