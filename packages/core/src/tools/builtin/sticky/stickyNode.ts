import type { Fill } from '@weasel-js/paint';
import type { TextStyle, TextVerticalAlign } from '@weasel-js/text';
import type { InsertNodeFactory } from '../../../canvas/deps/insert';
import type { TextNodeData } from '../../../canvas/nodeShapes/textPainter';

/** How a sticky note looks as it is made, named as the text node it becomes
 *  names them. Every field but `fill` has a default, in {@link STICKY_DEFAULTS}. */
export interface StickyStyle {
  /** The note itself, painted over its whole box. */
  background?: Fill;
  /** The text's paint. Absent, the text style's default. */
  fill?: Fill;
  /** World units from the note's edge to its text, on every side. */
  padding?: number;
  /** Typography for the note's text. */
  style?: TextStyle;
  verticalAlign?: TextVerticalAlign;
  /** The note a click makes, centered on the click, in world units. A drag
   *  makes the note it draws. */
  size?: { width: number; height: number };
}

/** The look a sticky note takes for any field its tool leaves out. */
export const STICKY_DEFAULTS = {
  background: { paint: { kind: 'solid', color: '#fff1a6ff' } },
  padding: 12,
  style: { fontSize: 18, align: 'center', wrap: true },
  verticalAlign: 'center',
  size: { width: 160, height: 160 },
} as const satisfies Required<Omit<StickyStyle, 'fill'>>;

/**
 * A sticky note's `data`: a text node with a `background`, so the `kit:text`
 * painter draws it and the text editor edits it with no sticky case of its
 * own. `look` is the `sticky` insert's extras, which carry the tool's
 * {@link StickyStyle}.
 */
export function stickyData(look: StickyStyle & { text?: string }): TextNodeData {
  return {
    text: look.text ?? '',
    background: look.background ?? STICKY_DEFAULTS.background,
    padding: look.padding ?? STICKY_DEFAULTS.padding,
    style: look.style ?? STICKY_DEFAULTS.style,
    verticalAlign: look.verticalAlign ?? STICKY_DEFAULTS.verticalAlign,
    ...(look.fill ? { fill: look.fill } : {}),
  };
}

/** The kit's `sticky` insert as an `InsertNodeFactory`, for a canvas that
 *  wraps it — to tag the data with a `kind`, say — under `insertNodeFactories`. */
export const stickyNodeFactory: InsertNodeFactory = (_bounds, extras) => ({
  data: stickyData(extras as StickyStyle & { text?: string }),
});
