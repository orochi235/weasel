import { useCallback, useMemo, useRef, useState } from 'react';
import { defineTool } from '../../defineTool';
import { PolygonIcon } from '../../../icons';
import type { Tool } from '../../types';
import type { Action } from 'interactions/actions/registry';

export interface PolygonPoint { x: number; y: number }

export interface UsePolygonToolOptions {
  label?: string;
  /** Initial side count. Side count persists across gestures
   *  (Illustrator convention) and is adjustable mid-drag via
   *  ArrowUp/Down or wheel (range 3–32). */
  sides?: number;
}

const MIN_SIDES = 3;
const MAX_SIDES = 32;

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
): Tool<null> {
  const { sides: initialSides = 6 } = options;
  // Side count in a ref so keyDown / wheel mutations are visible
  // synchronously to the insert binding's thunked params (re-resolved
  // every frame for the live preview and at commit time). A useState
  // tick alongside forces a render so the dispatcher overlay layer
  // repaints when the count changes between pointer events.
  const sidesRef = useRef(initialSides);
  const [, setSidesTick] = useState(0);
  const bumpSides = useCallback(() => setSidesTick((n) => n + 1), []);

  // Wheel-to-adjust-sides action. Bound to `[engaged] wheel` so it only
  // fires while a polygon insert drag is in flight — outside that window
  // wheel falls through to ambient viewport.pan/zoom. The action's run
  // body reads the dispatcher-injected wheel delta from params.
  const adjustSidesAction = useMemo<Action>(
    () => ({
      id: 'polygon.adjustSides',
      label: 'Polygon — adjust sides',
      invoker: {
        timing: 'immediate' as const,
        run: (_deps, params) => {
          const p = params as { deltaY?: number; delta?: number } | undefined;
          // `delta` comes from the ArrowUp/ArrowDown key bindings; `deltaY`
          // is the dispatcher-injected wheel delta. Wheel "up" (deltaY > 0
          // under Mac natural scrolling / page-scrolls-up gesture) adds a
          // side; wheel "down" removes one. Matches the user's mental model:
          // scroll up = more.
          const step = p?.delta ?? (p?.deltaY !== undefined && p.deltaY !== 0
            ? (p.deltaY > 0 ? 1 : -1)
            : 0);
          if (step === 0) return;
          sidesRef.current = step > 0
            ? Math.min(MAX_SIDES, sidesRef.current + 1)
            : Math.max(MIN_SIDES, sidesRef.current - 1);
          bumpSides();
        },
      },
    }),
    [bumpSides],
  );

  // `TNode` is retained for source-compat with callers that previously
  // threaded a node-record type through; the tool no longer mints nodes
  // (insertAction does), so the parameter has no runtime effect.
  void ({} as TNode);

  return useMemo(
    () =>
      defineTool<null>({
        id: 'polygon',
        capabilities: ['creates-shapes'],
        hookName: 'usePolygonTool',
        cursor: 'crosshair',
        // Registered by <ToolActionsMounter>, inside the ActionsProvider —
        // see `ToolDef.actions` for why the hook can't register it itself.
        actions: [adjustSidesAction],
        presentation: {
          label: 'Polygon',
          group: 'shape',
          icon: <PolygonIcon />,
        },
        bindings: [
          // Default = drag from corner, consistent with rect/ellipse.
          // The dispatcher overlay paints an anchorPoint dot at the
          // click so the radial shape reads as anchored even though no
          // polygon vertex sits at the AABB corner. Alt held flips to
          // center mode (insertAction reads live modifier state).
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            // Thunked params re-evaluated at commit time (and on every
            // overlay() call for live preview) so mid-gesture
            // ArrowUp/Down/wheel side-count changes flow through both
            // the ghost and the committed geometry.
            opts: {
              params: () => ({
                kind: 'polygon',
                sides: sidesRef.current,
              }),
            },
          },
          // Wheel-during-drag → adjust side count. Phase-gated to
          // `engaged` so wheel while the tool is idle still falls
          // through to ambient viewport.pan / viewport.zoom.
          {
            spec: { kind: 'wheel', phase: 'engaged' },
            actionId: 'polygon.adjustSides',
          },
          // Shift+wheel during engaged drag → rotate the in-flight
          // shape in place. Strict modifier matching means this
          // doesn't conflict with the unmodified wheel binding above.
          {
            spec: { kind: 'wheel', phase: 'engaged', mods: { shift: true } },
            actionId: 'insert.adjustRotation',
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
            opts: { params: { delta: 1 } },
          },
          {
            spec: { kind: 'key', key: 'ArrowDown' },
            actionId: 'polygon.adjustSides',
            opts: { params: { delta: -1 } },
          },
        ],
      }),
    [bumpSides, adjustSidesAction],
  );
}
