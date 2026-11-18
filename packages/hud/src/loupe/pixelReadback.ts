import { createCanvasReader, regionOnCanvas } from '@weasel-js/core';
import { releaseImageSource, type DrawCommand } from '@weasel-js/core/renderer';
import type { HudContentCtx } from '../widget';

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

/** What a pixel-mode lens reads off its canvas's framebuffer: the picture it magnifies, and the color at a point. */
export interface PixelReadback {
  /** The lens interior: `backdrop`, then the last picture read back over it. */
  draw(ctx: HudContentCtx, backdrop: DrawCommand): DrawCommand[];
  /** The framebuffer's RGBA at `at`, or `null` when it cannot answer. */
  pixel(at: Point): ArrayLike<number> | null;
  /** A paint has landed: from now the framebuffer answers for this frame. */
  land(): void;
  /** Asks for the picture to be read again on a landed frame. */
  want(): void;
  /** Whether a landed frame should read the picture now: one is wanted and none is in flight. Clears the want. */
  due(): boolean;
  /** Reads the picture `width` × `height` CSS px around `aim`, shrunk by `factor`. */
  read(aim: Point, width: number, height: number, factor: number): void;
  dispose(): void;
}

/**
 * `surface` is the rect of `canvas` the lens's picture comes from, or undefined for the whole canvas.
 * `settled` hears each read finish, failed ones too: `later` says it was read back asynchronously, and the
 * color under the aim may have changed with it.
 */
export function createPixelReadback(
  canvas: HTMLCanvasElement, surface: () => Rect | undefined, settled: (later: boolean) => void,
): PixelReadback {
  const reader = createCanvasReader(canvas);
  let pixels: ImageBitmap | null = null;
  let pending = false;
  let wanted = false;
  let disposed = false;
  // Until a paint lands, the context on a shared canvas may not exist yet, and
  // opening it here would give every tenant one with no stencil buffer.
  let landed = false;

  const drop = () => {
    if (!pixels) return;
    releaseImageSource(pixels);
    pixels.close();
    pixels = null;
  };

  /** The device-px rect of the lens's region around `at`, or `null` when the framebuffer cannot answer. A
   *  view-backed lens knows its canvas, so over a detached pane it reads that pane's pixels without being told
   *  where the pane is. */
  const regionAt = (at: Point, rw: (dpr: number) => number, rh: (dpr: number) => number) =>
    (landed ? regionOnCanvas(canvas, surface(), at, rw, rh) : null);

  return {
    draw(ctx, backdrop) {
      // The backdrop paints even with a bitmap in hand: a readback of a
      // transparent framebuffer is transparent, and before the first one
      // settles there is nothing at all, either of which leaves the lens a
      // hole onto the unmagnified canvas.
      const out: DrawCommand[] = [backdrop];
      if (pixels) {
        out.push({
          kind: 'image',
          image: pixels,
          ...ctx.rect,
          sampling: 'nearest',
        });
      }
      return out;
    },
    pixel(at) {
      const region = regionAt(at, () => 1, () => 1);
      return region && reader.pixel(region);
    },
    land() { landed = true; },
    want() { if (!disposed) wanted = true; },
    due() {
      // A refresh wanted while a bitmap is in flight is remembered rather than
      // dropped: the flag survives until a frame finds it settled, so the aim
      // the user ends a fast drag on is the one that gets read.
      if (!wanted || pending) return false;
      wanted = false;
      return true;
    },
    read(aim, width, height, factor) {
      if (disposed) return;
      const region = regionAt(
        aim,
        (dpr) => Math.max(1, Math.round((width * dpr) / factor)),
        (dpr) => Math.max(1, Math.round((height * dpr) / factor)),
      );
      const data = region && reader.region(region);
      if (!data) return;
      pending = true;
      // A region read back later also holds the color under the aim.
      const later = data instanceof Promise;
      (later ? data.then((d) => createImageBitmap(d)) : createImageBitmap(data))
        .then((bmp) => {
          if (disposed) { bmp.close(); return; }
          drop();
          pixels = bmp;
          pending = false;
          settled(later);
        })
        .catch(() => { pending = false; settled(false); });
    },
    dispose() {
      disposed = true;
      drop();
    },
  };
}
