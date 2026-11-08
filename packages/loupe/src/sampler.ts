import { rgbaHex } from '@weasel-js/paint';
import type { CanvasSource, SourceBox } from './canvasSource';
import type { LoupePoint } from './geometry';

/** One pixel's RGBA bytes, each 0 to 255. */
export type Rgba = readonly [number, number, number, number];

/** A pixel read now, or one a source answers later: a WebGPU readback is
 *  only ever asynchronous. */
export type MaybePromise<T> = T | Promise<T>;

/**
 * One layer of a picture a {@link Sampler} reads: what it drew at a surface
 * point, in that surface's CSS px.
 */
export interface PixelSource {
  /** The RGBA this source drew at `p`, or `null` where it drew nothing or
   *  cannot say. Straight alpha unless {@link premultiplied}. */
  pixel(p: LoupePoint): MaybePromise<ArrayLike<number> | null>;
  /** The bytes are premultiplied by their alpha, as a WebGL readback's are. */
  premultiplied?: boolean;
}

/** What color a picture is at a point. */
export interface Sampler {
  /** The RGBA a viewer sees at `p` (straight alpha), or `null` where nothing
   *  is drawn. A promise only when a source it had to read answered with one. */
  rgba(p: LoupePoint): MaybePromise<Rgba | null>;
  /** {@link rgba} as `#rrggbb`. */
  sample(p: LoupePoint): MaybePromise<string | null>;
}

/** A source's bytes as premultiplied 0..1 channels. */
function premultipliedOf(px: ArrayLike<number>, premultiplied: boolean): [number, number, number, number] {
  const a = px[3] / 255;
  const k = premultiplied ? 1 / 255 : a / 255;
  return [px[0] * k, px[1] * k, px[2] * k, a];
}

/** What is left to see through once the stack above has covered this much. */
const OPAQUE = 1 - 0.5 / 255;

/**
 * Composite pixels source-over, top first: `stack[0]` is the topmost layer.
 * The result is what a viewer sees with nothing behind the stack — straight
 * RGBA, `null` where every layer is transparent. `premultiplied` names, per
 * layer, whether its bytes are premultiplied.
 */
export function compositeOver(
  stack: readonly (ArrayLike<number> | null)[],
  premultiplied: readonly boolean[] = [],
): Rgba | null {
  const acc = [0, 0, 0, 0];
  for (let i = 0; i < stack.length && acc[3] < OPAQUE; i++) {
    const px = stack[i];
    if (!px || px[3] === 0) continue;
    accumulate(acc, px, premultiplied[i] === true);
  }
  return finish(acc);
}

/** Lay `px` beneath what `acc` has gathered so far. */
function accumulate(acc: number[], px: ArrayLike<number>, premultiplied: boolean): void {
  const s = premultipliedOf(px, premultiplied);
  const under = 1 - acc[3];
  for (let c = 0; c < 4; c++) acc[c] += s[c] * under;
}

function finish(acc: readonly number[]): Rgba | null {
  const a = acc[3];
  if (a <= 0) return null;
  const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return [byte(acc[0] / a), byte(acc[1] / a), byte(acc[2] / a), byte(a)];
}

function isPromise<T>(v: MaybePromise<T>): v is Promise<T> {
  return typeof (v as { then?: unknown } | null)?.then === 'function';
}

/**
 * A sampler over an ordered stack of sources, listed bottom first as a stack
 * of layers is. It reads from the top down and stops at the first point the
 * layers above have made opaque, so the sources beneath are not read at all;
 * translucent layers composite source-over onto whatever lies under them.
 *
 * It answers at once while every source it reads does, and with a promise from
 * the first source that answers with one.
 */
export function createSampler(sources: readonly PixelSource[] | (() => readonly PixelSource[])): Sampler {
  const stackOf = typeof sources === 'function' ? sources : () => sources;

  const rgba = (p: LoupePoint): MaybePromise<Rgba | null> => {
    const stack = stackOf();
    const acc = [0, 0, 0, 0];
    const from = (i: number): MaybePromise<Rgba | null> => {
      for (; i >= 0 && acc[3] < OPAQUE; i--) {
        const source = stack[i];
        const px = source.pixel(p);
        if (isPromise(px)) {
          const at = i;
          return px.then((got) => {
            if (got && got[3] !== 0) accumulate(acc, got, source.premultiplied === true);
            return from(at - 1);
          });
        }
        if (px && px[3] !== 0) accumulate(acc, px, source.premultiplied === true);
      }
      return finish(acc);
    };
    return from(stack.length - 1);
  };

  return {
    rgba,
    sample(p) {
      const got = rgba(p);
      return isPromise(got) ? got.then((c) => (c ? rgbaHex(c) : null)) : got ? rgbaHex(got) : null;
    },
  };
}

/**
 * A canvas source as one layer of a sampled picture: a surface point in CSS
 * px lands on the backing-store pixel of the canvas laid over `box`, scaled
 * per axis, so a canvas stretched unevenly is read correctly too. Nothing is
 * read while `box` answers `null`.
 */
export function canvasPixelSource(source: CanvasSource, box: () => SourceBox | null): PixelSource {
  return {
    pixel(p) {
      const b = box();
      if (!b) return null;
      const { width, height } = source.canvas;
      const kx = b.width > 0 ? width / b.width : 1;
      const ky = b.height > 0 ? height / b.height : 1;
      return source.pixel({ x: (p.x - b.x) * kx, y: (p.y - b.y) * ky });
    },
  };
}
