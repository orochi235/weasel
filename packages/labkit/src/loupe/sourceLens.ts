import {
  type CanvasSource,
  createCanvasSource,
  type LoupePoint,
  type SourceBox,
  type SourceCanvas,
  type SourceContext,
  sourcePixel,
  sourceRegion,
} from '@weasel-js/loupe';

/** Anything a lens can be pointed at for its pixels: a `CanvasSource`, a
 *  canvas, a context on one, or a function returning any of those once it
 *  exists. */
export type LoupeSourceTarget = CanvasSource | SourceCanvas | SourceContext;
export type LoupeSource = LoupeSourceTarget | (() => LoupeSourceTarget | null | undefined);

function isCanvasSource(t: LoupeSourceTarget): t is CanvasSource {
  return 'capture' in t && 'retain' in t;
}

// One source per canvas or context, so a getter returning the same canvas
// every frame keeps one snapshot rather than minting a new one per call.
const made = new WeakMap<object, CanvasSource>();

/** `source` as a `CanvasSource`, or `null` while a getter has nothing yet. */
export function resolveLoupeSource(source: LoupeSource | undefined): CanvasSource | null {
  if (!source) return null;
  const target = typeof source === 'function' ? source() : source;
  if (!target) return null;
  if (isCanvasSource(target)) return target;
  let s = made.get(target);
  if (!s) {
    s = createCanvasSource(target);
    made.set(target, s);
  }
  return s;
}

/**
 * Where a source canvas sits over the lens's host, in the host's CSS px: its
 * own `box` if it has one, else the canvas's laid-out box measured against the
 * host, else — for an offscreen canvas, or one not on the page — the whole
 * host.
 */
export function sourceBoxIn(source: CanvasSource, host: HTMLElement | null): SourceBox {
  const own = source.box?.();
  if (own) return own;
  const hostRect = host?.getBoundingClientRect();
  const c = source.canvas;
  if (typeof HTMLCanvasElement !== 'undefined' && c instanceof HTMLCanvasElement && c.isConnected) {
    const r = c.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return {
        x: r.left - (hostRect?.left ?? 0),
        y: r.top - (hostRect?.top ?? 0),
        width: r.width,
        height: r.height,
      };
    }
  }
  return { x: 0, y: 0, width: hostRect?.width ?? c.width, height: hostRect?.height ?? c.height };
}

/** The color a source shows at a host point, or `null` where it shows none. */
export function sampleSource(
  source: CanvasSource,
  p: LoupePoint,
  box: SourceBox,
): string | null {
  return source.sample(sourcePixel(p, box, source.canvas));
}

/** Enlarge the pixels of `source` around `aim` into a lens' own canvas, with
 *  smoothing off. Leaves the lens clear while the source has no frame. */
export function drawSourceLens(
  ctx: CanvasRenderingContext2D,
  opts: {
    aim: LoupePoint;
    factor: number;
    diameter: number;
    dpr: number;
    source: CanvasSource;
    box: SourceBox;
  },
): void {
  const { aim, factor, diameter, dpr, source, box } = opts;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, diameter, diameter);
  const frame = source.frame();
  if (frame) {
    const { sx, sy, sw, sh } = sourceRegion(aim, factor, diameter, box, source.canvas);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, diameter, diameter);
  }
  ctx.restore();
}
