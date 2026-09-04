import { useCallback, useMemo, useRef, useState } from 'react';
import { defineTool } from '../../defineTool';
import { StarIcon } from '../../../icons';
import type { Tool } from '../../types';
import type { Action } from 'interactions/actions/registry';
import { cursorFor } from '@weasel-js/cursor';

/** A point in world coordinates. */
export interface StarPoint { x: number; y: number }

/** Options for `useStarTool`. */
export interface UseStarToolOptions {
  label?: string;
  /** Initial point count. Persists across gestures (Illustrator
   *  convention), adjustable mid-drag via ArrowUp/Down or wheel
   *  (range 3–32). */
  points?: number;
  /** Inner-radius / outer-radius ratio. Default 0.5. Fixed for now;
   *  consumers wanting per-instance ratios should override the `insert`
   *  dep. */
  innerRatio?: number;
}

const MIN_POINTS = 3;
const MAX_POINTS = 32;

/**
 * Drag-from-center star tool. Pointerdown sets center; drag determines
 * outer radius + rotation; release commits via `insertAction`. Inner
 * radius = outer × `innerRatio` (default 0.5). Point count defaults to
 * 5, adjustable mid-gesture via ArrowUp/Down or wheel.
 *
 * Live preview painted by the dispatcher overlay layer reading
 * `insertAction.overlay()`. Consumers wanting custom star geometry
 * override the `insert` dep.
 */
export function useStarTool<TNode extends { id: string } = { id: string }>(
  options: UseStarToolOptions = {},
): Tool<null> {
  const {
    points: initialPoints = 5,
    innerRatio: initialInnerRatio = 0.5,
  } = options;
  const pointsRef = useRef(initialPoints);
  const innerRatioRef = useRef(initialInnerRatio);
  const [, setPointsTick] = useState(0);
  const bumpPoints = useCallback(() => setPointsTick((n) => n + 1), []);

  // Wheel-to-adjust-points action. Phase-gated to `[engaged]` so it
  // fires only mid-drag.
  const adjustPointsAction = useMemo<Action>(
    () => ({
      id: 'star.adjustPoints',
      label: 'Star — adjust points',
      invoker: {
        timing: 'immediate' as const,
        run: (_deps, params) => {
          const p = params as { deltaY?: number; delta?: number } | undefined;
          // `delta` comes from the ArrowUp/ArrowDown key bindings; `deltaY`
          // from the wheel. Wheel up (deltaY > 0 under natural scrolling)
          // adds a point.
          const step = p?.delta ?? (p?.deltaY !== undefined && p.deltaY !== 0
            ? (p.deltaY > 0 ? 1 : -1)
            : 0);
          if (step === 0) return;
          pointsRef.current = step > 0
            ? Math.min(MAX_POINTS, pointsRef.current + 1)
            : Math.max(MIN_POINTS, pointsRef.current - 1);
          bumpPoints();
        },
      },
    }),
    [bumpPoints],
  );

  void ({} as TNode);

  return useMemo(
    () =>
      defineTool<null>({
        id: 'star',
        capabilities: ['creates-shapes'],
        hookName: 'useStarTool',
        cursor: cursorFor('crosshairStar', { fallback: 'crosshair' }),
        // Registered by <ToolActionsMounter>, inside the ActionsProvider —
        // see `ToolDef.actions` for why the hook can't register it itself.
        actions: [adjustPointsAction],
        presentation: {
          label: 'Star',
          group: 'shape',
          icon: <StarIcon />,
        },
        bindings: [
          // Default = drag from corner; anchor dot in the overlay sells
          // the click point. Alt flips to center mode (live toggle).
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            opts: {
              params: () => ({
                kind: 'star',
                points: pointsRef.current,
                innerRadiusRatio: innerRatioRef.current,
              }),
            },
          },
          {
            spec: { kind: 'wheel', phase: 'engaged' },
            actionId: 'star.adjustPoints',
          },
          {
            spec: { kind: 'wheel', phase: 'engaged', mods: { shift: true } },
            actionId: 'insert.adjustRotation',
          },
          // ArrowUp/Down → adjust point count. Ported off the phase table for
          // the same reason as polygon's: as an `initial.keyDown` route the
          // key was claimed on the tool pipeline while `nudge.*` matched the
          // same press on the interactions dispatcher, so both fired.
          {
            spec: { kind: 'key', key: 'ArrowUp' },
            actionId: 'star.adjustPoints',
            opts: { params: { delta: 1 } },
          },
          {
            spec: { kind: 'key', key: 'ArrowDown' },
            actionId: 'star.adjustPoints',
            opts: { params: { delta: -1 } },
          },
        ],
      }),
    [adjustPointsAction],
  );
}
