import type { Action } from '@weasel-js/routing';
import type { ViewApi } from '../depSchema';
import { zoomAt } from 'core/viewport/zoomAt';
import { wheelZoomFactor } from 'core/viewport/wheelHandler';
import { DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM } from 'core/viewport/zoomBounds';
import { viewToTransform, type View } from 'core/viewport/view';
import { screenToWorld } from 'core/viewport/viewTransform';
import type { ViewAnimationOptions } from 'core/viewport/useViewAnimation';

// Multiplicative step for keyboard zoom (matches useKeyboardZoomTool default).
const KEY_STEP = 1.25;

/** Keyboard-zoom anchor: the host center when the view dep can measure it,
 *  else the canvas top-left origin. */
function keyAnchor(view: ViewApi): { x: number; y: number } {
  const size = view.hostSize?.();
  return size ? { x: size.width / 2, y: size.height / 2 } : { x: 0, y: 0 };
}

/**
 * @experimental
 * Tuning for the animated form of the discrete zoom steps.
 */
export interface ViewportZoomAnimateOptions extends ViewAnimationOptions {
  /** Duration for the Cmd+0 reset branch. Defaults to `ms`. */
  resetMs?: number;
}

/**
 * @experimental
 * Tuning for {@link makeViewportZoomAction}.
 */
export interface ViewportZoomOptions {
  /**
   * Which wheel gesture triggers zoom.
   * - `'mod'` (default): Cmd/Ctrl+wheel — coexists with plain-wheel pan
   *   (`viewport.wheelPan`).
   * - `'plain'`: bare wheel, no modifier. Pair with `viewport.pan: false`,
   *   since plain wheel otherwise drives pan and the two would compete.
   */
  wheel?: 'plain' | 'mod';
  /** Lower clamp on the resulting view scale, forwarded to `zoomAt`. Default 0.1. */
  min?: number;
  /** Upper clamp on the resulting view scale, forwarded to `zoomAt`. Default 8. */
  max?: number;
  /**
   * Glide the discrete steps (Cmd+=, Cmd+-, Cmd+0) instead of jumping.
   * `true` uses the kit defaults; an object tunes them. Wheel and pinch never
   * animate — their input already samples every frame. Requires a `view` dep
   * that implements `animate`; without one this is ignored.
   */
  animate?: boolean | ViewportZoomAnimateOptions;
}

/**
 * @experimental
 * Build a `viewport.zoom` Action descriptor with a configurable wheel trigger
 * and scale clamp. The keyboard bindings (Cmd+=/-/0) and the two trackpad
 * pinch bindings are fixed. A wheel or pinch sample zooms about its focal
 * point, which `zoomAt` expects in canvas-local pixels.
 */
export function makeViewportZoomAction(
  opts: ViewportZoomOptions = {},
): Action & { requires: string[] } {
  const clamp = { min: opts.min ?? DEFAULT_MIN_ZOOM, max: opts.max ?? DEFAULT_MAX_ZOOM };
  // 'plain': bare wheel (omitting `mods` forbids any modifier — see the
  // matcher's strict modifier check). 'mod': Cmd/Ctrl+wheel.
  const wheelSpec =
    opts.wheel === 'plain'
      ? { kind: 'wheel' as const }
      : { kind: 'wheel' as const, mods: { mod: true } };

  const rawAnimate: ViewportZoomAnimateOptions | null =
    opts.animate === true ? {} : (opts.animate || null);
  const { resetMs, ...animateRest } = rawAnimate ?? {};
  const tweenOpts: ViewAnimationOptions | null = rawAnimate ? animateRest : null;

  return {
    id: 'viewport.zoom',
    label: 'Zoom',
    group: 'viewport',
    defaultBinding: [
      {
        spec: wheelSpec,
        opts: { params: { kind: 'wheel' } },
      },
      // Trackpad pinch, which the browser delivers as ctrl+wheel. Distinct from
      // the `mod` binding on mac (`mod` is metaKey there), so without its own
      // binding nothing claims it and the page zooms instead. Elsewhere it
      // duplicates `mod`, and `matchBest` picks a single winner.
      {
        spec: { kind: 'wheel' as const, mods: { ctrl: true } },
        opts: { params: { kind: 'wheel' } },
      },
      // Safari's trackpad pinch, reported as a scale rather than a wheel. Safari
      // may send the same pinch as ctrl+wheel too; the dispatcher swallows that
      // copy while a claimed gesture is live.
      {
        spec: { kind: 'pinch' as const },
        opts: { params: { kind: 'pinch' } },
      },
      // Cmd+= → zoom in (also accepts Cmd+Shift+= which is Cmd++ on many keyboards)
      {
        spec: { kind: 'key', key: '=', mods: { mod: true, shift: 'optional' } },
        opts: { params: { kind: 'in' } },
      },
      {
        spec: { kind: 'key', key: '-', mods: { mod: true } },
        opts: { params: { kind: 'out' } },
      },
      {
        spec: { kind: 'key', key: '0', mods: { mod: true } },
        opts: { params: { kind: 'reset' } },
      },
    ],
    requires: ['view', 'debug'],
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const view = deps.view;
        if (!view) return;
        const debug = deps.debug;
        const current = view.get();
        // Report a zoom about `anchor` (canvas-local px) from `from` to `to`.
        const record = (from: View, to: View, anchor: { x: number; y: number }) => {
          if (!debug) return;
          const [wx, wy] = screenToWorld(anchor.x, anchor.y, viewToTransform(from));
          debug.recordViewport('zoom', from, to, { x: wx, y: wy });
        };
        const kind = params?.kind as string | undefined;

        const canAnimate = tweenOpts !== null && typeof view.animate === 'function';
        const stepTo = (target: View, ms?: number) => {
          if (!canAnimate) { view.set(target); return; }
          view.animate!(target, { ...tweenOpts!, ms: ms ?? tweenOpts!.ms });
        };
        // Successive presses compound off where the camera is heading, not off
        // whichever frame the tween happens to be on.
        const stepFrom = (): View => (canAnimate && view.animationTarget?.()) || current;

        const focal = () => ({
          x: (params?.clientX as number | undefined) ?? 0,
          y: (params?.clientY as number | undefined) ?? 0,
        });
        const scaleBy = (factor: number) => {
          if (!(factor > 0) || !Number.isFinite(factor)) return;
          const next = zoomAt(current, focal(), factor, clamp);
          view.set(next);
          record(current, next, focal());
        };

        switch (kind) {
          case 'wheel':
            scaleBy(wheelZoomFactor((params?.deltaY as number | undefined) ?? 0));
            break;
          case 'pinch':
            scaleBy((params?.scale as number | undefined) ?? Number.NaN);
            break;
          case 'in':
          case 'out': {
            const from = stepFrom();
            const target = zoomAt(from, keyAnchor(view), kind === 'in' ? KEY_STEP : 1 / KEY_STEP, clamp);
            stepTo(target);
            record(from, target, keyAnchor(view));
            break;
          }
          case 'reset': {
            // A recenter that returns its target can be animated; one that
            // returns nothing dispatched the view itself and is already done.
            const target = view.recenter
              ? view.recenter()
              : { x: 0, y: 0, scale: { x: 1, y: 1 } };
            if (target) stepTo(target, resetMs);
            break;
          }
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
 */
export const viewportZoomAction: Action & { requires: string[] } = makeViewportZoomAction();
