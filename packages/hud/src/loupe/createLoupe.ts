import {
  createViewportLayer, screenToWorld, viewToTransform,
  type RenderLayer, type View,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { Hud } from '../hud';
import type { WindowWidget } from '../widgets/window/window';
import type { HudContentCtx, WidgetBounds } from '../widget';
import { loupeInnerView } from './innerView';
import { readbackRegion } from './readback';

/** How a loupe magnifies. `'vector'` re-renders the source layers through a
 *  zoomed-in view, so content stays sharp at any factor; `'pixel'` reads the
 *  framebuffer back and blows up the actual pixels. */
export type LoupeMode = 'vector' | 'pixel';

/** Options for `createLoupe`. */
export interface LoupeOptions {
  hud: Hud;
  /** The live canvas. Supplies the GL context for pixel mode and the pointer
   *  feed for aiming. */
  element: HTMLCanvasElement;
  /** Layers re-rendered through the magnified inner view in vector mode. */
  source: RenderLayer<unknown>[];
  requestRedraw: () => void;
  mode?: LoupeMode;
  factor?: number;
  bounds?: WidgetBounds;
  title?: string;
  /** Draw the window's titlebar and close box. Default `true`. Pass `false`
   *  for a bare lens; the interior then doubles as the move handle. */
  titlebar?: boolean;
  /** Called with the hex color under the aim point whenever it changes.
   *  Sampled from the framebuffer in both modes — vector content is a
   *  re-render whose edge colors differ from the screen's, so reading the
   *  color off it would report something the user cannot see. */
  onColorChange?: (hex: string) => void;
  /** Fired by the window's close box. The window does not hide itself —
   *  whoever owns the loupe's visibility decides what closing means. */
  onClose?: () => void;
  /** Opaque backdrop behind vector content, so the outer canvas does not
   *  show through where the inner view is empty. */
  background?: string;
}

/** Control surface for a live loupe: where it is aimed, how it magnifies,
 *  what color it is over, and the window it lives in. */
export interface LoupeHandle {
  readonly window: WindowWidget;
  readonly mode: LoupeMode;
  readonly factor: number;
  /** Last aimed point, in screen-space CSS px relative to the canvas. */
  readonly aim: { x: number; y: number };
  /** Hex color under the aim point, read off the framebuffer. `null` before
   *  the first aim, or when the GL context is unavailable. */
  readonly color: string | null;
  setMode(mode: LoupeMode): void;
  setFactor(factor: number): void;
  /** Aim at a screen point. Ignored while the point is over the window —
   *  that is the freeze rule that makes the borders reachable. */
  aimAt(p: { x: number; y: number }): void;
  dispose(): void;
}

/**
 * Build a magnifier: a HUD window whose interior shows the canvas around an
 * aim point, enlarged. Adds the window to the HUD and starts following the
 * pointer; `dispose` removes it again.
 */
export function createLoupe(opts: LoupeOptions): LoupeHandle {
  const { hud, element, source, requestRedraw } = opts;
  let mode: LoupeMode = opts.mode ?? 'vector';
  let factor = opts.factor ?? 8;
  let aim = { x: 0, y: 0 };
  let color: string | null = null;
  let pixels: ImageBitmap | null = null;
  let pixelsPending = false;
  let pixelsStale = false;
  let disposed = false;

  const b = opts.bounds ?? { x: 24, y: 24, w: 220, h: 200 };

  const content = (ctx: HudContentCtx): DrawCommand[] =>
    mode === 'vector' ? drawVector(ctx) : drawPixels(ctx);

  const drawVector = (ctx: HudContentCtx): DrawCommand[] => {
    const world = screenToWorld(aim.x, aim.y, viewToTransform(ctx.view));
    const inner: View = loupeInnerView(
      { x: world[0], y: world[1] }, ctx.view, ctx.rect, factor,
    );
    // A fresh lens per frame: CreateViewportLayerOpts.view is static, and the
    // inner view moves with the pointer.
    const lens = createViewportLayer<unknown>({
      id: `${win.id}:lens`,
      label: 'Loupe content',
      source,
      view: inner,
      bounds: () => ctx.rect,
      background: opts.background ?? ctx.tokens['--wzl-surface'],
    });
    return lens.draw(ctx.data, ctx.view, ctx.dims);
  };

  const drawPixels = (ctx: HudContentCtx): DrawCommand[] => {
    if (!pixels) return [];
    return [{
      kind: 'image',
      image: pixels,
      x: ctx.rect.x, y: ctx.rect.y, w: ctx.rect.w, h: ctx.rect.h,
      sampling: 'nearest',
    }];
  };

  const refreshPixels = () => {
    if (disposed || mode !== 'pixel') return;
    // A readback requested mid-flight is remembered rather than dropped: the
    // aim that arrives during a fast drag is the one the user ends on.
    if (pixelsPending) { pixelsStale = true; return; }
    const gl = element.getContext('webgl2');
    if (!gl) return;
    const cssRect = element.getBoundingClientRect();
    if (cssRect.width === 0) return;
    const dpr = element.width / cssRect.width;
    const rect = win.contentRect;
    const rw = Math.max(1, Math.round((rect.w * dpr) / factor));
    const rh = Math.max(1, Math.round((rect.h * dpr) / factor));
    const data = readbackRegion(
      gl, { width: element.width, height: element.height }, aim, dpr, rw, rh,
    );
    pixelsPending = true;
    pixelsStale = false;
    createImageBitmap(data)
      .then((bmp) => {
        if (disposed) { bmp.close(); return; }
        pixels?.close();
        pixels = bmp;
        pixelsPending = false;
        requestRedraw();
        if (pixelsStale) refreshPixels();
      })
      .catch(() => {
        pixelsPending = false;
        if (pixelsStale) refreshPixels();
      });
  };

  const sampleColor = () => {
    const gl = element.getContext('webgl2');
    if (!gl) return;
    const cssRect = element.getBoundingClientRect();
    if (cssRect.width === 0) return;
    const dpr = element.width / cssRect.width;
    const px = readbackRegion(
      gl, { width: element.width, height: element.height }, aim, dpr, 1, 1,
    );
    const hex = '#' + [px.data[0], px.data[1], px.data[2]]
      .map((c) => c.toString(16).padStart(2, '0')).join('');
    if (hex !== color) {
      color = hex;
      opts.onColorChange?.(hex);
    }
  };

  const win = hud.window({
    id: 'weasel-loupe',
    x: b.x, y: b.y, w: b.w, h: b.h,
    title: opts.title ?? 'Loupe',
    titlebar: opts.titlebar,
    content,
    onResize: () => { refreshPixels(); },
    ...(opts.onClose ? { onClose: opts.onClose } : {}),
  });

  const onPointerMove = (evt: PointerEvent) => {
    const r = element.getBoundingClientRect();
    handleAim({ x: evt.clientX - r.left, y: evt.clientY - r.top });
  };

  const handleAim = (p: { x: number; y: number }) => {
    if (win.hidden) return;
    if (win.hitTest(p.x, p.y)) return;   // freeze rule
    aim = p;
    sampleColor();
    if (mode === 'pixel') refreshPixels();
    requestRedraw();
  };

  element.addEventListener('pointermove', onPointerMove);

  return {
    window: win,
    get mode() { return mode; },
    get factor() { return factor; },
    get aim() { return aim; },
    get color() { return color; },
    setMode(next) {
      if (next === mode) return;
      mode = next;
      if (mode === 'pixel') refreshPixels();
      requestRedraw();
    },
    setFactor(next) {
      factor = next;
      if (mode === 'pixel') refreshPixels();
      requestRedraw();
    },
    aimAt: handleAim,
    dispose() {
      disposed = true;
      element.removeEventListener('pointermove', onPointerMove);
      pixels?.close();
      pixels = null;
      win.dispose();
    },
  };
}
