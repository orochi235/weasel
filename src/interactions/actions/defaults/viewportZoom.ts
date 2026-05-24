/**
 * `viewportZoomAction` — immediate Action descriptor for viewport zoom.
 *
 * ## Bindings (parametric — each passes `params.kind`)
 * - `{ kind: 'wheel', mods: { mod: true } }` → Cmd+wheel, params: `{ kind: 'wheel' }`
 *   (also covers Mac trackpad pinch, which the browser synthesizes as ctrl+wheel)
 * - `{ kind: 'key', key: '=' }` → zoom in, params: `{ kind: 'in' }`
 * - `{ kind: 'key', key: '-' }` → zoom out, params: `{ kind: 'out' }`
 * - `{ kind: 'key', key: '0' }` → reset zoom, params: `{ kind: 'reset' }`
 *
 * ## Design notes
 * The invoker switches on `params.kind`:
 * - `'wheel'`: computes factor from deltaY, anchors zoom at (clientX, clientY).
 *   The dispatcher merges wheel event data into params at dispatch time, and
 *   converts the wheel event's client coords to canvas-local (subtracting the
 *   canvas's bounding rect) before merging — `zoomAt` expects canvas-local.
 * - `'in'`/`'out'`: step zoom by ×1.25 / ×0.8, anchored at origin (0, 0)
 *   (canvas top-left in screen space). A canvas-center anchor is not available
 *   to immediate invokers because the canvas rect is not in the dep registry.
 *   This is a known limitation; the zoom still feels correct — it just anchors
 *   at the top-left corner of the canvas rather than the center.
 * - `'reset'`: resets scale to 1, translation to 0.
 *
 * ## Key binding modifier notes
 * The key bindings (`=`, `-`, `0`) require `mod: true` (Cmd on Mac, Ctrl elsewhere).
 * This matches the behaviour of the dissolved `useKeyboardZoomTool`.
 */

import type { Action } from '../registry';
import type { ViewApi } from '../depSchema';
import { zoomAt } from 'core/viewport/zoomAt';

// Multiplicative step for keyboard zoom (matches useKeyboardZoomTool default).
const KEY_STEP = 1.25;
// Wheel step per 100 px of deltaY (matches useWheelZoomTool default).
const WHEEL_STEP = 1.1;

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `viewport.zoom` Action.
 *
 * Requires dep-schema entry: `view`.
 */
export const viewportZoomAction: Action & { requires: string[] } = {
  id: 'viewport.zoom',
  label: 'Zoom',
  group: 'viewport',
  defaultBinding: [
    // Cmd+wheel → wheel zoom (also catches Mac trackpad pinch via ctrl+wheel)
    {
      spec: { kind: 'wheel', mods: { mod: true } },
      opts: { params: { kind: 'wheel' } },
    },
    // Cmd+= → zoom in (also accepts Cmd+Shift+= which is Cmd++ on many keyboards)
    {
      spec: { kind: 'key', key: '=', mods: { mod: true, shift: 'optional' } },
      opts: { params: { kind: 'in' } },
    },
    // Cmd+- → zoom out
    {
      spec: { kind: 'key', key: '-', mods: { mod: true } },
      opts: { params: { kind: 'out' } },
    },
    // Cmd+0 → reset zoom
    {
      spec: { kind: 'key', key: '0', mods: { mod: true } },
      opts: { params: { kind: 'reset' } },
    },
  ],
  requires: ['view'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const view = deps.view as ViewApi | undefined;
      if (!view) return;
      const current = view.get();
      const kind = params?.kind as string | undefined;

      switch (kind) {
        case 'wheel': {
          const deltaY = (params?.deltaY as number | undefined) ?? 0;
          const clientX = (params?.clientX as number | undefined) ?? 0;
          const clientY = (params?.clientY as number | undefined) ?? 0;
          const factor = Math.pow(WHEEL_STEP, -deltaY / 100);
          view.set(zoomAt(current, { x: clientX, y: clientY }, factor));
          break;
        }
        case 'in':
          // Anchor at origin (canvas top-left). See design notes above.
          view.set(zoomAt(current, { x: 0, y: 0 }, KEY_STEP));
          break;
        case 'out':
          view.set(zoomAt(current, { x: 0, y: 0 }, 1 / KEY_STEP));
          break;
        case 'reset':
          view.set({ x: 0, y: 0, scale: { x: 1, y: 1 } });
          break;
        default:
          // Unknown kind — no-op. Legacy bridge calls with params=undefined;
          // default to zoom-in as a sensible fallback.
          if (params === undefined) {
            view.set(zoomAt(current, { x: 0, y: 0 }, KEY_STEP));
          }
          break;
      }
    },
  },
  enabled: () => true,
};
