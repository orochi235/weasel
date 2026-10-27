import { useCallback, useMemo, useRef, useState } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { INSERT_REPOSITION_BINDING } from 'interactions/actions/insert/repositionAction';
import { SHAPE_COUNT_RANGE } from 'domains/paths/shapeGenerator';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import type { Action, WorldPoint } from '@weasel-js/routing';
import { useLatest } from '@weasel-js/react';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';

/** A point in world coordinates. */
export type StarPoint = WorldPoint;

/** Options for `useStarTool`. */
export interface UseStarToolOptions extends InsertToolOptions {
  label?: string;
  /** Initial point count. Persists across gestures (Illustrator
   *  convention), adjustable mid-drag via ArrowUp/Down or wheel
   *  (range 3–32). */
  points?: number;
  /** Inner-radius / outer-radius ratio. Default 0.5. Consumers wanting
   *  per-instance ratios should override the `insert` dep. */
  innerRatio?: number;
}

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
): Tool {
  const {
    points: initialPoints = 5,
    innerRatio = 0.5,
    label = 'Star',
    behaviors,
  } = options;
  const pointsRef = useRef(initialPoints);
  const innerRatioRef = useLatest(innerRatio);
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
            ? Math.min(SHAPE_COUNT_RANGE.max, pointsRef.current + 1)
            : Math.max(SHAPE_COUNT_RANGE.min, pointsRef.current - 1);
          bumpPoints();
        },
      },
    }),
    [bumpPoints],
  );

  void ({} as TNode);

  return useMemo(
    () =>
      defineTool({
        id: 'star',
        capabilities: ['creates-shapes'],
        hookName: 'useStarTool',
        cursor: cursorFor('crosshairStar', { fallback: 'crosshair' }),
        // Registered by <ToolActionsMounter>, inside the ActionsProvider —
        // see `ToolDef.actions` for why the hook can't register it itself.
        actions: [adjustPointsAction],
        presentation: {
          label,
          group: 'shape',
          icon: icon('star'),
        },
        bindings: [
          // Default = drag from corner; anchor dot in the overlay sells
          // the click point. Alt flips to center mode (live toggle).
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            opts: {
              id: 'star.drag',
              params: () => ({
                kind: 'star',
                points: pointsRef.current,
                innerRadiusRatio: innerRatioRef.current,
              }),
              ...insertBindingBehaviors(behaviors),
            },
          },
          INSERT_REPOSITION_BINDING,
          {
            spec: { kind: 'wheel', phase: 'engaged' },
            actionId: 'star.adjustPoints',
            opts: { id: 'star.wheelPoints' },
          },
          {
            spec: { kind: 'wheel', phase: 'engaged', mods: { shift: true } },
            actionId: 'insert.adjustRotation',
            opts: { id: 'star.wheelRotation' },
          },
          // ArrowUp/Down → adjust point count. Ported off the phase table for
          // the same reason as polygon's: as an `initial.keyDown` route the
          // key was claimed on the tool pipeline while `nudge.*` matched the
          // same press on the interactions dispatcher, so both fired.
          {
            spec: { kind: 'key', key: 'ArrowUp' },
            actionId: 'star.adjustPoints',
            opts: { id: 'star.morePoints', params: { delta: 1 } },
          },
          {
            spec: { kind: 'key', key: 'ArrowDown' },
            actionId: 'star.adjustPoints',
            opts: { id: 'star.fewerPoints', params: { delta: -1 } },
          },
        ],
      }),
    [adjustPointsAction, behaviors, label, innerRatioRef],
  );
}
