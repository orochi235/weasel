import {
  createViewportLayer, screenToWorld, viewToTransform,
  type CanvasViewHandle, type RenderLayer, type SceneCanvasApi, type View,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import {
  createLoupeModel, loupeInnerView,
  type LoupeMode, type LoupeModel, type LoupeSurface,
} from '@weasel-js/loupe';
import type { Hud } from '../hud';
import type { WindowWidget } from '../widgets/window/window';
import type { HudContentCtx, WidgetBounds } from '../widget';
import { readbackRegion } from './readback';

export type { LoupeMode };

/** Options for `createLoupe` shared by a plain lens and an interactive one. */
export interface LoupeBaseOptions {
  hud: Hud;
  /** The canvas pixel mode reads back from. Supplies the GL context and the
   *  drawing-buffer dimensions. */
  canvas: HTMLCanvasElement;
  /** Where the aim comes from: the element pointer events are taken from and
   *  the rect client coords are measured against. Defaults to `canvas`, which
   *  is right whenever the canvas is also the thing under the pointer. */
  input?: HTMLElement;
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
  /** Fired when a click inside the lens picks a color — an eyedropper on the
   *  magnified surface. Where the color goes is the consumer's: the loupe
   *  reports the pick and nothing else. An `interactive` lens gives its clicks
   *  to the canvas, so only `pick()` reaches this. */
  onPick?: (hex: string) => void;
  /** Fired by the window's close box. The window does not hide itself —
   *  whoever owns the loupe's visibility decides what closing means. */
  onClose?: () => void;
  /** Backdrop painted behind the magnified content in both modes, so the
   *  outer canvas does not show through where the lens is empty. Defaults to
   *  the theme's surface color. */
  background?: string;
}

/** Options for `createLoupe`. */
export type LoupeOptions = LoupeBaseOptions & (
  | {
      /** Layers re-rendered through the magnified inner view in vector mode. */
      source: RenderLayer<unknown>[];
      views?: undefined;
      interactive?: false;
    }
  | {
      /**
       * The canvas, as a host for views. The lens becomes a view on it: vector
       * mode paints the canvas's own stack — scene and selection chrome — and
       * the lens can take input. It magnifies the canvas's own camera; aimed
       * over another view, it shows the canvas's world, not that view's.
       */
      views: Pick<SceneCanvasApi, 'addView'>;
      /** Narrows what vector mode paints. Defaults to the canvas's stack. */
      source?: RenderLayer<unknown>[];
      /**
       * Route input inside the lens to what it shows: a press selects the node
       * magnified under the pointer, and a drag moves it by the pointer travel
       * divided by the magnification. Default `false` — the window keeps its
       * interior, and a click there picks a color.
       */
      interactive?: boolean;
    }
);

/** Where an interactive lens routes while its window is hidden: nowhere. */
const NO_RECT = { x: 0, y: 0, w: 0, h: 0 };

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
  /** Sample the color the lens is showing at `p` — a screen point inside the
   *  lens — and report it to `onPick`. Omit `p` to pick at the aim point.
   *  Returns the hex, or `null` when the framebuffer cannot answer for that
   *  point. Leaves the aim, and `color`, alone. */
  pick(p?: { x: number; y: number }): string | null;
  dispose(): void;
}

/**
 * Build a magnifier: a HUD window whose interior shows the canvas around an
 * aim point, enlarged. Adds the window to the HUD and starts following the
 * pointer; `dispose` removes it again.
 */
export function createLoupe(opts: LoupeOptions): LoupeHandle {
  const { hud, canvas: element, requestRedraw } = opts;
  const host = opts.views;
  const interactive = host !== undefined && opts.interactive === true;
  const input = opts.input ?? element;
  let lens: CanvasViewHandle | null = null;
  // Set while a gesture that began over the window is held: the lens camera
  // follows the aim, so re-aiming mid-drag would move the world under it.
  let holding = false;
  let pixels: ImageBitmap | null = null;
  let pixelsPending = false;
  let refreshWanted = false;
  let disposed = false;

  const b = opts.bounds ?? { x: 24, y: 24, w: 220, h: 200 };

  const content = (ctx: HudContentCtx): DrawCommand[] =>
    model.mode === 'vector' ? drawVector(ctx) : drawPixels(ctx);

  const backdropColor = (ctx: HudContentCtx): string =>
    opts.background ?? ctx.tokens['--wzl-surface'];

  const backdrop = (ctx: HudContentCtx): DrawCommand => ({
    kind: 'path',
    path: { kind: 'rect', x: ctx.rect.x, y: ctx.rect.y, width: ctx.rect.w, height: ctx.rect.h },
    fill: { fill: 'solid', color: backdropColor(ctx) },
  });

  const innerView = (outer: View, rect: WidgetBounds): View => {
    const world = screenToWorld(model.aim.x, model.aim.y, viewToTransform(outer));
    return loupeInnerView({ x: world[0], y: world[1] }, outer, rect, model.factor);
  };

  const drawVector = (ctx: HudContentCtx): DrawCommand[] => {
    if (host) return lens ? [backdrop(ctx), ...lens.draw(ctx.data, ctx.view, ctx.dims)] : [backdrop(ctx)];
    // A fresh lens per frame: CreateViewportLayerOpts.view is static, and the
    // inner view moves with the pointer.
    const picture = createViewportLayer<unknown>({
      id: `${win.id}:lens`,
      label: 'Loupe content',
      source: opts.source ?? [],
      view: innerView(ctx.view, ctx.rect),
      bounds: () => ctx.rect,
      background: backdropColor(ctx),
    });
    return picture.draw(ctx.data, ctx.view, ctx.dims);
  };

  const drawPixels = (ctx: HudContentCtx): DrawCommand[] => {
    // The backdrop paints even with a bitmap in hand: a readback of a
    // transparent framebuffer is transparent, and before the first one
    // settles there is nothing at all, either of which leaves the lens a
    // hole onto the unmagnified canvas.
    const out: DrawCommand[] = [backdrop(ctx)];
    if (pixels) {
      out.push({
        kind: 'image',
        image: pixels,
        x: ctx.rect.x, y: ctx.rect.y, w: ctx.rect.w, h: ctx.rect.h,
        sampling: 'nearest',
      });
    }
    return out;
  };

  // `gl.readPixels` outside a landed paint returns the *previous* frame, so an
  // aim only marks the lens dirty; the read itself happens in the frame
  // subscriber below, on the frame that painted.
  const scheduleRefresh = () => {
    if (disposed || model.mode !== 'pixel') return;
    refreshWanted = true;
  };

  const refreshPixels = () => {
    if (disposed || model.mode !== 'pixel') return;
    const gl = element.getContext('webgl2');
    if (!gl) return;
    const cssRect = element.getBoundingClientRect();
    if (cssRect.width === 0) return;
    const dpr = element.width / cssRect.width;
    const rect = win.contentRect;
    const rw = Math.max(1, Math.round((rect.w * dpr) / model.factor));
    const rh = Math.max(1, Math.round((rect.h * dpr) / model.factor));
    const data = readbackRegion(
      gl, { width: element.width, height: element.height }, model.aim, dpr, rw, rh,
    );
    pixelsPending = true;
    createImageBitmap(data)
      .then((bmp) => {
        if (disposed) { bmp.close(); return; }
        pixels?.close();
        pixels = bmp;
        pixelsPending = false;
        requestRedraw();
      })
      .catch(() => {
        pixelsPending = false;
        requestRedraw();
      });
  };

  const readHex = (at: { x: number; y: number }): string | null => {
    const gl = element.getContext('webgl2');
    if (!gl) return null;
    const cssRect = element.getBoundingClientRect();
    if (cssRect.width === 0) return null;
    const dpr = element.width / cssRect.width;
    const px = readbackRegion(
      gl, { width: element.width, height: element.height }, at, dpr, 1, 1,
    );
    return '#' + [px.data[0], px.data[1], px.data[2]]
      .map((c) => c.toString(16).padStart(2, '0')).join('');
  };

  const win = hud.window({
    id: 'weasel-loupe',
    x: b.x, y: b.y, w: b.w, h: b.h,
    title: opts.title ?? 'Loupe',
    titlebar: opts.titlebar,
    content,
    interior: interactive ? 'pass' : 'claim',
    onResize: () => { scheduleRefresh(); },
    ...(interactive ? {} : { onContentClick: (p: { x: number; y: number }) => { model.pick(p); } }),
    ...(opts.onClose ? { onClose: opts.onClose } : {}),
  });

  const surface: LoupeSurface = {
    lens: () => win.contentRect,
    covers: (p) => win.hitTest(p.x, p.y) || (win.passes?.(p.x, p.y) ?? false),
    sample: readHex,
    hidden: () => win.hidden,
    gone: () => win.disposed === true,
    changed: () => { scheduleRefresh(); requestRedraw(); },
  };

  const model: LoupeModel = createLoupeModel({
    surface,
    ...(opts.mode ? { mode: opts.mode } : {}),
    ...(opts.factor !== undefined ? { factor: opts.factor } : {}),
    ...(opts.onColorChange ? { onColorChange: opts.onColorChange } : {}),
    ...(opts.onPick ? { onPick: opts.onPick } : {}),
    onDispose: () => teardown(),
  });

  if (host) {
    lens = host.addView({
      id: `${win.id}:lens`,
      label: 'Loupe',
      bounds: () => (win.hidden ? NO_RECT : win.contentRect),
      view: (outer) => innerView(outer, win.contentRect),
      paint: false,
      interactive,
      ...(opts.source ? { layers: () => opts.source! } : {}),
    });
  }

  const local = (evt: PointerEvent): { x: number; y: number } => {
    const r = input.getBoundingClientRect();
    return { x: evt.clientX - r.left, y: evt.clientY - r.top };
  };

  const onPointerMove = (evt: PointerEvent) => {
    if (holding) return;
    model.aimAt(local(evt));
  };
  const onPointerDown = (evt: PointerEvent) => {
    if (interactive && surface.covers(local(evt))) holding = true;
  };
  const onPointerEnd = () => { holding = false; };
  const pointerEnds = ['pointerup', 'pointercancel', 'lostpointercapture'] as const;

  const unsubscribeFrame = hud.subscribeFrame(() => {
    // A refresh wanted while a bitmap is in flight is remembered rather than
    // dropped: the flag survives until a frame finds it settled, so the aim
    // the user ends a fast drag on is the one that gets read.
    if (!refreshWanted || pixelsPending) return;
    refreshWanted = false;
    refreshPixels();
  });

  const teardown = () => {
    disposed = true;
    unsubscribeFrame();
    input.removeEventListener('pointermove', onPointerMove);
    input.removeEventListener('pointerdown', onPointerDown);
    for (const type of pointerEnds) input.removeEventListener(type, onPointerEnd);
    lens?.remove();
    lens = null;
    pixels?.close();
    pixels = null;
  };

  input.addEventListener('pointermove', onPointerMove);
  input.addEventListener('pointerdown', onPointerDown);
  for (const type of pointerEnds) input.addEventListener(type, onPointerEnd);

  return {
    window: win,
    get mode() { return model.mode; },
    get factor() { return model.factor; },
    get aim() { return model.aim; },
    get color() { return model.color; },
    setMode: model.setMode,
    setFactor: model.setFactor,
    aimAt: model.aimAt,
    pick: model.pick,
    dispose() {
      model.dispose();
      win.dispose();
    },
  };
}
