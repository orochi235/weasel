import { useCallback, useEffect, useRef } from 'react';
import { createTransformOp } from '../../../core/ops/transform';
import type { Op } from '../../../core/ops/types';
import { dispatchApplyBatch } from '../../../core/applyOps';
import { translateRectPose } from '../../../features/groups/composePose';
import type { NodeId } from '../../../core/scene/types';
import { useKeybinding } from '../useKeybinding';
import { useActionsRegistry } from '../registry';
import { defaultNudgeActions } from '../defaults/nudge';

/** Cardinal direction for `useNudge`. */
export type NudgeDirection = 'up' | 'down' | 'left' | 'right';

/** Adapter for `useNudge`. */
export interface NudgeAdapter<TPose> {
  /** Read current selection. */
  getSelection(): NodeId[];
  /** Read pose for an id; used as `from` for the transform op. */
  getPose(id: NodeId): TPose;
  /** Optional: op-batch entry point. When omitted, the hook applies each op
   *  against the adapter directly. */
  applyBatch?(ops: Op[], label?: string): void;
}

/** Options for `useNudge`. */
export interface UseNudgeOptions<TPose> {
  /** How to apply a `(dx, dy)` translation to a pose. Defaults to
   *  `translateRectPose`, which assumes the pose carries top-level
   *  `x`/`y` (the common rect-shaped case). Override for non-rect poses. */
  translatePose?: (pose: TPose, dx: number, dy: number) => TPose;
  /** Auto-bind arrow keys on document. Default true. */
  enableKeyboard?: boolean;
  /** Label passed to applyBatch. Default 'Nudge'. */
  label?: string;
  /** Base step in world units. Default 1. */
  step?: number;
  /** Step used when shift held. Default 10. */
  shiftStep?: number;
}

/** Return shape of `useNudge`. */
export interface UseNudgeReturn {
  /** Imperative trigger. `large=true` uses `shiftStep`. */
  nudge(direction: NudgeDirection, large?: boolean): void;
}

function deltaFor(direction: NudgeDirection, step: number): { dx: number; dy: number } {
  switch (direction) {
    case 'left':  return { dx: -step, dy: 0 };
    case 'right': return { dx:  step, dy: 0 };
    case 'up':    return { dx: 0, dy: -step };
    case 'down':  return { dx: 0, dy:  step };
  }
}

const ARROW_TO_DIR: Record<string, NudgeDirection> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/** Arrow-key nudge action; binds arrow keys (with optional shift modifier for larger step) by default. */
export function useNudge<TPose>(
  adapter: NudgeAdapter<TPose>,
  options: UseNudgeOptions<TPose> = {},
): UseNudgeReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const nudge = useCallback((direction: NudgeDirection, large = false): void => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    if (sel.length === 0) return;
    const step = large ? (o.shiftStep ?? 10) : (o.step ?? 1);
    const { dx, dy } = deltaFor(direction, step);
    const translate =
      o.translatePose ??
      (translateRectPose as unknown as (pose: TPose, dx: number, dy: number) => TPose);
    const ops: Op[] = sel.map((id) => {
      const from = a.getPose(id);
      const to = translate(from, dx, dy);
      return createTransformOp<TPose>({ id, from, to });
    });
    dispatchApplyBatch(a, ops, o.label ?? 'Nudge');
  }, []);

  const reg = useActionsRegistry();
  const enableKeyboard = options.enableKeyboard ?? true;

  useEffect(() => {
    if (!reg || !enableKeyboard) return;
    const a = adapterRef.current;
    const o = optsRef.current;
    const actions = defaultNudgeActions<TPose>({
      getSelection: () => a.getSelection(),
      getPose: (id) => a.getPose(id),
      translatePose:
        o.translatePose ??
        (translateRectPose as unknown as (pose: TPose, dx: number, dy: number) => TPose),
      applyBatch: (ops, label) => dispatchApplyBatch(a, ops, label ?? 'Nudge'),
      ...(o.step !== undefined ? { step: o.step } : {}),
      ...(o.shiftStep !== undefined ? { shiftStep: o.shiftStep } : {}),
    });
    const unregs = actions.map((act) => reg.register(act));
    return () => { for (const u of unregs) u(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reg, enableKeyboard]);

  useKeybinding(
    {
      key: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
      shift: 'optional',
      enabled: enableKeyboard && reg == null,
    },
    (e) => {
      const dir = ARROW_TO_DIR[e.key];
      if (dir) nudge(dir, e.shiftKey);
    },
  );

  return { nudge };
}
