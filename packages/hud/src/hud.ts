import { isFocusable, type Widget } from './widget';
import type { HudHost } from './host';
import { createRect, type RectOptions, type RectWidget } from './widgets/rect';
import { createText, type TextOptions, type TextWidget } from './widgets/text';
import { createImage, type ImageOptions, type ImageWidget } from './widgets/image';
import { createLabel, type LabelOptions, type LabelWidget } from './widgets/label';
import { createButton, type ButtonOptions, type ButtonWidget } from './widgets/button';
import { createWindow, type WindowOptions, type WindowWidget } from './widgets/window/window';

/** How a focus change came about. */
export interface HudFocusOptions {
  /** Whether the focused widget should show a focus ring — the HUD's
   *  `:focus-visible`. Keyboard moves show one; a press does not. Default
   *  `false` for {@link Hud.focus}, `true` for {@link Hud.moveFocus}. */
  readonly visible?: boolean;
}

/**
 * A HUD: an ordered set of widgets drawn in screen space over the canvas, and
 * the factories that create them. The factory methods (`rect`, `text`, …) also
 * add the widget and wire its mutations to a redraw; the bare `createRect`-style
 * factories do neither, leaving redraw scheduling to the caller.
 *
 * A HUD holds no GL state of its own. It becomes visible by binding to a host
 * — normally through `attachHud`.
 */
export interface Hud {
  add(widget: Widget): void;
  remove(widget: Widget): void;
  widgets(): readonly Widget[];
  markDirty(): void;
  bind(host: HudHost): void;
  unbind(): void;
  /** Run `fn` after every paint the host lands. Survives bind/unbind: a
   *  subscription taken before the HUD is bound starts firing when it is.
   *  Returns an unsubscribe. */
  subscribeFrame(fn: () => void): () => void;
  /** True after bind() and before unbind(). */
  readonly attached: boolean;
  /** The widget holding keyboard focus, or null. One per HUD. */
  readonly focused: Widget | null;
  /** Whether the focused widget shows its focus ring. */
  readonly focusVisible: boolean;
  /** Focus `widget`, or blur with `null`. Returns whether `widget` now holds
   *  focus — false when it is not in this HUD or cannot take focus
   *  (see `isFocusable`), in which case focus is unchanged. */
  focus(widget: Widget | null, options?: HudFocusOptions): boolean;
  /** Move focus one step through {@link tabOrder}. From nothing, `'next'`
   *  lands on the first widget and `'prev'` on the last; stepping past either
   *  end blurs and returns null, which is where focus leaves the HUD. */
  moveFocus(direction: 'next' | 'prev', options?: HudFocusOptions): Widget | null;
  /** The widgets Tab visits, in order: those declaring `tabOrder` first,
   *  ascending, then the rest in the order they were added. */
  tabOrder(): Widget[];
  /** Run `fn` whenever the focused widget changes. Returns an unsubscribe. */
  subscribeFocus(fn: (focused: Widget | null) => void): () => void;
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
  /** Create a window widget, add it to the HUD, and wire onChange → markDirty. */
  window(opts: WindowOptions): WindowWidget;
}

/** Create an empty, unbound HUD. */
export function createHud(): Hud {
  const list: Widget[] = [];
  let host: HudHost | null = null;
  let detached = false;
  const frameSubs = new Set<() => void>();
  let hostFrameSub: (() => void) | null = null;

  const requestRedraw = () => { host?.requestRedraw(); };

  let focused: Widget | null = null;
  let focusVisible = false;
  const focusSubs = new Set<(w: Widget | null) => void>();

  const setFocus = (next: Widget | null, visible: boolean): void => {
    const was = focused;
    const wasVisible = focusVisible;
    focused = next;
    focusVisible = next !== null && visible;
    if (was === next) {
      if (wasVisible !== focusVisible) requestRedraw();
      return;
    }
    was?.onFocusChange?.(false);
    next?.onFocusChange?.(true);
    for (const fn of [...focusSubs]) fn(next);
    requestRedraw();
  };

  const tabOrder = (): Widget[] => {
    const order = list.filter(isFocusable);
    // Array.prototype.sort is stable, so ties and the undeclared keep list order.
    return order.sort((a, b) =>
      (a.tabOrder ?? Number.POSITIVE_INFINITY) - (b.tabOrder ?? Number.POSITIVE_INFINITY));
  };

  /** Every path that takes a widget out of the list, so a focused one is
   *  always blurred on the way out. */
  const drop = (w: Widget): boolean => {
    const i = list.indexOf(w);
    if (i === -1) return false;
    list.splice(i, 1);
    if (focused === w) setFocus(null, false);
    return true;
  };

  // One subscription on the host fans out to all of ours, so a subscriber
  // taken while unbound is not lost and bind/unbind stays cheap.
  const attachFrames = () => {
    if (hostFrameSub || !host || frameSubs.size === 0) return;
    hostFrameSub = host.subscribeFrame(() => {
      for (const fn of [...frameSubs]) fn();
    });
  };

  // NOTE: factory methods (rect, text, image, label, button) inject
  // `onChange: () => requestRedraw()` into widget options so widget setters
  // trigger redraws automatically. Widgets created via the bare factories
  // (createRect etc.) don't get this and must be added via hud.add() — their
  // setters won't auto-redraw, which is by design (the bare factories are
  // for unit tests and advanced consumers who want to manage redraws
  // explicitly).

  /** Build the removeFromHud callback for a factory-created widget. */
  const makeRemoveFromHud = (getWidget: () => Widget | null) => () => {
    const w = getWidget();
    if (w && drop(w)) requestRedraw();
  };

  /** Every path that puts a widget in the list, so the detached guard is one
   *  rule rather than one per factory. */
  const push = (widget: Widget, from: string): void => {
    if (detached) {
      console.warn(`weasel-hud: ${from} called on a detached HUD; ignored.`);
      return;
    }
    list.push(widget);
    requestRedraw();
  };

  return {
    get attached() { return host !== null; },
    add(widget) { push(widget, 'add()'); },
    remove(widget) {
      if (!drop(widget)) return;
      try { widget.dispose(); } catch (e) {
        console.error('weasel-hud: widget.dispose threw', e);
      }
      requestRedraw();
    },
    widgets() { return list; },
    get focused() { return focused; },
    get focusVisible() { return focusVisible; },
    focus(widget, options) {
      if (widget === null) { setFocus(null, false); return false; }
      if (!list.includes(widget) || !isFocusable(widget)) return false;
      setFocus(widget, options?.visible ?? false);
      return true;
    },
    moveFocus(direction, options) {
      const visible = options?.visible ?? true;
      const order = tabOrder();
      let at: number;
      if (focused === null) {
        at = direction === 'next' ? 0 : order.length - 1;
      } else {
        // A focused widget that has since been hidden is out of the order;
        // step from where it sits in the list instead.
        const here = order.indexOf(focused);
        if (here !== -1) {
          at = here + (direction === 'next' ? 1 : -1);
        } else {
          const pos = list.indexOf(focused);
          const after = order.findIndex((w) => list.indexOf(w) > pos);
          at = direction === 'next'
            ? (after === -1 ? order.length : after)
            : (after === -1 ? order.length : after) - 1;
        }
      }
      const next = order[at] ?? null;
      setFocus(next, visible);
      return next;
    },
    tabOrder,
    subscribeFocus(fn) {
      focusSubs.add(fn);
      return () => { focusSubs.delete(fn); };
    },
    markDirty() { requestRedraw(); },
    bind(h) {
      if (host) throw new Error('weasel-hud: HUD is already bound to a host.');
      host = h;
      detached = false;
      attachFrames();
      if (list.length > 0) requestRedraw();
    },
    unbind() {
      hostFrameSub?.();
      hostFrameSub = null;
      host = null;
      detached = true;
    },
    subscribeFrame(fn) {
      frameSubs.add(fn);
      attachFrames();
      return () => {
        frameSubs.delete(fn);
        if (frameSubs.size === 0) { hostFrameSub?.(); hostFrameSub = null; }
      };
    },
    rect(opts) {
      let w: RectWidget | null = null;
      const removeFromHud = makeRemoveFromHud(() => w);
      w = createRect({ ...opts, onChange: () => requestRedraw(), removeFromHud });
      push(w, 'rect()');
      return w;
    },
    text(opts) {
      let w: TextWidget | null = null;
      const removeFromHud = makeRemoveFromHud(() => w);
      w = createText({ ...opts, onChange: () => requestRedraw(), removeFromHud });
      push(w, 'text()');
      return w;
    },
    image(opts) {
      let w: ImageWidget | null = null;
      const removeFromHud = makeRemoveFromHud(() => w);
      w = createImage({ ...opts, onChange: () => requestRedraw(), removeFromHud });
      push(w, 'image()');
      return w;
    },
    label(opts) {
      let w: LabelWidget | null = null;
      const removeFromHud = makeRemoveFromHud(() => w);
      w = createLabel({ ...opts, onChange: () => requestRedraw(), removeFromHud });
      push(w, 'label()');
      return w;
    },
    button(opts) {
      let w: ButtonWidget | null = null;
      const removeFromHud = makeRemoveFromHud(() => w);
      w = createButton({ ...opts, onChange: () => requestRedraw(), removeFromHud });
      push(w, 'button()');
      return w;
    },
    window(opts) {
      let w: WindowWidget | null = null;
      const removeFromHud = makeRemoveFromHud(() => w);
      w = createWindow({ ...opts, onChange: () => requestRedraw(), removeFromHud });
      push(w, 'window()');
      return w;
    },
  };
}
