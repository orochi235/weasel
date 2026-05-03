import { useCallback, useRef } from 'react';
import { createTransformOp } from '../../../../core/ops/transform';
import type { Op } from '../../../../core/ops/types';
import { useKeybinding } from '../useKeybinding';

/** Cardinal direction for `useNudge`. */
export type NudgeDirection = 'up' | 'down' | 'left' | 'right';

/** Adapter for `useNudge`. */
export interface NudgeAdapter<TPose> {
  /** Read current selection. */
  getSelection(): string[];
  /** Read pose for an id; used as `from` for the transform op. */
  getPose(id: string): TPose;
  /** Required: standard op-batch entry point. */
  applyBatch(ops: Op[], label?: string): void;
}

/** Options for `useNudge`. */
export interface UseNudgeOptions<TPose> {
  /** Required: pure pose translator — same shape as in move. */
  translatePose: (pose: TPose, dx: number, dy: number) => TPose;
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
  options: UseNudgeOptions<TPose>,
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
    const ops: Op[] = sel.map((id) => {
      const from = a.getPose(id);
      const to = o.translatePose(from, dx, dy);
      return createTransformOp<TPose>({ id, from, to });
    });
    a.applyBatch(ops, o.label ?? 'Nudge');
  }, []);

  useKeybinding(
    {
      key: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'],
      shift: 'optional',
      enabled: options.enableKeyboard ?? true,
    },
    (e) => {
      const dir = ARROW_TO_DIR[e.key];
      if (dir) nudge(dir, e.shiftKey);
    },
  );

  return { nudge };
}
