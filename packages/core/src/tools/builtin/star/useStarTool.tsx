import { useCallback, useMemo, useState } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { INSERT_REPOSITION_BINDING } from 'interactions/actions/insert/repositionAction';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import { shareToolOptions, withToolOptionDefault, type Action, type WorldPoint } from '@weasel-js/routing';
import { STAR_INSERT_PARAMS } from 'interactions/actions/insert/params';
import { DEFAULT_SHAPE_PAINT, shapeToolOptions } from '../shared/styleOptions';
import { stepCountOption } from '../shared/countOption';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';
import { INSERT_DRAG_MODS } from 'interactions/actions/insert/action';

/** A point in world coordinates. */
export type StarPoint = WorldPoint;

/** Options for `useStarTool`. */
export interface UseStarToolOptions extends InsertToolOptions {
  label?: string;
  /** The point count before its user changes it, the `points` option's
   *  default. Persists across gestures (Illustrator convention), adjustable
   *  mid-drag via ArrowUp/Down or wheel (range 3–32). */
  points?: number;
  /** The inner-radius / outer-radius ratio before its user changes it, the
   *  `innerRadiusRatio` option's default. Default 0.5. */
  innerRatio?: number;
}

/** The star tool's options: the style it draws with, shared with every shape tool, and its points and inner radius. */
export const STAR_TOOL_OPTIONS = shapeToolOptions({
  actionId: 'insert', name: 'Star', keys: ['fill', 'stroke', 'strokeWidth', 'fillRule'],
  style: { fill: DEFAULT_SHAPE_PAINT, stroke: null }, own: STAR_INSERT_PARAMS.children,
});

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
  const { points, innerRatio, label = 'Star', behaviors, share } = options;
  const toolOptions = useMemo(
    () => withToolOptionDefault(withToolOptionDefault(shareToolOptions(STAR_TOOL_OPTIONS, share), 'points', points),
      'innerRadiusRatio', innerRatio),
    [share, points, innerRatio],
  );
  const [, setPointsTick] = useState(0);
  const bumpPoints = useCallback(() => setPointsTick((n) => n + 1), []);

  // Wheel-to-adjust-points action. Phase-gated to `[engaged]` so it
  // fires only mid-drag.
  const adjustPointsAction = useMemo<Action>(
    () => ({
      id: 'star.adjustPoints',
      label: 'Star — adjust points',
      requires: ['toolOptionValues'],
      invoker: {
        timing: 'immediate' as const,
        run: (deps, params) => {
          if (stepCountOption('star', toolOptions, 'points', deps.toolOptionValues, params)) bumpPoints();
        },
      },
    }),
    [bumpPoints, toolOptions],
  );

  void ({} as TNode);

  return useMemo(
    () =>
      defineTool({
        id: 'star',
        capabilities: ['creates-shapes'],
        hookName: 'useStarTool',
        options: toolOptions,
        cursor: cursorFor('crosshair', { mark: 'star', fallback: 'crosshair' }),
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
            spec: { kind: 'drag', mods: INSERT_DRAG_MODS },
            actionId: 'insert',
            opts: { id: 'star.drag', params: { kind: 'star' }, ...insertBindingBehaviors(behaviors) },
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
    [adjustPointsAction, behaviors, label, toolOptions],
  );
}
