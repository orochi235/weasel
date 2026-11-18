import { layoutBoxOf } from '@weasel-js/core';
import {
  type CanvasSource,
  createCanvasSource,
  type LoupePoint,
  type LoupeSize,
  loupeExtent,
  type SourceCanvas,
  type SourceContext,
  sourceRegion,
} from '@weasel-js/loupe';
import { createPart } from '@weasel-js/registry';
import type { Rect } from '@weasel-js/geom';

/** Anything a lens can be pointed at for its pixels: a `CanvasSource`, a
 *  canvas, or a context on one. */
export type LoupeSourceTarget = CanvasSource | SourceCanvas | SourceContext;
/** A {@link LoupeSourceTarget}, or a function returning one once it exists. */
export type LoupeSource = LoupeSourceTarget | (() => LoupeSourceTarget | null | undefined);

function isCanvasSource(t: LoupeSourceTarget): t is CanvasSource {
  return 'capture' in t && 'retain' in t;
}

// One source per canvas or context, so a getter returning the same canvas
// every frame keeps one snapshot rather than minting a new one per call.
const made = createPart((target: SourceCanvas | SourceContext) => createCanvasSource(target));

/** `source` as a `CanvasSource`, or `null` while a getter has nothing yet. */
export function resolveLoupeSource(source: LoupeSource | undefined): CanvasSource | null {
  if (!source) return null;
  const target = typeof source === 'function' ? source() : source;
  if (!target) return null;
  if (isCanvasSource(target)) return target;
  return made(target);
}

/**
 * Where a source canvas sits over the lens's host, in the host's CSS px: its
 * own `box` if it has one, else the canvas's laid-out box measured against the
 * host, else — for an offscreen canvas, or one not on the page — the whole
 * host.
 */
export function sourceBoxIn(source: CanvasSource, host: HTMLElement | null): Rect {
  const own = source.box?.();
  if (own) return own;
  // Client px over the host's own scale: a zoomed stage or a scaled ancestor shows it larger than it lays out.
  const box = host ? layoutBoxOf(host) : null;
  const c = source.canvas;
  if (typeof HTMLCanvasElement !== 'undefined' && c instanceof HTMLCanvasElement && c.isConnected) {
    const r = c.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      const scale = box?.scale ?? { x: 1, y: 1 };
      return {
        x: (r.left - (box?.left ?? 0)) / scale.x,
        y: (r.top - (box?.top ?? 0)) / scale.y,
        width: r.width / scale.x,
        height: r.height / scale.y,
      };
    }
  }
  return { x: 0, y: 0, width: box?.width ?? c.width, height: box?.height ?? c.height };
}

/** Enlarge the pixels of `source` around `aim` into a lens' own canvas, with
 *  smoothing off. Leaves the lens clear while the source has no frame. */
export function drawSourceLens(
  ctx: CanvasRenderingContext2D,
  opts: {
    aim: LoupePoint;
    factor: number;
    diameter: LoupeSize;
    dpr: number;
    source: CanvasSource;
    box: Rect;
  },
): void {
  const { aim, factor, diameter, dpr, source, box } = opts;
  const { width, height } = loupeExtent(diameter);
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const frame = source.frame();
  if (frame) {
    const { sx, sy, sw, sh } = sourceRegion(aim, factor, diameter, box, source.canvas);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, width, height);
  }
  ctx.restore();
}
