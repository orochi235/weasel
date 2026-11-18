/** The properties a `text` node edits: its content, background, and typography beside the standard shape sections. */
import type { PrefBooleanEncoding, PrefLeaf, PrefSection } from '@weasel-js/prefs-schema';
import { decimal } from '@weasel-js/quantity';
import { shapePropertiesSchema, type NodePropertiesEntry } from '@weasel-js/core';
import { icon } from '../icons.gen';

const TWO_PLACES = decimal({ maxPlaces: 2, grouping: false });

/** `TextStyle.fontStyle` as an Italic flag. Off removes the field rather than
 *  storing `'normal'`, which is what an absent one already means. */
const italicEncoding: PrefBooleanEncoding = {
  read: (stored) => stored === 'italic',
  write: (on) => (on ? 'italic' : undefined),
};

/** `data.overflow` as a flag: on is `'clip'`, and off removes the key, since
 *  absent draws past the box. */
const overflowEncoding: PrefBooleanEncoding = {
  read: (stored) => stored === 'clip',
  write: (on) => (on ? 'clip' : undefined),
};

/** `data.fit` as a flag: on is `'shrink'`, and off removes the key, since
 *  absent sets the text at its own size. */
const fitEncoding: PrefBooleanEncoding = {
  read: (stored) => stored === 'shrink',
  write: (on) => (on ? 'shrink' : undefined),
};

/** A text node's `data.background`: a `Fill`, as `data.fill` is, painted over
 *  the whole box rather than the glyphs. */
const BACKGROUND_LEAF: PrefLeaf = {
  kind: 'object',
  block: true,
  name: 'Background',
  description: 'Paint behind the text, over the whole box.',
  default: { paint: { kind: 'solid', color: '#ffffffff' } },
  children: {
    paint: { kind: 'paint', name: 'Background', description: 'Paint behind the text.', default: { kind: 'solid', color: '#ffffffff' }, alpha: true, block: true },
  },
};

const CONTENT: PrefSection = {
  name: 'Content',
  members: {
    // `block`: the content is the section, so a 64px label column
    // reading "Text" inside a section reading "Text" is one word
    // twice and a narrower field for the sake of it.
    'data.text': { kind: 'string', name: 'Text', description: 'Text content.', absentIsDefault: true, default: '', block: true },
  },
};

const TYPOGRAPHY: PrefSection = {
  // Headless: `Character` and `Paragraph` carry the labels, and a
  // `Typography` heading over them names nothing a reader can't
  // already see.
  name: '',
  members: {
    // One object leaf, not a row of siblings addressing into it:
    // `data.style` is a `TextStyle`, and its character and
    // paragraph fields are one value that reads as two lists.
    // The groups head those lists and contribute nothing to the
    // path — a field inside one is still a field of the style.
    'data.style': {
      kind: 'object',
      name: 'Style',
      description: 'Typography for the whole node. Its color is the node\'s own `data.fill`, in Appearance.',
      default: {},
      absentIsDefault: true,
      block: true,
      children: {
        character: {
          name: 'Character',
          members: {
            fontFamily: { kind: 'font-family', name: 'Font', description: 'Registered font family.', absentIsDefault: true, default: 'sans-serif' },
            fontSize: { kind: 'number', display: TWO_PLACES, name: 'Size', description: 'Font size, world units.', absentIsDefault: true, default: 16, min: 1, step: 1, pair: { with: 'data.style.fontWeight', label: 'Size / weight' } },
            fontWeight: { kind: 'font-weight', name: 'Weight', description: 'Font weight, from the faces the family has.', absentIsDefault: true, default: 400 },
            // One row of segments, the strip every text editor
            // draws: the slant, the three rules, then the two
            // scripts. Italic is a flag here although the field
            // is `fontStyle`, whose only other value is upright.
            fontStyle: { kind: 'boolean', name: 'Italic', description: 'Set the text in its italic face.', default: false, control: 'toggle', icon: icon('core:italic'), short: ['I'], pair: { with: ['data.style.underline', 'data.style.strikethrough', 'data.style.overline', 'data.style.script'], label: 'Style' }, encoding: italicEncoding },
            underline: { kind: 'boolean', name: 'Underline', description: 'Underline the text.', absentIsDefault: true, default: false, control: 'toggle', icon: icon('core:underline'), short: ['U'] },
            strikethrough: { kind: 'boolean', name: 'Strikethrough', description: 'Strike through the text.', absentIsDefault: true, default: false, control: 'toggle', icon: icon('core:strikethrough'), short: ['S'] },
            overline: { kind: 'boolean', name: 'Overline', description: 'Rule the text above its ascent.', absentIsDefault: true, default: false, control: 'toggle', icon: icon('core:overline'), short: ['O'] },
            script: { kind: 'enum', name: 'Script', description: 'Set the text smaller and raised or lowered, on the line it would otherwise hold.', default: undefined, control: 'toggle', clearable: true, options: [{ value: 'super', label: 'Superscript', icon: icon('core:superscript') }, { value: 'sub', label: 'Subscript', icon: icon('core:subscript') }] },
            letterSpacing: { kind: 'number', display: TWO_PLACES, name: 'Tracking', description: 'Extra advance per glyph, world units.', absentIsDefault: true, default: 0, step: 0.1 },
            textTransform: { kind: 'enum', name: 'Case', description: 'Draw the text in capitals, lowercase or title case. The text itself is unchanged.', absentIsDefault: true, default: 'none', control: 'toggle', options: [{ value: 'none', label: 'None', short: ['–'] }, { value: 'uppercase', label: 'Uppercase', short: ['AA'] }, { value: 'lowercase', label: 'Lowercase', short: ['aa'] }, { value: 'capitalize', label: 'Capitalize', short: ['Aa'] }] },
            fontVariantCaps: { kind: 'enum', name: 'Small caps', description: 'Draw lowercase letters as smaller capitals. The text itself is unchanged.', absentIsDefault: true, default: 'normal', control: 'toggle', options: [{ value: 'normal', label: 'Normal', short: ['–'] }, { value: 'small-caps', label: 'Small caps', short: ['Sc'] }] },
            lang: { kind: 'string', name: 'Language', description: 'A BCP 47 tag, such as sr or ur, that picks the forms a font draws for that language. Empty means none.', default: '' },
          },
        },
        paragraph: {
          name: 'Paragraph',
          members: {
            lineHeight: { kind: 'number', display: TWO_PLACES, name: 'Leading', description: 'Line height as a multiple of font size.', absentIsDefault: true, default: 1.2, min: 0.5, step: 0.1 },
            wrap: { kind: 'boolean', name: 'Wrap', description: 'Break lines between words at the box width.', absentIsDefault: true, default: false, control: 'switch' },
            tabSize: { kind: 'number', display: TWO_PLACES, name: 'Tab size', description: 'Distance between tab stops, in spaces.', absentIsDefault: true, default: 8, min: 1, step: 1 },
            direction: { kind: 'enum', name: 'Direction', description: 'Reading direction. Auto takes each paragraph\'s from its first strong character.', absentIsDefault: true, default: 'auto', control: 'toggle', options: [{ value: 'auto', label: 'Auto', short: ['Auto'] }, { value: 'ltr', label: 'Left to right', short: ['LTR'] }, { value: 'rtl', label: 'Right to left', short: ['RTL'] }] },
            // Last, so the box's vertical alignment — a field of
            // the node rather than of its style — follows it.
            align: { kind: 'enum', name: 'Align', description: 'Horizontal alignment.', absentIsDefault: true, default: 'left', control: 'toggle', options: [{ value: 'left', label: 'Left', icon: icon('core:textAlignLeft') }, { value: 'center', label: 'Center', icon: icon('core:textAlignCenter') }, { value: 'right', label: 'Right', icon: icon('core:textAlignRight') }, { value: 'justify', label: 'Justify', icon: icon('core:textAlignJustify') }, { value: 'start', label: 'Start', icon: icon('core:textAlignStart') }, { value: 'end', label: 'End', icon: icon('core:textAlignEnd') }] },
          },
        },
      },
    },
    'data.padding': { kind: 'number', display: TWO_PLACES, measure: 'length', name: 'Padding', description: 'Inset from the box to the text on every side, world units.', absentIsDefault: true, default: 0, min: 0, step: 1 },
    'data.verticalAlign': { kind: 'enum', name: 'Vertical', description: 'Where the lines sit in the box\'s height.', absentIsDefault: true, default: 'top', control: 'toggle', options: [{ value: 'top', label: 'Top', icon: icon('core:textAlignTop') }, { value: 'center', label: 'Middle', icon: icon('core:textAlignMiddle') }, { value: 'bottom', label: 'Bottom', icon: icon('core:textAlignBottom') }] },
    'data.overflow': { kind: 'boolean', name: 'Clip', description: 'Cut the text at the box\'s edge instead of drawing it past.', default: false, control: 'switch', encoding: overflowEncoding },
    'data.fit': { kind: 'boolean', name: 'Shrink to fit', description: 'Set the text smaller, never larger, until its lines fit the box.', default: false, control: 'switch', encoding: fitEncoding },
  },
};

/** The `text` kind's properties, for a `SelectionPanel` given `textPreset`. */
export const TEXT_PROPERTIES: NodePropertiesEntry = {
  name: 'text',
  schema: shapePropertiesSchema({
    // What the node *is* outranks how it is painted: a text node's copy is the first thing an editor reaches for.
    lead: { content: CONTENT },
    appearance: { 'data.background': BACKGROUND_LEAF },
    trail: { text: TYPOGRAPHY },
  }),
};
