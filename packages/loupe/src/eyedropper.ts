import type { LoupePoint } from './geometry';
import type { LoupeModel } from './model';
import type { MaybePromise } from './sampler';

/** Options for {@link createEyedropperModel}. */
export interface EyedropperModelOptions {
  /** What color is at a surface point, in its CSS px: a `Sampler`'s `sample`,
   *  or anything answering the same. `null` where nothing is drawn. */
  sample: (p: LoupePoint) => MaybePromise<string | null>;
  /**
   * A loupe on the same surface. `hover` aims it, so the lens shows the
   * neighborhood of the point a click would take. Give the loupe's surface
   * the same sampler and its readout is the color that click takes.
   */
  loupe?: LoupeModel;
  /** Called with the color under the pointer whenever it changes; `null`
   *  once the pointer is over nothing, or has left. */
  onColorChange?: (hex: string | null) => void;
  /** Called when a pick lands on a color. Where it goes is the consumer's. */
  onPick?: (hex: string) => void;
}

/** A color picker over a surface: the color under the pointer, and the pick. */
export interface EyedropperModel {
  /** The color under the last hover, `null` over nothing or before one. */
  readonly color: string | null;
  /** The pointer moved to `p`: sample it, and aim the loupe there. */
  hover(p: LoupePoint): void;
  /** The pointer left the surface. */
  leave(): void;
  /** Sample `p` and report it to `onPick`. Answers the color, or `null` where
   *  nothing is drawn, which reports nothing. */
  pick(p: LoupePoint): MaybePromise<string | null>;
  dispose(): void;
}

function isPromise<T>(v: MaybePromise<T>): v is Promise<T> {
  return typeof (v as { then?: unknown } | null)?.then === 'function';
}

/**
 * Build an eyedropper over a surface. Framework-free, like the loupe model
 * beside it, and drawing nothing: the consumer feeds it pointer points and
 * shows `color` however it likes.
 *
 * A sampler that answers asynchronously is fine: a hover answered after a
 * later one has started is dropped, so `color` is always the latest point's.
 */
export function createEyedropperModel(opts: EyedropperModelOptions): EyedropperModel {
  let color: string | null = null;
  let seq = 0;
  let disposed = false;

  const settle = (hex: string | null) => {
    if (hex === color) return;
    color = hex;
    opts.onColorChange?.(hex);
  };

  return {
    get color() { return color; },

    hover(p) {
      if (disposed) return;
      opts.loupe?.aimAt(p);
      const mine = ++seq;
      const got = opts.sample(p);
      if (!isPromise(got)) { settle(got); return; }
      void got.then((hex) => {
        if (!disposed && mine === seq) settle(hex);
      }, () => undefined);
    },

    leave() {
      if (disposed) return;
      ++seq;
      settle(null);
    },

    pick(p) {
      if (disposed) return null;
      const report = (hex: string | null) => {
        if (hex !== null && !disposed) opts.onPick?.(hex);
        return hex;
      };
      const got = opts.sample(p);
      return isPromise(got) ? got.then(report) : report(got);
    },

    dispose() {
      disposed = true;
      ++seq;
    },
  };
}
