import type { Widget, WidgetBounds, HudDrawCtx, HudPointerEvent } from '../widget';
import type { DrawCommand, ImageDrawCommand } from '@weasel-js/core/renderer';

/** Sub-rectangle of a bitmap, in its own pixels. */
export interface SourceRect { x: number; y: number; w: number; h: number }

/** Options for an image widget. */
export interface ImageOptions {
  id: string;
  x: number; y: number; w: number; h: number;
  image: ImageBitmap;
  opacity?: number;
  /** Magnification filter for the drawn bitmap. See `ImageDrawCommand.sampling`. */
  sampling?: 'linear' | 'nearest';
  /** Sub-rectangle of `image` to draw, in bitmap pixels. See
   *  `ImageDrawCommand.source`. */
  source?: SourceRect;
  /** Mirror the sampled region within the widget's bounds. */
  flipX?: boolean;
  flipY?: boolean;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose() to remove this widget
   *  from its HUD's list. No-op for bare-factory consumers. */
  removeFromHud?: () => void;
}

/** Draws an `ImageBitmap` into its bounds, stretched to fit. */
export interface ImageWidget extends Widget {
  setImage(image: ImageBitmap): void;
  setBounds(b: WidgetBounds): void;
  setHidden(hidden: boolean): void;
  /** Sample a sub-rectangle of the bitmap; `undefined` restores the whole
   *  bitmap. Together with `setFlip`, this is how a sprite animation advances
   *  without rebuilding the widget. */
  setSource(source: SourceRect | undefined): void;
  /** Merge a mirror state — an omitted axis keeps its current value. */
  setFlip(flip: { x?: boolean; y?: boolean }): void;
  dispose(): void;
}

export function createImage(opts: ImageOptions): ImageWidget {
  if (opts.w <= 0 || opts.h <= 0) {
    throw new Error(`createImage: bounds must have positive w/h (got ${opts.w}x${opts.h})`);
  }
  let disposed = false;
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, w: opts.w, h: opts.h };
  let image = opts.image;
  let hidden = false;
  let source = opts.source;
  let flipX = opts.flipX;
  let flipY = opts.flipY;

  const assertNotDisposed = () => {
    if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.');
  };

  return {
    id: opts.id,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    get disposed() { return disposed; },
    setBounds(b) { assertNotDisposed(); bounds = { ...b }; opts.onChange?.(); },
    setHidden(h) { assertNotDisposed(); hidden = h; opts.onChange?.(); },
    setImage(img) { assertNotDisposed(); image = img; opts.onChange?.(); },
    setSource(s) { assertNotDisposed(); source = s ? { ...s } : undefined; opts.onChange?.(); },
    setFlip(flip) {
      assertNotDisposed();
      if (flip.x !== undefined) flipX = flip.x;
      if (flip.y !== undefined) flipY = flip.y;
      opts.onChange?.();
    },
    draw(_ctx: HudDrawCtx): DrawCommand[] {
      const cmd: ImageDrawCommand = {
        kind: 'image', image,
        x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h,
        opacity: opts.opacity,
        sampling: opts.sampling,
        source,
        flipX,
        flipY,
      };
      return [cmd];
    },
    hitTest(x, y) {
      if (hidden) return false;
      return x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;
    },
    claims: [],
    onPointer(_evt: HudPointerEvent): void {},
    dispose() {
      if (disposed) return;
      disposed = true;
      opts.removeFromHud?.();
    },
  };
}
