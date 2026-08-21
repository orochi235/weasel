import { createText, type TextWidget } from './text';

/** Options for a label. Same as a text widget minus the font family, which a
 *  label always leaves to the HUD default. */
export interface LabelOptions {
  id: string;
  x: number; y: number;
  text: string;
  fontSize?: number;
  color?: string;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
  /** Injected by Hud factories. Called from dispose() to remove this widget
   *  from its HUD's list. No-op for bare-factory consumers. */
  removeFromHud?: () => void;
}

/** A label is a text widget; the factory only differs in its defaults. */
export type LabelWidget = TextWidget;

export function createLabel(opts: LabelOptions): LabelWidget {
  return createText({
    id: opts.id,
    x: opts.x,
    y: opts.y,
    text: opts.text,
    fontSize: opts.fontSize ?? 13,
    color: opts.color,
    onChange: opts.onChange,
    removeFromHud: opts.removeFromHud,
    // fontFamily intentionally undefined → falls back to ctx.defaultFont
  });
}
