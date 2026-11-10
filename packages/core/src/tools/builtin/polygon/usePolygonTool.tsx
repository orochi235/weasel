import { useCallback, useMemo, useState } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { INSERT_REPOSITION_BINDING } from 'interactions/actions/insert/repositionAction';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import { shareToolOptions, withToolOptionDefault, type Action, type WorldPoint } from '@weasel-js/routing';
import { POLYGON_INSERT_PARAMS } from 'interactions/actions/insert/params';
import { DEFAULT_SHAPE_PAINT, shapeToolOptions } from '../shared/styleOptions';
import { stepCountOption } from '../shared/countOption';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';
import { INSERT_DRAG_MODS } from 'interactions/actions/insert/action';

/** A point in world coordinates. */
export type PolygonPoint = WorldPoint;

/** Options for `usePolygonTool`. */
export interface UsePolygonToolOptions extends InsertToolOptions {
  label?: string;
  /** The side count before its user changes it, the `sides` option's
   *  default. It persists across gestures (Illustrator convention) and is
   *  adjustable mid-drag via ArrowUp/Down or wheel (range 3–32). */
  sides?: number;
}

/** The polygon tool's options: the style it draws with, shared with every shape tool, and its side count. */
export const POLYGON_TOOL_OPTIONS = shapeToolOptions({
  actionId: 'insert', name: 'Polygon', keys: ['fill', 'stroke', 'strokeWidth', 'fillRule'],
  style: { fill: DEFAULT_SHAPE_PAINT, stroke: null }, own: POLYGON_INSERT_PARAMS.children,
});

/**
 * Drag-from-center polygon tool. Pointerdown sets center; drag
 * determines radius + rotation; release commits via `insertAction` (the
 * kit's standard insert dep, sourced by `<SceneCanvas>`). Side count
 * defaults to 6, adjustable mid-gesture via ArrowUp/Down or wheel.
 *
 * The live preview is painted by the dispatcher overlay layer reading
 * `insertAction.overlay()` — the action returns `{ kind:'insertPreview',
 * shape:'polygon', bounds, extras: { sides, ... } }`. Consumers wanting
 * a custom polygon node shape override the `insert` dep.
 */
export function usePolygonTool<TNode extends { id: string } = { id: string }>(
  options: UsePolygonToolOptions = {},
): Tool {
  const { sides, label = 'Polygon', behaviors, share } = options;
  const toolOptions = useMemo(
    () => withToolOptionDefault(shareToolOptions(POLYGON_TOOL_OPTIONS, share), 'sides', sides),
    [share, sides],
  );
  // A tick forces a render so the dispatcher overlay layer repaints when the
  // count changes between pointer events.
  const [, setSidesTick] = useState(0);
  const bumpSides = useCallback(() => setSidesTick((n) => n + 1), []);

  // Wheel-to-adjust-sides action. Bound to `[engaged] wheel` so it only
  // fires while a polygon insert drag is in flight — outside that window
  // wheel falls through to ambient viewport.pan/zoom. `delta` comes from the
  // ArrowUp/ArrowDown key bindings; `deltaY` from the wheel, where up (deltaY
  // > 0 under natural scrolling) adds a side.
  const adjustSidesAction = useMemo<Action>(
    () => ({
      id: 'polygon.adjustSides',
      label: 'Polygon — adjust sides',
      requires: ['toolOptionValues'],
      invoker: {
        timing: 'immediate' as const,
        run: (deps, params) => {
          if (stepCountOption('polygon', toolOptions, 'sides', deps.toolOptionValues, params)) bumpSides();
        },
      },
    }),
    [bumpSides, toolOptions],
  );

  // `TNode` is retained for source-compat with callers that previously
  // threaded a node-record type through; the tool no longer mints nodes
  // (insertAction does), so the parameter has no runtime effect.
  void ({} as TNode);

  return useMemo(
    () =>
      defineTool({
        id: 'polygon',
        keybinding: { key: 'G' },
        capabilities: ['creates-shapes'],
        hookName: 'usePolygonTool',
        options: toolOptions,
        cursor: cursorFor('crosshair', { mark: 'polygon', fallback: 'crosshair' }),
        // Registered by <ToolActionsMounter>, inside the ActionsProvider —
        // see `ToolDef.actions` for why the hook can't register it itself.
        actions: [adjustSidesAction],
        presentation: {
          label,
          group: 'shape',
          icon: icon('polygon'),
        },
        bindings: [
          // Default = drag from corner, consistent with rect/ellipse.
          // The dispatcher overlay paints an anchorPoint dot at the
          // click so the radial shape reads as anchored even though no
          // polygon vertex sits at the AABB corner. Alt held flips to
          // center mode (insertAction reads live modifier state).
          {
            spec: { kind: 'drag', mods: INSERT_DRAG_MODS },
            actionId: 'insert',
            // The side count reaches the insert from the tool's options,
            // read at commit time and on every overlay() call for the live
            // preview, so a mid-gesture change flows through both the ghost
            // and the committed geometry.
            opts: { id: 'polygon.drag', params: { kind: 'polygon' }, ...insertBindingBehaviors(behaviors) },
          },
          INSERT_REPOSITION_BINDING,
          // Wheel-during-drag → adjust side count. Phase-gated to
          // `engaged` so wheel while the tool is idle still falls
          // through to ambient viewport.pan / viewport.zoom.
          { spec: { kind: 'wheel', phase: 'engaged' }, actionId: 'polygon.adjustSides', opts: { id: 'polygon.wheelSides' } },
          // Shift+wheel during engaged drag → rotate the in-flight
          // shape in place. Strict modifier matching means this
          // doesn't conflict with the unmodified wheel binding above.
          {
            spec: { kind: 'wheel', phase: 'engaged', mods: { shift: true } },
            actionId: 'insert.adjustRotation',
            opts: { id: 'polygon.wheelRotation' },
          },
          // ArrowUp/Down → adjust side count. These were phase-table
          // `initial.keyDown` routes, which put them on the OTHER dispatch
          // pipeline: the tool route claimed the key but its `claim()` never
          // reached the DOM as preventDefault/stopPropagation, so `nudge.up`
          // matched the same keypress on the interactions dispatcher and
          // moved the selection at the same time (audit §4 — derived there,
          // reproduced and now covered by a smoke test). As active-scope
          // bindings they out-prioritize ambient `nudge.*` and the
          // dispatcher's first-match-wins settles it.
          {
            spec: { kind: 'key', key: 'ArrowUp' },
            actionId: 'polygon.adjustSides',
            opts: { id: 'polygon.moreSides', params: { delta: 1 } },
          },
          {
            spec: { kind: 'key', key: 'ArrowDown' },
            actionId: 'polygon.adjustSides',
            opts: { id: 'polygon.fewerSides', params: { delta: -1 } },
          },
        ],
      }),
    [adjustSidesAction, behaviors, label, toolOptions],
  );
}
