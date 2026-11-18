import { clamp, type Rect } from '@weasel-js/geom';
import {
  centeredBaseline, envNumber, envPx,
  type Constraints, type FontSpec, type MeasureEnv, type Measured, type TextExtent,
} from './measure';
import type { ControlSize } from './controlSize';

/** A button's size: a {@link ControlSize}, or `xs`, the dense chrome of a title bar, at `--wzl-control-h-xs`. Only
 *  a button takes `xs`; no other control has a design at that height. */
export type ButtonSize = ControlSize | 'xs';

/**
 * What a button shows, as every target reads it. `I` is how a target names an icon (a React node, a glyph name);
 * measuring only asks whether one is there.
 */
export interface ButtonFace<I = unknown> {
  /** The text measured for the label. A label that is not text passes its text content, or `''`. Absent, the
   *  button has no label part. */
  readonly label?: string;
  /** Default `'md'`. */
  readonly size?: ButtonSize;
  /** The button is its icon alone, `icon`, in a square box. */
  readonly iconOnly?: boolean;
  readonly icon?: I;
  readonly leadingIcon?: I;
  readonly trailingIcon?: I;
  /** A spinner stands in for the leading icon (the icon, when `iconOnly`). */
  readonly loading?: boolean;
}

/** One piece of a button, in the order it is laid out. */
export type ButtonPart = 'spinner' | 'icon' | 'leading' | 'label' | 'trailing';

/** Which parts `face` shows, left to right. Both targets draw exactly these. */
export function buttonParts(face: ButtonFace): ButtonPart[] {
  if (face.iconOnly) return [face.loading ? 'spinner' : 'icon'];
  const out: ButtonPart[] = [];
  if (face.loading) out.push('spinner');
  else if (face.leadingIcon) out.push('leading');
  if (face.label !== undefined) out.push('label');
  if (face.trailingIcon) out.push('trailing');
  return out;
}

/** A button's sizes in px, read from its theme. */
export interface ButtonMetrics {
  readonly height: number;
  /** Inset of the content from each side. 0 on an icon-only button, which is square. */
  readonly padX: number;
  /** Between adjacent parts. */
  readonly gap: number;
  readonly iconSize: number;
  readonly spinnerSize: number;
  readonly font: FontSpec;
}

/** The spinner's drawn size at either button size. */
export const BUTTON_SPINNER_SIZE = 14;

/** Each size's tokens and defaults, as `Button.module.css`'s `.size_*` rules set them. */
const SIZES: Record<ButtonSize, { height: string; padX: string; icon: number; font: string }> = {
  xs: { height: '--wzl-control-h-xs', padX: '--wzl-space-2', icon: 12, font: '--wzl-font-size-sm' },
  sm: { height: '--wzl-control-h-sm', padX: '--wzl-space-4', icon: 12, font: '--wzl-font-size-sm' },
  md: { height: '--wzl-control-h', padX: '--wzl-space-6', icon: 14, font: '--wzl-font-size' },
};

/** The tokens a button of `size` is sized by: the same ones ui's `Button.module.css` lays it out with, so the DOM
 *  button and the HUD one agree in any theme. */
export function buttonMetrics(env: MeasureEnv, size: ButtonSize = 'md', iconOnly = false): ButtonMetrics {
  const z = SIZES[size];
  const height = envPx(env, z.height);
  return {
    height,
    padX: iconOnly ? 0 : envPx(env, '--wzl-button-pad-x', z.padX),
    gap: envPx(env, '--wzl-space-3'),
    iconSize: envPx(env, '--wzl-button-icon-size', z.icon),
    spinnerSize: BUTTON_SPINNER_SIZE,
    font: {
      family: env.token('--wzl-font-ui'),
      size: envPx(env, '--wzl-field-font-size', z.font),
      weight: envNumber(env, '--wzl-button-font-weight', envNumber(env, '--wzl-font-weight-medium', 500)),
    },
  };
}

/** Where each of a button's parts sits. */
export interface ButtonLayout {
  readonly parts: readonly { readonly part: ButtonPart; readonly rect: Rect }[];
  readonly metrics: ButtonMetrics;
}

/**
 * A button's box: its control height, and its parts' widths plus gaps plus side padding (square when icon-only),
 * held to `c`. The parts are centered in the box, as flex centers them. In a box too narrow for them, the label
 * gives up width first, down to none.
 */
export function measureButton(face: ButtonFace, c: Constraints, env: MeasureEnv): Measured<ButtonLayout> {
  const m = buttonMetrics(env, face.size, face.iconOnly);
  const parts = buttonParts(face);
  let text: TextExtent | null = null;
  const widths = parts.map((p) => {
    if (p === 'spinner') return m.spinnerSize;
    if (p !== 'label') return m.iconSize;
    text = env.text(face.label ?? '', m.font);
    return text.width;
  });
  const gaps = Math.max(0, parts.length - 1) * m.gap;
  const content = widths.reduce((a, b) => a + b, 0) + gaps;
  const width = clamp(face.iconOnly ? m.height : content + m.padX * 2, c.minWidth, c.maxWidth);
  const height = clamp(m.height, c.minHeight, c.maxHeight);

  const over = content - (width - m.padX * 2);
  const label = parts.indexOf('label');
  if (over > 0 && label >= 0) widths[label] = Math.max(0, widths[label]! - over);
  const fitted = widths.reduce((a, b) => a + b, 0) + gaps;

  let x = (width - fitted) / 2;
  const laid = parts.map((part, i) => {
    const w = widths[i]!;
    const h = part === 'label' ? m.font.size : part === 'spinner' ? m.spinnerSize : m.iconSize;
    const rect = { x, y: (height - h) / 2, width: w, height: h };
    x += w + m.gap;
    return { part, rect };
  });
  // The label's line height is its font size: the DOM button sets `line-height: 1`.
  const baseline = text ? centeredBaseline(height, m.font.size, text) : height;
  return { width, height, baseline, layout: { parts: laid, metrics: m } };
}
