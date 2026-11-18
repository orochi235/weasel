import type { RenderLayer } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { createLoupeModel, type LoupeMode, type LoupeModel, type LoupeSurface } from '@weasel-js/loupe';
import type { Hud } from '../hud';
import type { WindowWidget } from '../widgets/window/window';
import type { HudContentCtx, WidgetBounds } from '../widget';
import { createContentWatch } from './contentWatch';
import { createLoupeColors } from './loupeColors';
import { lensAimInput } from './aimInput';
import { createPixelReadback } from './pixelReadback';
import { createVectorLens, type LensHost } from './vectorLens';
import { registerLoupe } from './loupeRoutes';

export type { LoupeMode };

/** Options for `createLoupe` shared by a plain lens and an interactive one. */
export interface LoupeBaseOptions {
  hud: Hud;
  /** The canvas pixel mode reads back from. Supplies the GL context and the
   *  drawing-buffer dimensions. */
  canvas: HTMLCanvasElement;
  /** The element the aim's client coords are measured against: the one the
   *  canvas's dispatcher listens on. Defaults to `canvas`, which is right
   *  whenever the canvas is also the thing under the pointer. */
  input?: HTMLElement;
  /** The rect of `canvas` the magnified picture occupies, in its CSS px — the
   *  one the aim is relative to. Pass `CanvasExtensionApi.getSurfaceRect` for
   *  a pane painted into a shared canvas. Defaults to `views.getSurfaceRect`
   *  when the lens is a view, and to the whole canvas otherwise. */
  region?: () => { x: number; y: number; width: number; height: number };
  requestRedraw: () => void;
  /**
   * The version of what the canvas paints, read on every landed frame: when it moves, a lens whose aim has not
   * reads the framebuffer and the color under it again. Pass `CanvasExtensionApi.getPaintedVersion`. Defaults to
   * `views.getPaintedVersion` when the lens is a view. Without one the lens follows an edit under a parked aim
   * only in vector mode, or when told through `refresh()`; a camera move it follows either way.
   */
  contentVersion?: () => number;
  mode?: LoupeMode;
  factor?: number;
  bounds?: WidgetBounds;
  title?: string;
  /** Draw the window's titlebar and close box. Default `true`. Pass `false`
   *  for a bare lens; the interior then doubles as the move handle, or, for an
   *  `interactive` lens, a grip strip across its top does. */
  titlebar?: boolean;
  /** Called with the hex color under the aim point whenever it changes.
   *  Vector mode with a `source` samples exactly: the source layers drawn
   *  again at the aim, at the canvas's own view and pixel ratio, so nothing
   *  painted over them answers. Otherwise — pixel mode, or a lens over the
   *  canvas's whole stack — it reads the framebuffer, chrome and all. `null`
   *  where nothing is drawn under the aim. */
  onColorChange?: (hex: string | null) => void;
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
       * the lens can take input. It magnifies the camera of whatever view is
       * under its aim: aimed over a `<CanvasView>` panel, it shows and edits
       * that panel's world at the panel's zoom times its own factor, painting
       * and picking only the layers the panel does. A host without `viewAt`
       * gets the canvas's camera and stack wherever it aims.
       */
      views: LensHost;
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

const backdropOf = (ctx: HudContentCtx, color: string): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', ...ctx.rect },
  fill: { paint: { kind: 'solid', color } },
});

/** What the loupe model reads of the window it magnifies into. `changed` hears that the model changed what the lens shows. */
function createLensSurface(
  win: WindowWidget, sample: LoupeSurface['sample'], changed: () => void, subscribeFrame: Hud['subscribeFrame'],
): LoupeSurface {
  return {
    lens: () => win.contentRect,
    covers: (p) => win.hitTest(p.x, p.y) || (win.passes?.(p.x, p.y) ?? false),
    sample,
    hidden: () => win.hidden,
    gone: () => win.disposed === true,
    changed,
    subscribeFrame,
  };
}

/** Control surface for a live loupe: where it is aimed, how it magnifies,
 *  what color it is over, and the window it lives in. */
export interface LoupeHandle {
  readonly window: WindowWidget;
  readonly mode: LoupeMode;
  readonly factor: number;
  /** Last aimed point, in screen-space CSS px relative to the canvas. */
  readonly aim: { x: number; y: number };
  /** Hex color under the aim point, read off the framebuffer on the first
   *  frame to land after the aim. `null` until then, or when the GL context
   *  is unavailable. */
  readonly color: string | null;
  setMode(mode: LoupeMode): void;
  setFactor(factor: number): void;
  /** Aim at a screen point. Ignored while the point is over the window —
   *  that is the freeze rule that makes the borders reachable. */
  aimAt(p: { x: number; y: number }): void;
  /** Sample the color the lens is showing at `p` — a screen point inside the
   *  lens — and report it to `onPick`. Omit `p` to pick at the aim point.
   *  Returns the hex, or `null` when the framebuffer cannot answer for that
   *  point, including before any frame has landed. Leaves the aim, and
   *  `color`, alone. */
  pick(p?: { x: number; y: number }): string | null;
  /** Ask for a paint, and on the frame that lands read the picture and the color under the aim again: what is
   *  under the aim changed in a way no `contentVersion` reports. */
  refresh(): void;
  dispose(): void;
}

/**
 * Build a magnifier: a HUD window whose interior shows the canvas around an
 * aim point, enlarged. Adds the window to the HUD; `dispose` removes it again.
 * It follows the pointer through the HUD's contribution, whose `loupe.aim`
 * drives every loupe on the HUD.
 */
export function createLoupe(opts: LoupeOptions): LoupeHandle {
  const { hud, canvas: element, requestRedraw } = opts;
  const host = opts.views;
  const interactive = host !== undefined && opts.interactive === true;
  const input = opts.input ?? element;
  let disposed = false;

  const b = opts.bounds ?? { x: 24, y: 24, width: 220, height: 200 };

  const watch = createContentWatch(opts.contentVersion ?? host?.getPaintedVersion);
  let refreshAsked = false;

  const content = (ctx: HudContentCtx): DrawCommand[] => {
    watch.drew(ctx.view);
    colors.drew(ctx);
    return model.mode === 'vector' ? vector.draw(ctx) : pixels.draw(ctx, backdrop(ctx));
  };

  const backdropColor = (ctx: HudContentCtx): string =>
    opts.background ?? ctx.tokens['--wzl-surface'];
  const backdrop = (ctx: HudContentCtx): DrawCommand => backdropOf(ctx, backdropColor(ctx));

  const pixels = createPixelReadback(element, () => (opts.region ?? host?.getSurfaceRect)?.(), (later) => {
    if (later) model.resample();
    requestRedraw();
  });
  // `gl.readPixels` outside a landed paint returns the *previous* frame, so an
  // aim only marks the lens dirty; the read itself happens in the frame
  // subscriber below, on the frame that painted.
  const scheduleRefresh = () => {
    if (model.mode === 'pixel') pixels.want();
  };

  const colors = createLoupeColors({
    pixel: pixels.pixel,
    layers: () => (model.mode === 'vector' && vector.aimedView()?.id == null ? opts.source ?? null : null),
  });

  const win = hud.window({
    id: 'weasel-loupe',
    x: b.x, y: b.y, width: b.width, height: b.height,
    title: opts.title ?? 'Loupe',
    titlebar: opts.titlebar,
    content,
    interior: interactive ? 'pass' : 'claim',
    onResize: () => { scheduleRefresh(); },
    ...(interactive ? {} : { onContentClick: (p: { x: number; y: number }) => { model.pick(p); } }),
    ...(opts.onClose ? { onClose: opts.onClose } : {}),
  });

  const surface = createLensSurface(win, colors.sample, () => { scheduleRefresh(); requestRedraw(); }, hud.subscribeFrame);

  // Subscribed ahead of the model, so the frame that lands first is already
  // readable by the time the model samples on it.
  const unsubscribeFrame = hud.subscribeFrame(() => {
    pixels.land();
    if (watch.changed() || refreshAsked) {
      refreshAsked = false;
      scheduleRefresh();
      model.resample();
    }
    if (!pixels.due() || model.mode !== 'pixel') return;
    const rect = win.contentRect;
    pixels.read(model.aim, rect.width, rect.height, model.factor);
  });

  const model: LoupeModel = createLoupeModel({
    surface,
    ...(opts.mode ? { mode: opts.mode } : {}),
    ...(opts.factor !== undefined ? { factor: opts.factor } : {}),
    ...(opts.onColorChange ? { onColorChange: opts.onColorChange } : {}),
    ...(opts.onPick ? { onPick: opts.onPick } : {}),
    onDispose: () => teardown(),
  });

  const vector = createVectorLens({
    host, source: opts.source, interactive, win,
    aim: () => model.aim, factor: () => model.factor, background: backdropColor, backdrop,
  });

  const unregister = registerLoupe(hud, lensAimInput(input, {
    aimAt: (p) => model.aimAt(p),
    holds: (p) => interactive && surface.covers(p),
  }));

  const teardown = () => {
    disposed = true;
    unsubscribeFrame();
    unregister();
    vector.remove();
    pixels.dispose();
    colors.dispose();
  };

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
    refresh() {
      if (disposed) return;
      refreshAsked = true;
      requestRedraw();
    },
    dispose() {
      model.dispose();
      win.dispose();
    },
  };
}
