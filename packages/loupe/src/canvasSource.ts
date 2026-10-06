import { type LoupePoint, type LoupeSize, loupeExtent } from './geometry';

/** A canvas whose pixels a loupe can read. */
export type SourceCanvas = HTMLCanvasElement | OffscreenCanvas;

/** A rendering context on a {@link SourceCanvas}. Passing one, rather than the
 *  bare canvas, is what tells a source whether the canvas keeps its pixels. */
export type SourceContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D
  | WebGLRenderingContext
  | WebGL2RenderingContext
  | ImageBitmapRenderingContext;

/** Where a source canvas's pixels sit on the surface being magnified, in that
 *  surface's CSS px. The backing store is stretched over this box, so its
 *  width against the canvas's own `width` is the device-pixel ratio. */
export interface SourceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Options for {@link createCanvasSource}. */
export interface CanvasSourceOptions {
  /**
   * Called when a reader starts and there is no current frame to read: draw
   * the canvas again, and call `capture()` after it. Only needed by a canvas
   * that is captured and does not redraw every frame on its own — without it
   * such a lens stays empty until the next redraw.
   */
  requestRedraw?: () => void;
  /** Where the canvas sits on the magnified surface. Omitted, a reader works
   *  it out — a painter over the DOM measures the canvas's own box. */
  box?: () => SourceBox | null;
}

/**
 * Any canvas, as something a loupe reads pixels from: 2D, WebGL or WebGL2,
 * on the page or offscreen, owned by whoever drew it.
 *
 * A WebGL canvas made without `preserveDrawingBuffer` is cleared once the
 * browser composites it, so reading it from any later task — the lens's own
 * frame — returns nothing. Such a source is *captured*: whoever draws the
 * canvas calls {@link capture} right after drawing, in the same task, and the
 * source copies the frame while it still exists. Every other canvas holds its
 * pixels and is read directly.
 */
export interface CanvasSource {
  readonly canvas: SourceCanvas;
  /**
   * Whether frames reach readers only through {@link capture}. True for a
   * source made from a WebGL context without `preserveDrawingBuffer`, and for
   * any source once `capture()` has been called on it.
   */
  readonly captured: boolean;
  readonly box?: () => SourceBox | null;
  /**
   * Copy the frame just drawn. Call it in the same task as the draw — right
   * after `gl.drawArrays`, `renderer.render(...)` or whatever finished the
   * frame. Free while nothing is reading: it copies only while a reader holds
   * the source.
   */
  capture(): void;
  /** The pixels to read now: the last capture, or the canvas itself when it
   *  keeps its own. `null` while a captured source has no current frame. */
  frame(): CanvasImageSource | null;
  /** Hex color of the backing-store pixel at `p` (device px, not CSS px), or
   *  `null` where it is transparent, off the canvas, or there is no frame. */
  sample(p: LoupePoint): string | null;
  /** Start reading. While any reader holds the source, `capture` copies;
   *  returns the release. */
  retain(): () => void;
  /** Run `fn` after each capture lands; returns an unsubscribe. */
  subscribeFrame(fn: () => void): () => void;
}

/** A frame read this many times with no capture behind it means the drawing
 *  code is not calling `capture()`. About two seconds of lens frames. */
const MISSED_FRAMES_BEFORE_WARNING = 120;

function isWebGL(ctx: SourceContext): ctx is WebGLRenderingContext | WebGL2RenderingContext {
  return 'drawArrays' in ctx;
}

function isContext(target: SourceCanvas | SourceContext): target is SourceContext {
  return 'canvas' in target && !('getContext' in target);
}

function makeCanvas(width: number, height: number): SourceCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function context2d(canvas: SourceCanvas, willReadFrequently = false): Ctx2D | null {
  return canvas.getContext('2d', { willReadFrequently }) as Ctx2D | null;
}

/**
 * Make a {@link CanvasSource} for a canvas, or for a context on one.
 *
 * Pass the context when there is one: a WebGL context without
 * `preserveDrawingBuffer` is then known to need capturing before anything has
 * gone blank. A bare canvas is read directly until `capture()` is first
 * called on it. The source never calls `getContext` on the canvas it reads —
 * on a canvas with no context yet, that would create one with the wrong
 * attributes and leave whoever draws it unable to get theirs.
 */
export function createCanvasSource(
  target: SourceCanvas | SourceContext,
  options: CanvasSourceOptions = {},
): CanvasSource {
  const canvas = (isContext(target) ? target.canvas : target) as SourceCanvas;
  const mustCapture =
    isContext(target) && isWebGL(target) && !target.getContextAttributes()?.preserveDrawingBuffer;

  let captured = mustCapture;
  let readers = 0;
  let snapshot: SourceCanvas | null = null;
  let current = false;
  let missed = 0;
  let warned = false;
  let probe: Ctx2D | null = null;
  const listeners = new Set<() => void>();

  const source: CanvasSource = {
    canvas,
    get captured() {
      return captured;
    },
    box: options.box,

    capture() {
      captured = true;
      if (readers === 0) return;
      const { width, height } = canvas;
      if (width === 0 || height === 0) return;
      if (!snapshot) snapshot = makeCanvas(width, height);
      else if (snapshot.width !== width || snapshot.height !== height) {
        snapshot.width = width;
        snapshot.height = height;
      }
      const ctx = context2d(snapshot);
      if (!ctx) return;
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(canvas, 0, 0);
      current = true;
      missed = 0;
      for (const fn of listeners) fn();
    },

    frame() {
      if (!captured) return canvas.width > 0 && canvas.height > 0 ? canvas : null;
      if (current && snapshot) return snapshot;
      if (!warned && ++missed >= MISSED_FRAMES_BEFORE_WARNING) {
        warned = true;
        console.warn(
          '[weasel loupe] A WebGL canvas without preserveDrawingBuffer is being read, ' +
            'and nothing has called capture() on its source. Call source.capture() right ' +
            'after drawing each frame, or pass requestRedraw if the canvas draws on demand.',
        );
      }
      return null;
    },

    sample(p) {
      const frame = source.frame();
      if (!frame) return null;
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null;
      if (!probe) {
        const c = makeCanvas(1, 1);
        probe = context2d(c, true);
        if (!probe) return null;
      }
      probe.globalCompositeOperation = 'copy';
      probe.drawImage(frame, x, y, 1, 1, 0, 0, 1, 1);
      const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
      if (a === 0) return null;
      return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
    },

    retain() {
      readers++;
      if (readers === 1 && captured) {
        // Whatever was copied before the last reader left may be long stale.
        current = false;
        options.requestRedraw?.();
      }
      let held = true;
      return () => {
        if (!held) return;
        held = false;
        readers--;
      };
    },

    subscribeFrame(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
  return source;
}

/**
 * The rectangle of `source`'s backing store a lens of `size` CSS px
 * magnifying `factor` times about `aim` shows, in device px. `box` is where
 * the canvas sits in the same CSS px as `aim`; the scale between the two is
 * measured per axis, so a canvas stretched unevenly is read correctly too.
 */
export function sourceRegion(
  aim: LoupePoint,
  factor: number,
  size: LoupeSize,
  box: SourceBox,
  backing: { width: number; height: number },
): { sx: number; sy: number; sw: number; sh: number } {
  const { width, height } = loupeExtent(size);
  const spanX = width / factor;
  const spanY = height / factor;
  const kx = box.width > 0 ? backing.width / box.width : 1;
  const ky = box.height > 0 ? backing.height / box.height : 1;
  return {
    sx: (aim.x - spanX / 2 - box.x) * kx,
    sy: (aim.y - spanY / 2 - box.y) * ky,
    sw: spanX * kx,
    sh: spanY * ky,
  };
}

/** A surface point in CSS px, as the backing-store pixel of a canvas laid
 *  over `box` that it lands on. */
export function sourcePixel(
  p: LoupePoint,
  box: SourceBox,
  backing: { width: number; height: number },
): LoupePoint {
  const kx = box.width > 0 ? backing.width / box.width : 1;
  const ky = box.height > 0 ? backing.height / box.height : 1;
  return { x: (p.x - box.x) * kx, y: (p.y - box.y) * ky };
}
