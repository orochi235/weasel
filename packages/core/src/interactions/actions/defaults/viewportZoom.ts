/**
 * `viewportZoomAction` — immediate Action descriptor for viewport zoom.
 *
 * ## Bindings (parametric — each passes `params.kind`)
 * - `{ kind: 'wheel', mods: { mod: true } }` → Cmd+wheel, params: `{ kind: 'wheel' }`
 * - `{ kind: 'wheel', mods: { ctrl: true } }` → trackpad pinch, params: `{ kind: 'wheel' }`.
 *   Browsers synthesize a trackpad pinch as ctrl+wheel. On a Mac that is a
 *   *different* event from the `mod` binding above (`mod` is metaKey there), so
 *   pinch needs its own binding or nothing claims it and the page zooms instead.
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
 * - `'in'`/`'out'`: step zoom by ×1.25 / ×0.8, anchored at the host center
 *   when the `view` dep wires `hostSize()` (SceneCanvas does), falling back
 *   to the canvas top-left origin for consumers that don't.
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

/** Keyboard-zoom anchor: the host center when the view dep can measure it,
 *  else the canvas top-left origin (see design notes). */
function keyAnchor(view: ViewApi): { x: number; y: number } {
  const size = view.hostSize?.();
  return size ? { x: size.width / 2, y: size.height / 2 } : { x: 0, y: 0 };
}
// Wheel step per 100 px of deltaY (matches useWheelZoomTool default).
const WHEEL_STEP = 1.1;

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Tuning for {@link makeViewportZoomAction}.
 */
export interface ViewportZoomOptions {
  /**
   * Which wheel gesture triggers zoom.
   * - `'mod'` (default): Cmd/Ctrl+wheel — coexists with plain-wheel pan
   *   (`viewport.wheelPan`) and Mac trackpad pinch (ctrl+wheel).
   * - `'plain'`: bare wheel, no modifier. Pair with `viewport.pan: false`,
   *   since plain wheel otherwise drives pan and the two would compete.
   */
  wheel?: 'plain' | 'mod';
  /** Lower clamp on the resulting view scale, forwarded to `zoomAt`. Default 0.1. */
  min?: number;
  /** Upper clamp on the resulting view scale, forwarded to `zoomAt`. Default 8. */
  max?: number;
}

/**
 * @experimental
 * Build a `viewport.zoom` Action descriptor with a configurable wheel trigger
 * and scale clamp. The keyboard bindings (Cmd+=/-/0) are fixed; only the wheel
 * binding and the `zoomAt` clamp vary.
 *
 * Requires dep-schema entry: `view`.
 */
export function makeViewportZoomAction(
  opts: ViewportZoomOptions = {},
): Action & { requires: string[] } {
  const clamp = { min: opts.min ?? 0.1, max: opts.max ?? 8 };
  // 'plain': bare wheel (omitting `mods` forbids any modifier — see the
  // matcher's strict modifier check). 'mod': Cmd/Ctrl+wheel.
  const wheelSpec =
    opts.wheel === 'plain'
      ? { kind: 'wheel' as const }
      : { kind: 'wheel' as const, mods: { mod: true } };

  return {
    id: 'viewport.zoom',
    label: 'Zoom',
    group: 'viewport',
    defaultBinding: [
      // wheel → wheel zoom (mod-gated by default; plain when configured)
      {
        spec: wheelSpec,
        opts: { params: { kind: 'wheel' } },
      },
      // Trackpad pinch, which the browser delivers as ctrl+wheel. Distinct from
      // the `mod` binding on mac; a duplicate of it elsewhere, where `matchBest`
      // picks a single winner. `viewport.wheelPan` forbids ctrl, so no contest.
      {
        spec: { kind: 'wheel' as const, mods: { ctrl: true } },
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
            view.set(zoomAt(current, { x: clientX, y: clientY }, factor, clamp));
            break;
          }
          case 'in':
            view.set(zoomAt(current, keyAnchor(view), KEY_STEP, clamp));
            break;
          case 'out':
            view.set(zoomAt(current, keyAnchor(view), 1 / KEY_STEP, clamp));
            break;
          case 'reset':
            // Prefer the consumer-supplied recenter when available — typically
            // re-fits the document page into the workspace. Fall back to
            // identity (origin, scale 1) when no recenter is wired.
            if (view.recenter) {
              view.recenter();
            } else {
              view.set({ x: 0, y: 0, scale: { x: 1, y: 1 } });
            }
            break;
          default:
            // Unknown kind — no-op. Legacy bridge calls with params=undefined;
            // default to zoom-in as a sensible fallback.
            if (params === undefined) {
              view.set(zoomAt(current, { x: 0, y: 0 }, KEY_STEP, clamp));
            }
            break;
        }
      },
    },
    enabled: () => true,
  };
}

/**
 * @experimental
 * Default `viewport.zoom` descriptor: Cmd/Ctrl+wheel zoom with the kit's
 * default 0.1–8 scale clamp. Equivalent to `makeViewportZoomAction()`.
 *
 * Requires dep-schema entry: `view`.
 */
export const viewportZoomAction: Action & { requires: string[] } = makeViewportZoomAction();
