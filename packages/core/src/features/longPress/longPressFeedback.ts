/**
 * The default "press is registering" feedback for a touch or pen long-press: a
 * ring around the press point that fills over the hold. It reads the `longPress`
 * dep the gesture dispatcher publishes, so it shows only for a press some
 * binding would fire on, and disappears when the press fires, moves past the
 * drag threshold, lifts, or is canceled.
 */
import type { LongPressState } from '@weasel-js/routing';
import type { RenderLayer } from 'core/layers/render';
import { ellipsePath, polylineFromPoints, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '../../renderer';
import type { CanvasExtensionApi } from '../../canvas/canvasExtension';
import type { ContributionDepReader, SurfaceContribution } from '../../canvas/surfaceContribution';
import { accentColorOf } from '../../canvas/accentColor';

/** Entry and layer id of the default feedback, so a host can find or order it. */
export const LONG_PRESS_FEEDBACK_ID = 'long-press-feedback';

/** Options for {@link createLongPressFeedbackContribution}. */
export interface LongPressFeedbackOptions {
  /** Entry and layer id. Default {@link LONG_PRESS_FEEDBACK_ID}. */
  id?: string;
  /** Ring radius in CSS pixels. Default 22 — clear of a fingertip. */
  radius?: number;
  /** Ring stroke width in CSS pixels. Default 3. */
  width?: number;
  /** Ring color. Default the theme's `--wzl-accent`, read off the canvas
   *  element when each press starts. */
  color?: string | (() => string);
  /** How long a press is held before the ring appears, in ms, so an ordinary
   *  tap shows nothing. Default 120. */
  delay?: number;
  /** `true` shows a static full ring instead of one that fills, and runs no
   *  frame loop. Default `'auto'`: follow `prefers-reduced-motion`, read when
   *  each press starts. */
  reducedMotion?: boolean | 'auto';
}

const RING_SEGMENTS = 64;
const TRACK_OPACITY = 0.3;

const nowMs = (): number => performance.now();

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** An open arc from 12 o'clock, clockwise on a y-down screen, through `t` of a turn. */
function arcPath(cx: number, cy: number, r: number, t: number): Path {
  const n = Math.max(1, Math.ceil(RING_SEGMENTS * t));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * t * Math.PI * 2;
    pts.push({ x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) });
  }
  return polylineFromPoints(pts);
}

function circlePath(cx: number, cy: number, r: number): Path {
  return ellipsePath({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r });
}

const viewIdOf = (data: unknown): string | null =>
  (data as { viewId?: string | null } | null)?.viewId ?? null;

/**
 * The default long-press feedback, as one entry. `<SceneCanvas>` installs it
 * unless `longPress={{ feedback: false }}`; pass a contribution of your own there to
 * replace it — it reads the same `longPress` dep this one does.
 */
export function createLongPressFeedbackContribution(
  opts: LongPressFeedbackOptions = {},
): SurfaceContribution {
  const id = opts.id ?? LONG_PRESS_FEEDBACK_ID;
  const radius = opts.radius ?? 22;
  const width = opts.width ?? 3;
  const delay = opts.delay ?? 120;

  let state: LongPressState | undefined;
  let color = '';
  let reduced = false;

  const showing = (): boolean => {
    const p = state?.get();
    return !!p && p.armed;
  };

  const layer: RenderLayer<unknown> = {
    id,
    label: 'Long-press feedback',
    space: 'screen',
    draw: (data): DrawCommand[] => {
      const p = state?.get();
      // Screen space is the whole canvas, so the root pass draws the ring
      // wherever the press routed; a view pass drawing it too would double it.
      if (!state || !p || !p.armed || viewIdOf(data) !== null) return [];
      const now = nowMs();
      if (now - p.startedAt < delay) return [];
      const { x, y } = p.local;
      const stroke = (opacity?: number) => ({
        paint: { color, ...(opacity !== undefined ? { opacity } : {}) },
        width: { px: width },
        cap: 'round' as const,
      });
      if (reduced) return [{ kind: 'path', path: circlePath(x, y, radius), stroke: stroke() }];
      return [
        { kind: 'path', path: circlePath(x, y, radius), stroke: stroke(TRACK_OPACITY) },
        { kind: 'path', path: arcPath(x, y, radius, state.progress(now)), stroke: stroke() },
      ];
    },
  };

  const attach = (api: CanvasExtensionApi, deps: ContributionDepReader): (() => void) => {
    const store = deps.get('longPress');
    if (!store) return () => {};
    state = store;
    let appear: ReturnType<typeof setTimeout> | undefined;

    const onChange = (): void => {
      clearTimeout(appear);
      appear = undefined;
      const p = store.get();
      if (p?.armed) {
        color = typeof opts.color === 'function' ? opts.color() : (opts.color ?? accentColorOf(api.element));
        reduced = opts.reducedMotion === 'auto' || opts.reducedMotion === undefined
          ? prefersReducedMotion()
          : opts.reducedMotion;
        // A static ring changes once, when it appears; nothing needs frames.
        const wait = delay - (nowMs() - p.startedAt);
        if (reduced && wait > 0) appear = setTimeout(() => { api.requestRedraw(); }, wait);
      }
      api.requestRedraw();
    };

    const offStore = store.subscribe(onChange);
    onChange();
    return () => {
      offStore();
      clearTimeout(appear);
      state = undefined;
      api.requestRedraw();
    };
  };

  return {
    id,
    eligibility: { always: true },
    overlay: layer,
    attach,
    // The filling ring asks for the next frame from each painted one while it shows.
    afterPaint: (ctx) => {
      if (!reduced && showing()) ctx.requestFrame();
    },
  };
}
