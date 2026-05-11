import type { Widget } from './widget';
import type { HudHost } from './host';
import { createRect, type RectOptions, type RectWidget } from './widgets/rect';
import { createText, type TextOptions, type TextWidget } from './widgets/text';
import { createImage, type ImageOptions, type ImageWidget } from './widgets/image';
import { createLabel, type LabelOptions, type LabelWidget } from './widgets/label';
import { createButton, type ButtonOptions, type ButtonWidget } from './widgets/button';

export interface Hud {
  add(widget: Widget): void;
  remove(widget: Widget): void;
  widgets(): readonly Widget[];
  markDirty(): void;
  bind(host: HudHost): void;
  unbind(): void;
  /** True after bind() and before unbind(). */
  readonly attached: boolean;
  /** Create a rect widget, add it to the HUD, and wire onChange → markDirty. */
  rect(opts: RectOptions): RectWidget;
  /** Create a text widget, add it to the HUD, and wire onChange → markDirty. */
  text(opts: TextOptions): TextWidget;
  /** Create an image widget, add it to the HUD, and wire onChange → markDirty. */
  image(opts: ImageOptions): ImageWidget;
  /** Create a label widget, add it to the HUD, and wire onChange → markDirty. */
  label(opts: LabelOptions): LabelWidget;
  /** Create a button widget, add it to the HUD, and wire onChange → markDirty. */
  button(opts: ButtonOptions): ButtonWidget;
}

export function createHud(): Hud {
  const list: Widget[] = [];
  let host: HudHost | null = null;
  let detached = false;

  const requestRedraw = () => { host?.requestRedraw(); };

  // NOTE: factory methods (rect, text, image, label, button) inject
  // `onChange: () => requestRedraw()` into widget options so widget setters
  // trigger redraws automatically. Widgets created via the bare factories
  // (createRect etc.) don't get this and must be added via hud.add() — their
  // setters won't auto-redraw, which is by design (the bare factories are
  // for unit tests and advanced consumers who want to manage redraws
  // explicitly).

  return {
    get attached() { return host !== null; },
    add(widget) {
      if (detached) {
        console.warn('weasel-hud: add() called on a detached HUD; ignored.');
        return;
      }
      list.push(widget);
      requestRedraw();
    },
    remove(widget) {
      const i = list.indexOf(widget);
      if (i === -1) return;
      list.splice(i, 1);
      try { widget.dispose(); } catch (e) {
        console.error('weasel-hud: widget.dispose threw', e);
      }
      requestRedraw();
    },
    widgets() { return list; },
    markDirty() { requestRedraw(); },
    bind(h) {
      if (host) throw new Error('weasel-hud: HUD is already bound to a host.');
      host = h;
      detached = false;
      if (list.length > 0) requestRedraw();
    },
    unbind() {
      host = null;
      detached = true;
    },
    rect(opts) {
      const w = createRect({ ...opts, onChange: () => requestRedraw() });
      list.push(w);
      requestRedraw();
      return w;
    },
    text(opts) {
      const w = createText({ ...opts, onChange: () => requestRedraw() });
      list.push(w);
      requestRedraw();
      return w;
    },
    image(opts) {
      const w = createImage({ ...opts, onChange: () => requestRedraw() });
      list.push(w);
      requestRedraw();
      return w;
    },
    label(opts) {
      const w = createLabel({ ...opts, onChange: () => requestRedraw() });
      list.push(w);
      requestRedraw();
      return w;
    },
    button(opts) {
      const w = createButton({ ...opts, onChange: () => requestRedraw() });
      list.push(w);
      requestRedraw();
      return w;
    },
  };
}
