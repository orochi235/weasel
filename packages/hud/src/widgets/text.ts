import { createRevision } from '../widget';
import type { Widget, WidgetBounds, HudDrawCtx, HudPointerEvent } from '../widget';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { textCommandFromRuns } from '@weasel-js/core';

/** Options for a text widget. `x`/`y` place the text; its bounds follow from
 *  the string and font size. */
export interface TextOptions {
  id: string;
  x: number; y: number;
  text: string;
  fontSize: number;
  color?: string;
  /** Optional; falls back to the HUD default font from HudDrawCtx. */
  fontFamily?: string;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose() to remove this widget
   *  from its HUD's list. No-op for bare-factory consumers. */
  removeFromHud?: () => void;
}

/** A single run of text drawn at a point. */
export interface TextWidget extends Widget {
  setText(text: string): void;
  setHidden(hidden: boolean): void;
  setBounds(b: WidgetBounds): void;
  dispose(): void;
}

export function createText(opts: TextOptions): TextWidget {
  let disposed = false;
  const rev = createRevision(opts.onChange);
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, w: 0, h: opts.fontSize };
  let text = opts.text;
  let hidden = false;

  const assertNotDisposed = () => {
    if (disposed) throw new Error('weasel-hud: cannot mutate a disposed widget.');
  };

  return {
    id: opts.id,
    deps: rev.deps,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    get disposed() { return disposed; },
    setBounds(b) { assertNotDisposed(); bounds = { ...b }; rev.changed(); },
    setHidden(h) { assertNotDisposed(); hidden = h; rev.changed(); },
    setText(t) { assertNotDisposed(); text = t; rev.changed(); },
    draw(ctx: HudDrawCtx): DrawCommand[] {
      const color = opts.color ?? ctx.tokens['--wzl-fg'];
      return [textCommandFromRuns(
        bounds.x,
        bounds.y,
        [{ text, fill: { fill: 'solid', color } }],
        {
          fontFamily: opts.fontFamily ?? ctx.defaultFont,
          fontSize: opts.fontSize,
        },
      )];
    },
    hitTest() { return false; },
    claims: [],
    onPointer(_evt: HudPointerEvent): void {},
    dispose() {
      if (disposed) return;
      disposed = true;
      opts.removeFromHud?.();
    },
  };
}
