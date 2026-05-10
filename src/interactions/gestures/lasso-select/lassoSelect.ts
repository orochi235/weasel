import { useMemo, useRef, useState } from 'react';
import type { Op } from 'core/ops/types';
import type { LassoSelectAdapter } from 'core/adapters/types';
import type {
  GestureContext,
  LassoSelectBehavior,
  LassoSelectOverlay,
  LassoSelectPose,
  ModifierState,
} from '../types';
import type { DebugSink } from '../../../debug/types';

const GID = 'gesture';
const SCRATCH_KEY = 'lassoSelect.vertices';

/** Options for `useLassoSelect`. */
export interface UseLassoSelectOptions {
  behaviors?: LassoSelectBehavior[];
  /** When set, overrides any behavior's `defaultTransient`. */
  transient?: boolean;
  /** Label used when transient is false and the hook falls back to applyBatch. Default 'Lasso select'. */
  label?: string;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Skip vertices closer than this many world-px to the previous one.
   *  Default 2. Set 0 to record every move sample. */
  minVertexSpacing?: number;
  /** Optional debug sink; receives the live polygon AABB on every move. */
  debug?: DebugSink;
}

export interface LassoSelectController {
  start(worldX: number, worldY: number, modifiers: ModifierState): void;
  move(worldX: number, worldY: number, modifiers: ModifierState): boolean;
  end(): void;
  cancel(): void;
  isLassoSelecting: boolean;
  overlay: LassoSelectOverlay | null;
  adapter: LassoSelectAdapter;
}

interface State {
  vertices: { x: number; y: number }[];
  startPose: LassoSelectPose;
  modifiers: ModifierState;
  current: { worldX: number; worldY: number };
}

export function useLassoSelect(
  adapter: LassoSelectAdapter,
  options: UseLassoSelectOptions = {},
): LassoSelectController {
  const optsRef = useRef(options);
  optsRef.current = options;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const stateRef = useRef<State | null>(null);
  const [, bump] = useState(0);
  const force = (): void => bump((n) => n + 1);

  const buildGestureCtx = (s: State): GestureContext<LassoSelectPose> => ({
    draggedIds: [GID],
    origin: new Map([[GID, s.startPose]]),
    current: new Map([[GID, { worldX: s.current.worldX, worldY: s.current.worldY, shiftHeld: s.startPose.shiftHeld }]]),
    snap: null,
    modifiers: s.modifiers,
    pointer: { worldX: s.current.worldX, worldY: s.current.worldY, clientX: 0, clientY: 0 },
    adapter: adapterRef.current as unknown as GestureContext<LassoSelectPose>['adapter'],
    scratch: { [SCRATCH_KEY]: s.vertices },
  });

  const start = (worldX: number, worldY: number, modifiers: ModifierState): void => {
    const startPose: LassoSelectPose = { worldX, worldY, shiftHeld: modifiers.shift };
    stateRef.current = {
      vertices: [{ x: worldX, y: worldY }],
      startPose,
      modifiers,
      current: { worldX, worldY },
    };
    optsRef.current.onGestureStart?.();
    const ctx = buildGestureCtx(stateRef.current);
    for (const b of optsRef.current.behaviors ?? []) b.onStart?.(ctx);
    force();
  };

  const move = (worldX: number, worldY: number, modifiers: ModifierState): boolean => {
    const s = stateRef.current;
    if (!s) return false;
    s.modifiers = modifiers;
    s.current = { worldX, worldY };
    const minSpacing = optsRef.current.minVertexSpacing ?? 2;
    const last = s.vertices[s.vertices.length - 1];
    const dx = worldX - last.x;
    const dy = worldY - last.y;
    if (minSpacing === 0 || dx * dx + dy * dy >= minSpacing * minSpacing) {
      s.vertices.push({ x: worldX, y: worldY });
    }
    const ctx = buildGestureCtx(s);
    for (const b of optsRef.current.behaviors ?? []) {
      b.onMove?.(ctx, { vertices: s.vertices, shiftHeld: s.startPose.shiftHeld });
    }
    if (optsRef.current.debug && s.vertices.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const v of s.vertices) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
      }
      optsRef.current.debug.recordBounds('lasso-select', { x: minX, y: minY, width: maxX - minX, height: maxY - minY });
    }
    force();
    return true;
  };

  const end = (): void => {
    const s = stateRef.current;
    if (!s) return;
    const ctx = buildGestureCtx(s);
    let collected: Op[] | null | undefined;
    for (const b of optsRef.current.behaviors ?? []) {
      const r = b.onEnd?.(ctx);
      if (r === undefined) continue;
      collected = r;
      break;
    }
    let committed = false;
    if (collected != null && collected.length > 0) {
      const transient =
        optsRef.current.transient ?? (optsRef.current.behaviors ?? []).some((b) => b.defaultTransient === true);
      if (transient) {
        adapterRef.current.applyOps?.(collected);
      } else {
        const a = adapterRef.current as LassoSelectAdapter & { applyBatch?: (ops: Op[], label: string) => void };
        a.applyBatch?.(collected, optsRef.current.label ?? 'Lasso select');
      }
      committed = true;
    }
    stateRef.current = null;
    optsRef.current.onGestureEnd?.(committed);
    force();
  };

  const cancel = (): void => {
    if (!stateRef.current) return;
    stateRef.current = null;
    optsRef.current.onGestureEnd?.(false);
    force();
  };

  return useMemo<LassoSelectController>(
    () => ({
      start,
      move,
      end,
      cancel,
      get isLassoSelecting() { return stateRef.current !== null; },
      get overlay() {
        return stateRef.current
          ? {
              vertices: stateRef.current.vertices,
              current: stateRef.current.current,
              shiftHeld: stateRef.current.startPose.shiftHeld,
            }
          : null;
      },
      get adapter() { return adapterRef.current; },
    }),
    [],
  );
}
