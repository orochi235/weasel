import { asNodeId, renderSceneToPixels } from '@weasel-js/core';
import { serializeSvg } from '@weasel-js/svg';
import { createMarkDrawOne, type MarkDrawOptions, resolveMarkStyle } from './drawOne';
import type { MarkScene } from './store';
import { markSvgNodes } from './svgNodes';
import type { AnnotationData, CaptureOptions, CaptureResult, CaptureSource } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Which of the two composition routes an export takes. */
export type CapturePlan = 'svg-document' | 'raster-stack';

/**
 * Vector all the way through, or both sides rasterized and stacked.
 *
 * An SVG base is the only one that nests: the marks serialize beside the
 * artifact's own markup and the whole document rasterizes once at the end. A
 * raster base, or none at all, takes the renderer's own path instead — which
 * is also what draws marks onto transparency for a target that declares no
 * base.
 */
export function capturePlan(base: CaptureSource | undefined, format: 'png' | 'svg'): CapturePlan {
  if (format === 'svg') return 'svg-document';
  return base?.kind === 'svg' ? 'svg-document' : 'raster-stack';
}

/** Re-frame a base's own `<svg>` onto the content box, keeping its `viewBox`.
 *  Parsed rather than string-spliced: a base whose declared width disagrees
 *  with its viewBox would otherwise land at the wrong scale. */
function nestBaseSvg(markup: string, w: number, h: number): string {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.getElementsByTagName('parsererror').length > 0 || root.localName !== 'svg') {
    throw new Error("[labkit] a target's `base()` returned markup that is not an <svg> document");
  }
  root.setAttribute('x', '0');
  root.setAttribute('y', '0');
  root.setAttribute('width', String(w));
  root.setAttribute('height', String(h));
  return new XMLSerializer().serializeToString(root);
}

/** A raster base as an `<image>` filling the content box. An external `src`
 *  round-trips as a reference, so the export is only self-contained when it
 *  is already a `data:` URI. */
function embedRasterBase(
  base: CaptureSource,
  w: number,
  h: number,
  onWarn?: (m: string) => void,
): string {
  const href =
    base.kind === 'canvas' ? base.canvas.toDataURL() : base.kind === 'image' ? base.src : '';
  if (base.kind === 'image' && !href.startsWith('data:')) {
    onWarn?.(`base image '${href}' is a reference, so this SVG is not self-contained`);
  }
  return serializeSvg([{ kind: 'image', href, x: 0, y: 0, width: w, height: h }], {
    viewBox: { x: 0, y: 0, width: w, height: h },
  });
}

/** Every mark on a scene, as SVG nodes, styled the way the pane styles them. */
function markNodesOf(scene: MarkScene, draw: MarkDrawOptions) {
  return [...scene.renderOrder()].flatMap((id) => {
    const node = scene.get(asNodeId(String(id)));
    if (!node) return [];
    return markSvgNodes(
      { pose: node.pose, data: node.data as AnnotationData },
      draw.content,
      resolveMarkStyle(node.data as AnnotationData, draw),
    );
  });
}

export interface ComposeSvgArgs {
  base?: CaptureSource;
  scene: MarkScene;
  draw: MarkDrawOptions;
  scale: number;
  onWarn?: (message: string) => void;
}

/**
 * The base and the marks in one SVG document.
 *
 * The outer `viewBox` is the content box, so marks — which are already in it —
 * need no transform, and `width`/`height` carry the export scale. Both halves
 * nest as child `<svg>` elements, which each establish their own viewport and
 * so keep their own `viewBox` maths out of this function.
 */
export function composeCaptureSvg(args: ComposeSvgArgs): string {
  const { base, scene, draw, scale, onWarn } = args;
  const { w, h } = draw.content;
  const baseXml =
    base === undefined
      ? ''
      : base.kind === 'svg'
        ? nestBaseSvg(base.markup, w, h)
        : embedRasterBase(base, w, h, onWarn);
  // No width/height on the marks document: a nested <svg> without them fills
  // the outer viewport exactly, which is the alignment this relies on.
  const marksXml = serializeSvg(markNodesOf(scene, draw), {
    viewBox: { x: 0, y: 0, width: w, height: h },
    onWarn,
  });
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  return `<svg xmlns="${SVG_NS}" width="${outW}" height="${outH}" viewBox="0 0 ${w} ${h}">${baseXml}${marksXml}</svg>`;
}

function context2d(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[labkit] capture needs a 2D canvas context, and this one has none');
  return ctx;
}

function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let done: (b: Blob | null) => void;
    try {
      done = (blob) =>
        blob ? resolve(blob) : reject(new Error('[labkit] the browser produced no PNG'));
      canvas.toBlob(done, 'image/png');
    } catch (err) {
      // A base referencing an image from another origin taints the canvas and
      // `toBlob` throws SecurityError. Name the cause: the DOM exception on
      // its own sends people looking at labkit.
      reject(
        new Error(
          '[labkit] the capture canvas is tainted, so it cannot be read back — a base referencing a cross-origin image does this. Embed it as a data: URI.',
          { cause: err },
        ),
      );
    }
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`[labkit] a capture base failed to load: ${src}`));
    img.src = src;
  });
}

/** Rasterize a composed document by handing it to the browser's own SVG
 *  renderer — one pass over base and marks together. */
async function rasterizeSvg(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await loadImage(url);
    const ctx = context2d(width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return await toPngBlob(ctx.canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Base pixels, then mark pixels over them. The marks come from
 *  `renderSceneToPixels` rather than a readback of the live surface, so a
 *  capture neither depends on nor disturbs what is on screen. */
async function stackRaster(
  args: ComposeSvgArgs & { width: number; height: number },
): Promise<Blob> {
  const { base, scene, draw, scale, width, height } = args;
  const ctx = context2d(width, height);
  if (base?.kind === 'image') ctx.drawImage(await loadImage(base.src), 0, 0, width, height);
  else if (base?.kind === 'canvas') ctx.drawImage(base.canvas, 0, 0, width, height);

  const raster = renderSceneToPixels({
    scene,
    sourceRect: { x: 0, y: 0, width: draw.content.w, height: draw.content.h },
    scale: { x: scale, y: scale },
    drawOne: createMarkDrawOne(draw),
  });
  // Through a second canvas rather than `putImageData` on this one, which
  // replaces pixels instead of compositing and would erase the base.
  const marks = context2d(raster.width, raster.height);
  marks.putImageData(
    new ImageData(Uint8ClampedArray.from(raster.data), raster.width, raster.height),
    0,
    0,
  );
  ctx.drawImage(marks.canvas, 0, 0, width, height);
  return toPngBlob(ctx.canvas);
}

/** What a capture needs about the target it is exporting. */
export interface CaptureArgs {
  target: string;
  scene: MarkScene;
  draw: MarkDrawOptions;
  base?: () => CaptureSource | Promise<CaptureSource>;
  onWarn?: (message: string) => void;
}

/** Export one target's picture with its marks on it. */
export async function captureTarget(
  args: CaptureArgs,
  opts: CaptureOptions = {},
): Promise<CaptureResult> {
  const format = opts.format ?? 'png';
  const scale = opts.scale ?? 2;
  const { content } = args.draw;
  const width = Math.max(1, Math.round(content.w * scale));
  const height = Math.max(1, Math.round(content.h * scale));
  const base = await args.base?.();
  const compose: ComposeSvgArgs = {
    base,
    scene: args.scene,
    draw: args.draw,
    scale,
    onWarn: args.onWarn,
  };

  if (capturePlan(base, format) === 'raster-stack') {
    return {
      target: args.target,
      blob: await stackRaster({ ...compose, width, height }),
      format,
      width,
      height,
    };
  }

  const svg = composeCaptureSvg(compose);
  const blob =
    format === 'svg'
      ? new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      : await rasterizeSvg(svg, width, height);
  return { target: args.target, blob, format, width, height };
}
