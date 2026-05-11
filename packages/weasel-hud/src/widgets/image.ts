import type { Widget, WidgetBounds, HudDrawCtx, HudPointerEvent, PointerClaim } from '../widget';
import type { DrawCommand, ImageDrawCommand } from '../../../../src/renderer';

export interface ImageOptions {
  id: string;
  x: number; y: number; w: number; h: number;
  image: ImageBitmap;
  opacity?: number;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose() to remove this widget
   *  from its HUD's list. No-op for bare-factory consumers. */
  removeFromHud?: () => void;
}

export interface ImageWidget extends Widget {
  setImage(image: ImageBitmap): void;
  setBounds(b: WidgetBounds): void;
  setHidden(hidden: boolean): void;
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

  const assertNotDisposed = () => {
    if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.');
  };

  return {
    id: opts.id,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    setBounds(b) { assertNotDisposed(); bounds = { ...b }; opts.onChange?.(); },
    setHidden(h) { assertNotDisposed(); hidden = h; opts.onChange?.(); },
    setImage(img) { assertNotDisposed(); image = img; opts.onChange?.(); },
    draw(_ctx: HudDrawCtx): DrawCommand[] {
      const cmd: ImageDrawCommand = {
        kind: 'image', image,
        x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h,
        opacity: opts.opacity,
      };
      return [cmd];
    },
    hitTest(x, y) {
      if (hidden) return false;
      return x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;
    },
    onPointer(_e: HudPointerEvent): PointerClaim { return 'pass'; },
    dispose() {
      if (disposed) return;
      disposed = true;
      opts.removeFromHud?.();
    },
  };
}
