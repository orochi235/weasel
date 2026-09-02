import { type LoupePoint, type LoupeRect, loupeSourcePoint } from './geometry';

/** How a loupe magnifies. `'vector'` re-renders the source through a zoomed-in
 *  view, so content stays sharp at any factor; `'pixel'` blows up the actual
 *  pixels the surface presented. */
export type LoupeMode = 'vector' | 'pixel';

/**
 * What a loupe needs from the surface it magnifies. A painter implements it,
 * and the model asks nothing about how the lens is drawn — only where it is,
 * what colour is under a point, and whether anyone can still see it.
 */
export interface LoupeSurface {
  /** The lens' rectangle, or `null` while it has none. */
  lens(): LoupeRect | null;
  /**
   * Does the lens itself cover this point? A stationary lens does over its own
   * frame, which is what the freeze rule below is for; a lens that follows the
   * pointer never covers it and answers `false`.
   */
  covers(p: LoupePoint): boolean;
  /** Hex colour at a surface point, or `null` when the surface cannot say. */
  sample(p: LoupePoint): string | null;
  /** Is the lens off screen? Aims are ignored while it is. */
  hidden(): boolean;
  /** Is the lens gone for good? The model tears itself down when it is. */
  gone(): boolean;
  /** Something the painter must redraw for has changed. */
  changed(): void;
}

/** Options for {@link createLoupeModel}. */
export interface LoupeModelOptions {
  surface: LoupeSurface;
  mode?: LoupeMode;
  /** Magnification. Default 8. */
  factor?: number;
  /** Bounds `setFactor` clamps to. Unset means unclamped. */
  minFactor?: number;
  maxFactor?: number;
  /** Called with the hex colour under the aim point whenever it changes. */
  onColorChange?: (hex: string) => void;
  /** Called when a pick lands — an eyedropper on the magnified surface. Where
   *  the colour goes is the consumer's business. */
  onPick?: (hex: string) => void;
  /** Called when the model tears itself down because the surface reported the
   *  lens gone, so the painter can drop what it was holding. */
  onDispose?: () => void;
}

/** Where a loupe is aimed, how far it magnifies, and what colour it is over. */
export interface LoupeModel {
  readonly mode: LoupeMode;
  readonly factor: number;
  /** Last aimed point, in the surface's CSS px. */
  readonly aim: LoupePoint;
  /** Hex colour under the aim point. `null` until something answers. */
  readonly color: string | null;
  setMode(mode: LoupeMode): void;
  setFactor(factor: number): void;
  /** Aim at a surface point. Ignored while the lens covers it, is hidden, or
   *  the model is disposed. */
  aimAt(p: LoupePoint): void;
  /** Sample what the lens shows at `p`, a point inside it, and report that to
   *  `onPick`. Omit `p` to pick at the aim point. Leaves the aim, and `color`,
   *  alone. */
  pick(p?: LoupePoint): string | null;
  dispose(): void;
}

/**
 * Build the loupe's model over a surface. It holds the state a magnifier has —
 * aim, factor, mode, colour — and none of the drawing.
 */
export function createLoupeModel(opts: LoupeModelOptions): LoupeModel {
  const { surface } = opts;
  let mode: LoupeMode = opts.mode ?? 'vector';
  let factor = opts.factor ?? 8;
  let aim: LoupePoint = { x: 0, y: 0 };
  let color: string | null = null;
  let disposed = false;

  const clamp = (n: number): number =>
    Math.min(opts.maxFactor ?? Number.POSITIVE_INFINITY,
             Math.max(opts.minFactor ?? Number.NEGATIVE_INFINITY, n));

  const teardown = () => {
    if (disposed) return;
    disposed = true;
    opts.onDispose?.();
  };

  const sampleColor = () => {
    const hex = surface.sample(aim);
    if (hex === null || hex === color) return;
    color = hex;
    opts.onColorChange?.(hex);
  };

  return {
    get mode() { return mode; },
    get factor() { return factor; },
    get aim() { return aim; },
    get color() { return color; },

    setMode(next) {
      if (disposed || next === mode) return;
      mode = next;
      surface.changed();
    },

    setFactor(next) {
      if (disposed) return;
      factor = clamp(next);
      surface.changed();
    },

    aimAt(p) {
      if (disposed) return;
      // A lens can be taken away by whatever owns it, without coming back
      // through `dispose`. Follow it down rather than keep sampling for a
      // magnifier nobody can see.
      if (surface.gone()) { teardown(); return; }
      if (surface.hidden()) return;
      if (surface.covers(p)) return;
      aim = p;
      sampleColor();
      surface.changed();
    },

    pick(p) {
      if (disposed) return null;
      let at = aim;
      if (p) {
        const rect = surface.lens();
        if (!rect) return null;
        at = loupeSourcePoint(p, rect, aim, factor);
        // The lens is part of the picture the surface presents. A point near
        // its frame maps back underneath it, and sampling there reports the
        // lens' own chrome as artwork.
        if (surface.covers(at)) return null;
      }
      const hex = surface.sample(at);
      if (hex !== null) opts.onPick?.(hex);
      return hex;
    },

    dispose: teardown,
  };
}
