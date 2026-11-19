/**
 * The default long-press feedback on a canvas: the ring `@weasel-js/gestures`'
 * `pressRingAt` describes, drawn as a screen-space layer from the `longPress`
 * dep the gesture dispatcher publishes, colored by the theme's accent.
 */
import {
  type LongPressState, type PressRing, type PressRingOptions, pressRingAt, pressRingWaitAt, ringArcPoints,
} from '@weasel-js/gestures';
import { prefersReducedMotion } from '@weasel-js/react';
import { after } from '@weasel-js/registry';
import type { RenderLayer } from 'core/layers/render';
import { ellipsePath, polylineFromPoints, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { CanvasExtensionApi } from '../../canvas/canvasExtension';
import type { ContributionDepReader, SurfaceContribution } from '../../canvas/surfaceContribution';
import { accentColorOf } from '../../canvas/accentColor';

/** Entry and layer id of the default feedback, so a host can find or order it. */
export const LONG_PRESS_FEEDBACK_ID = 'long-press-feedback';

/** Options for {@link createLongPressFeedbackContribution}: the ring's look and timing, plus how it is colored
 *  and whether it fills. */
export interface LongPressFeedbackOptions extends PressRingOptions {
  /** Entry and layer id. Default {@link LONG_PRESS_FEEDBACK_ID}. */
  id?: string;
  /** Ring color. Default the theme's `--wzl-accent`, read off the canvas
   *  element when each press starts. */
  color?: string | (() => string);
  /** `true` shows a static full ring instead of one that fills, and runs no
   *  frame loop. Default `'auto'`: follow `prefers-reduced-motion`, read when
   *  each press starts. */
  reducedMotion?: boolean | 'auto';
}

const TRACK_OPACITY = 0.3;

const nowMs = (): number => performance.now();

interface Look {
  color: string;
  reduced: boolean;
}

function circlePath(r: Pick<PressRing, 'x' | 'y' | 'radius'>): Path {
  return ellipsePath({ x: r.x - r.radius, y: r.y - r.radius, width: 2 * r.radius, height: 2 * r.radius });
}

/** The commands that draw `ring` in `color`: a faint track under the filled arc, or one full ring when static. */
function ringCommands(ring: PressRing, color: string): DrawCommand[] {
  const stroke = (opacity?: number) => ({
    paint: { color, ...(opacity !== undefined ? { opacity } : {}) },
    width: { px: ring.width },
    cap: 'round' as const,
  });
  if (ring.fill === 'full') return [{ kind: 'path', path: circlePath(ring), stroke: stroke() }];
  return [
    { kind: 'path', path: circlePath(ring), stroke: stroke(TRACK_OPACITY) },
    { kind: 'path', path: polylineFromPoints(ringArcPoints(ring, ring.fill)), stroke: stroke() },
  ];
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
  const ringOpts: PressRingOptions = {
    ...(opts.radius !== undefined ? { radius: opts.radius } : {}),
    ...(opts.width !== undefined ? { width: opts.width } : {}),
    ...(opts.delay !== undefined ? { delay: opts.delay } : {}),
  };

  /** How each attached canvas draws its press, read when the press starts.
   *  Keyed by the canvas's store: one entry may be installed on several. */
  const looks = new Map<LongPressState, Look>();

  const ringLayer = (store: LongPressState, look: Look): RenderLayer<unknown> => ({
    id,
    label: 'Long-press feedback',
    space: 'screen',
    draw: (data): DrawCommand[] => {
      // Screen space is the whole canvas, so the root pass draws the ring
      // wherever the press routed; a view pass drawing it too would double it.
      if (viewIdOf(data) !== null) return [];
      const ring = pressRingAt(store, nowMs(), { ...ringOpts, still: look.reduced });
      return ring ? ringCommands(ring, look.color) : [];
    },
  });

  const attach = (api: CanvasExtensionApi, deps: ContributionDepReader): (() => void) => {
    const store = deps.get('longPress');
    if (!store) return () => {};
    const look: Look = { color: '', reduced: false };
    looks.set(store, look);
    const offLayer = api.registerLayer(ringLayer(store, look));
    let cancelAppear = (): void => {};

    const onChange = (): void => {
      cancelAppear();
      const p = store.get();
      if (p?.armed) {
        look.color = typeof opts.color === 'function' ? opts.color() : (opts.color ?? accentColorOf(api.element));
        look.reduced = opts.reducedMotion === 'auto' || opts.reducedMotion === undefined
          ? prefersReducedMotion()
          : opts.reducedMotion;
        // A static ring changes once, when it appears; nothing needs frames.
        const wait = pressRingWaitAt(store, nowMs(), opts.delay) ?? 0;
        if (look.reduced && wait > 0) cancelAppear = after(wait, () => { api.requestRedraw(); });
      }
      api.requestRedraw();
    };

    const offStore = store.subscribe(onChange);
    onChange();
    return () => {
      offStore();
      cancelAppear();
      if (looks.get(store) === look) looks.delete(store);
      offLayer();
      api.requestRedraw();
    };
  };

  return {
    id,
    eligibility: { always: true },
    attach,
    // The filling ring asks for the next frame from each painted one while it shows.
    afterPaint: (ctx) => {
      const store = ctx.deps.get('longPress');
      const look = store && looks.get(store);
      if (look && !look.reduced && store.get()?.armed) ctx.requestFrame();
    },
  };
}
