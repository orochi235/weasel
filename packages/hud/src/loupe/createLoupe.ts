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

export type LoupeMode = 'vector' | 'pixel';

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

export function createLoupe(opts: LoupeOptions): LoupeHandle {
  const { hud, element, source, requestRedraw } = opts;
  let mode: LoupeMode = opts.mode ?? 'vector';
  let factor = opts.factor ?? 8;
  let aim = { x: 0, y: 0 };
  let color: string | null = null;
  let pixels: ImageBitmap | null = null;
  let pixelsPending = false;

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
    if (mode !== 'pixel' || pixelsPending) return;
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
    createImageBitmap(data)
      .then((bmp) => {
        pixels?.close();
        pixels = bmp;
        pixelsPending = false;
        requestRedraw();
      })
      .catch(() => { pixelsPending = false; });
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
      element.removeEventListener('pointermove', onPointerMove);
      pixels?.close();
      pixels = null;
      win.dispose();
    },
  };
}
