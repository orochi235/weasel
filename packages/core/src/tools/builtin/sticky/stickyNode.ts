import type { Fill, Paint } from '@weasel-js/paint';
import { DEFAULT_TEXT_FILL, type TextStyle, type TextVerticalAlign } from '@weasel-js/text';
import type { InsertNodeFactory } from '../../../canvas/deps/insert';
import type { TextNodeData, TextOverflow } from '../../../canvas/nodeShapes/textPainter';
import type { TextEdge, TextShadow } from '../../../canvas/nodeShapes/textFrame';
import type { MinSize } from '../../../core/scene/minSize';

/** How a sticky note looks as it is made, named as the text node it becomes
 *  names them. Every field has a default, in {@link STICKY_DEFAULTS}. */
export interface StickyStyle {
  /** The note itself, painted over its whole box. */
  background?: Fill;
  /** The text's paint. */
  fill?: Fill;
  /** World units from the note's edge to its text, on every side. */
  padding?: number;
  /** Typography for the note's text. */
  style?: TextStyle;
  verticalAlign?: TextVerticalAlign;
  /** What happens to text that outgrows the note. */
  overflow?: TextOverflow;
  /** The rule round the note, in a darker shade of its paper. */
  edge?: TextEdge;
  /** The shadow the note casts. */
  shadow?: TextShadow;
  /** The smallest note a drag makes or a resize leaves, in world units. */
  minSize?: MinSize;
  /** The note a click makes, centered on the click, in world units. A drag
   *  makes the note it draws. */
  size?: { width: number; height: number };
}

/** A sticky insert's extras: the tool's {@link StickyStyle}, and its `paper` and `ink` options, the paints that
 *  stand over `background` and `fill`. */
export type StickyLook = StickyStyle & { paper?: Paint; ink?: Paint };

/** The look a sticky note takes for any field its tool leaves out. */
export const STICKY_DEFAULTS = {
  background: { paint: { kind: 'solid', color: '#fff1a6ff' } },
  fill: DEFAULT_TEXT_FILL,
  padding: 12,
  style: { fontSize: 18, align: 'center', wrap: true },
  verticalAlign: 'center',
  overflow: 'clip',
  edge: { width: 1, shade: 0.18 },
  shadow: { x: 0, y: 2, blur: 6, alpha: 0.18 },
  // One line of the default type inside the default padding.
  minSize: { width: 48, height: 48 },
  size: { width: 160, height: 160 },
} as const satisfies Required<StickyStyle>;

/**
 * A sticky note's `data`: a text node with a `background`, so the `kit:text`
 * painter draws it and the text editor edits it with no sticky case of its
 * own. `look` is the `sticky` insert's extras, which carry the tool's
 * {@link StickyStyle}.
 */
export function stickyData(look: StickyLook & { text?: string }): TextNodeData & { minSize: MinSize } {
  return {
    text: look.text ?? '',
    background: look.paper ? { paint: look.paper } : look.background ?? STICKY_DEFAULTS.background,
    padding: look.padding ?? STICKY_DEFAULTS.padding,
    style: look.style ?? STICKY_DEFAULTS.style,
    verticalAlign: look.verticalAlign ?? STICKY_DEFAULTS.verticalAlign,
    overflow: look.overflow ?? STICKY_DEFAULTS.overflow,
    edge: look.edge ?? STICKY_DEFAULTS.edge,
    shadow: look.shadow ?? STICKY_DEFAULTS.shadow,
    minSize: look.minSize ?? STICKY_DEFAULTS.minSize,
    fill: look.ink ? { paint: look.ink } : look.fill ?? STICKY_DEFAULTS.fill,
  };
}

/** The kit's `sticky` insert as an `InsertNodeFactory`, for a canvas that
 *  wraps it — to tag the data with a `kind`, say — under `insertNodeFactories`. */
export const stickyNodeFactory: InsertNodeFactory = (_bounds, extras) => ({
  data: stickyData(extras as StickyLook & { text?: string }),
});
