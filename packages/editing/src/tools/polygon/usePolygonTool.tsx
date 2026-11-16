import { useCallback, useMemo, useState } from 'react';
import { defineTool } from '@weasel-js/core';
import type { Tool } from '@weasel-js/core';
import { INSERT_REPOSITION_BINDING } from '@weasel-js/core';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import { defineAction, shareToolOptions, withToolOptionDefault, type WorldPoint } from '@weasel-js/routing';
import { POLYGON_INSERT_PARAMS } from '@weasel-js/core';
import { DEFAULT_SHAPE_PAINT, shapeToolOptions } from '../shared/styleOptions';
import { stepCountOption } from '../shared/countOption';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../icons.gen';
import { INSERT_DRAG_MODS } from '@weasel-js/core';
import type {} from '@weasel-js/core';

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

/** {@link usePolygonTool}'s options, and what to call when a gesture changes the side count, so the live preview
 *  repaints. */
export interface CreatePolygonToolOptions extends UsePolygonToolOptions {
  onCountChange?: () => void;
}

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
 *
 * A side change mid-drag calls `onCountChange`.
 */
export function createPolygonTool(options: CreatePolygonToolOptions = {}): Tool {
  const { sides, label = 'Polygon', behaviors, share } = options;
  const toolOptions = withToolOptionDefault(shareToolOptions(POLYGON_TOOL_OPTIONS, share), 'sides', sides);
  const adjust = defineAction({
    id: 'polygon.adjustSides',
    label: 'Polygon — adjust sides',
    requires: ['toolOptionValues'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        if (stepCountOption('polygon', toolOptions, 'sides', deps.toolOptionValues, params)) options.onCountChange?.();
      },
    },
  });
  return defineTool({
    id: 'polygon',
    keybinding: { key: 'G' },
    capabilities: ['creates-shapes'],
    hookName: 'usePolygonTool',
    options: toolOptions,
    cursor: cursorFor('crosshair', { mark: 'polygon', fallback: 'crosshair' }),
    // Registered by <ToolActionsMounter>, inside the ActionsProvider —
    // see `ToolDef.actions` for why the hook can't register it itself.
    actions: [adjust],
    presentation: {
      label,
      group: 'shape',
      icon: icon('core:polygon'),
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
  });
}

/** {@link createPolygonTool}, kept while its options are, re-rendering its caller when the side count changes. */
export function usePolygonTool(options: UsePolygonToolOptions = {}): Tool {
  const { sides, label = 'Polygon', behaviors, share } = options;
  const [, setTick] = useState(0);
  const onCountChange = useCallback(() => setTick((n) => n + 1), []);
  return useMemo(
    () => createPolygonTool({ sides, label, behaviors, share, onCountChange }),
    [sides, label, behaviors, share, onCountChange],
  );
}
