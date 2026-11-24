import { clamp as clampTo, normalizeZoom } from '@weasel-js/geom';
import { type LoupePoint, type LoupeRect, loupeSourcePoint } from './geometry';
import { createLoupeAim } from './aim';

/** How a loupe magnifies. `'vector'` re-renders the source through a zoomed-in
 *  view, so content stays sharp at any factor; `'pixel'` blows up the actual
 *  pixels the surface presented. */
export type LoupeMode = 'vector' | 'pixel';

/** What a loupe's aim follows. `'follow'` takes every aim it is given, the pointer's; `'pinned'` holds a point of the
 *  content still, ignoring aims, until it is pinned elsewhere or set to follow again. */
export type LoupeAimMode = 'follow' | 'pinned';

/**
 * What a loupe needs from the surface it magnifies. A painter implements it,
 * and the model asks nothing about how the lens is drawn — only where it is,
 * what color is under a point, and whether anyone can still see it.
 */
export interface LoupeSurface {
  /**
   * The lens' rectangle, or `null` while it has none. A lens placed somewhere
   * other than centered on the aim also says what it shows: `shows` is the
   * surface point at its middle, and `factor` the magnification it shows it at.
   * Either one omitted is the aim, or the model's own factor.
   */
  lens(): (LoupeRect & { shows?: LoupePoint; factor?: number }) | null;
  /**
   * Does the lens itself cover this point? A stationary lens does over its own
   * frame, which is what the freeze rule below is for; a lens that follows the
   * pointer never covers it and answers `false`.
   */
  covers(p: LoupePoint): boolean;
  /** Hex color at a surface point, or `null` where nothing is drawn there or the surface cannot say.
   *  Answered at once: a sampler that answers with a promise drives an eyedropper, not a loupe. */
  sample(p: LoupePoint): string | null;
  /** Is the lens off screen? Aims are ignored while it is. */
  hidden(): boolean;
  /** Is the lens gone for good? The model tears itself down the next time it
   *  is called, or a frame lands, once it is. */
  gone(): boolean;
  /** Something the painter must redraw for has changed. */
  changed(): void;
  /**
   * Run `fn` after each frame the surface lands; returns an unsubscribe.
   * Implement it when `sample` reads pixels that only show an aim once a
   * frame has painted — a framebuffer read back. The model then samples the
   * aim on the next landed frame, so `color` settles a frame after the aim.
   * Omit it when `sample` can answer for a fresh aim right away.
   */
  subscribeFrame?(fn: () => void): () => void;
  /**
   * The content point under surface point `p`, in whatever space the content lives in (a canvas's world). A pinned
   * aim is held as one, so it stays on what it was put on while the surface's camera pans and zooms. Implement it
   * with {@link pointFor} or not at all: `createLoupeModel` throws on a surface with only one. With neither, a pin
   * holds its surface point.
   */
  worldAt?(p: LoupePoint): LoupePoint;
  /** Where content point `w` stands on the surface now: the inverse of {@link worldAt}. */
  pointFor?(w: LoupePoint): LoupePoint;
}

/** Options for {@link createLoupeModel}. */
export interface LoupeModelOptions {
  surface: LoupeSurface;
  mode?: LoupeMode;
  /** What the aim follows. Default `'follow'`; a model made `'pinned'` pins where its aim first is, the origin. */
  aimMode?: LoupeAimMode;
  /** Magnification. Default 8. Always positive and finite: a factor that is
   *  not becomes `ZOOM_FLOOR`, the same rule a view's zoom follows. */
  factor?: number;
  /** Bounds `factor` and `setFactor` clamp to. Unset means bounded only by that rule. */
  minFactor?: number;
  maxFactor?: number;
  /** Called with the hex color under the aim point whenever it changes: `null` once the aim is
   *  over a point the surface answers `null` for, where a pick takes nothing. */
  onColorChange?: (hex: string | null) => void;
  /** Called when a pick lands — an eyedropper on the magnified surface. Where
   *  the color goes is the consumer's business. */
  onPick?: (hex: string) => void;
  /** Called once when the model tears itself down, by `dispose()` or because the
   *  surface reported the lens gone, so the painter can drop what it was holding. */
  onDispose?: () => void;
}

/** Where a loupe is aimed, how far it magnifies, and what color it is over. */
export interface LoupeModel {
  readonly mode: LoupeMode;
  readonly aimMode: LoupeAimMode;
  readonly factor: number;
  /** Where the lens is aimed, in the surface's CSS px: the last aim it took, or, pinned, where its pin stands now. */
  readonly aim: LoupePoint;
  /** Hex color under the aim point. `null` before an aim is sampled, and where the surface answers `null`. */
  readonly color: string | null;
  setMode(mode: LoupeMode): void;
  setFactor(factor: number): void;
  /** Aim at a surface point. Ignored while pinned, while the lens covers it or is hidden, and once the model is
   *  disposed. */
  aimAt(p: LoupePoint): void;
  /** Pin the aim at the content under the aim now, or let it follow aims again from where it stands. */
  setAimMode(mode: LoupeAimMode): void;
  /** Pin the aim at the content under surface point `p`. Ignored where `aimAt` would ignore it, the pin aside. */
  pinAt(p: LoupePoint): void;
  /** The content point the pin holds, in the space `surface.worldAt` answers in (its surface point without one), or
   *  `null` while the aim follows. Give it to {@link holdPin} to put the pin back where it was. */
  readonly pin: LoupePoint | null;
  /** Pin the aim at content point `c`, one {@link pin} gave, wherever the camera has since moved it to on the
   *  surface. Ignored once the model is disposed. Takes the pin even where {@link pinAt} would refuse its point, so a
   *  pin put back is never lost, but samples its color only once the lens is shown and does not cover it. */
  holdPin(c: LoupePoint): void;
  /** Sample what the lens shows at `p`, a point inside it, and report that to
   *  `onPick`. Omit `p` to pick at the aim point. `null` where the point sampled
   *  stands under the lens. Leaves the aim, and `color`, alone. */
  pick(p?: LoupePoint): string | null;
  /** The surface point whose color the surface presents at `p`: `p` itself where the lens does not cover it, the
   *  point the lens magnifies there where it does, and `null` where that point stands under the lens too. An
   *  eyedropper over the same surface samples this rather than `p`. */
  sourceAt(p: LoupePoint): LoupePoint | null;
  /** Sample the aim again, now: the pixels under it changed without it moving.
   *  Reports through `onColorChange` like an aim does. Ignored while hidden or
   *  while the lens covers the aim. */
  resample(): void;
  dispose(): void;
}

/** `surface`'s color at `p`, refusing a surface that answers later. */
function sampleNow(surface: LoupeSurface, p: LoupePoint): string | null {
  const hex: unknown = surface.sample(p);
  if (typeof (hex as { then?: unknown } | null)?.then === 'function') {
    (hex as PromiseLike<unknown>).then(undefined, () => {});
    throw new TypeError(
      '[weasel loupe] A loupe surface answers at once, and its sample() answered with a promise. ' +
        'Give an asynchronous sampler to createEyedropperModel, and the loupe a surface that reads now.',
    );
  }
  return hex as string | null;
}

/** Is `p` out of sight: the lens hidden, or standing over it? */
const blind = (surface: LoupeSurface, p: LoupePoint) => surface.hidden() || surface.covers(p);

/** The surface point the lens shows at `p`, a point inside it, or `null` where that is under the lens itself. */
function throughLens(surface: LoupeSurface, p: LoupePoint, aim: LoupePoint, factor: number): LoupePoint | null {
  const rect = surface.lens();
  if (!rect) return null;
  const at = loupeSourcePoint(p, rect, rect.shows ?? aim, rect.factor ?? factor);
  // The lens is part of the picture the surface presents: sampling under it
  // reports the lens' own chrome as artwork.
  return surface.covers(at) ? null : at;
}

/**
 * Build the loupe's model over a surface. It holds the state a magnifier has —
 * aim, what it follows, factor, mode, color — and none of the drawing.
 */
export function createLoupeModel(opts: LoupeModelOptions): LoupeModel {
  const { surface } = opts;
  let mode: LoupeMode = opts.mode ?? 'vector';
  const clamp = (n: number): number =>
    normalizeZoom(clampTo(normalizeZoom(n), opts.minFactor ?? Number.NEGATIVE_INFINITY, opts.maxFactor ?? Number.POSITIVE_INFINITY));

  let factor = clamp(opts.factor ?? 8);
  const aim = createLoupeAim(surface, opts.aimMode ?? 'follow');
  let color: string | null = null;
  let disposed = false;
  let aimUnsampled = false;

  /** Samples the aim, unless nothing can see it or the lens stands over it. Whether it did. */
  const sampleColor = (): boolean => {
    const at = aim.now();
    if (blind(surface, at)) return false;
    const hex = sampleNow(surface, at);
    if (hex !== color) { color = hex; opts.onColorChange?.(hex); }
    return true;
  };

  const unsubscribeFrame = surface.subscribeFrame?.(() => {
    if (disposed || dead()) return;
    if (aimUnsampled && sampleColor()) aimUnsampled = false;
  });

  const teardown = () => {
    if (disposed) return;
    disposed = true;
    unsubscribeFrame?.();
    opts.onDispose?.();
  };

  // A lens can be taken away by whatever owns it, without coming back through
  // `dispose`. Every entry point follows it down rather than keep working for a
  // magnifier nobody can see.
  function dead(): boolean {
    if (!surface.gone()) return false;
    teardown();
    return true;
  }

  /** The aim moved: sample it, now or on the frame that shows it. */
  const aimed = () => {
    aimUnsampled = !!unsubscribeFrame || !sampleColor();
    surface.changed();
  };
  const refuses = (p: LoupePoint) => disposed || dead() || blind(surface, p);

  return {
    get mode() { return mode; },
    get aimMode() { return aim.mode; },
    get factor() { return factor; },
    get aim() { return aim.now(); },
    get pin() { return aim.pinned; },
    get color() { return color; },

    setMode(next) {
      if (disposed || dead() || next === mode) return;
      mode = next;
      surface.changed();
    },

    setFactor(next) {
      if (disposed || dead()) return;
      const clamped = clamp(next);
      if (clamped === factor) return;
      factor = clamped;
      surface.changed();
    },

    aimAt(p) {
      if (refuses(p) || aim.mode === 'pinned') return;
      aim.follow(p);
      aimed();
    },

    setAimMode(next) {
      if (disposed || dead() || !aim.setMode(next)) return;
      surface.changed();
    },

    pinAt(p) {
      if (refuses(p)) return;
      aim.pin(p);
      aimed();
    },

    holdPin(c) {
      if (disposed || dead()) return;
      aim.hold(c);
      aimed();
    },

    pick(p) {
      if (disposed || dead()) return null;
      let at: LoupePoint | null = aim.now();
      if (p) at = throughLens(surface, p, at, factor);
      else if (surface.covers(at)) at = null;
      if (!at) return null;
      const hex = sampleNow(surface, at);
      if (hex !== null) opts.onPick?.(hex);
      return hex;
    },

    sourceAt(p) {
      if (disposed || surface.hidden() || !surface.covers(p)) return { x: p.x, y: p.y };
      return throughLens(surface, p, aim.now(), factor);
    },

    resample() {
      if (disposed || dead()) return;
      if (sampleColor()) aimUnsampled = false;
    },

    dispose: teardown,
  };
}
