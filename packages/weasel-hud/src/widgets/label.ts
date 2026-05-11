import { createText, type TextWidget } from './text';

export interface LabelOptions {
  id: string;
  x: number; y: number;
  text: string;
  fontSize?: number;
  color?: string;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
}

export type LabelWidget = TextWidget;

export function createLabel(opts: LabelOptions): LabelWidget {
  return createText({
    id: opts.id,
    x: opts.x,
    y: opts.y,
    text: opts.text,
    fontSize: opts.fontSize ?? 13,
    color: opts.color ?? '#1a1a1a',
    onChange: opts.onChange,
    // fontFamily intentionally undefined → falls back to ctx.defaultFont
  });
}
