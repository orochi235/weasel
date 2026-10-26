import { prefUnit, type PrefBoundAt, type PrefBooleanEncoding, type PrefEnum, type PrefEnumEncoding, type PrefLeaf, type PrefNumberUnit, type PrefSection } from '@weasel-js/prefs';
import { inferredNodeRouting } from './defaultNodeRouting';
import { KIT_SHAPE_KINDS, shapeKindInfo } from 'core/shapeKinds';
import { listMarkers, markerGeneration } from '@weasel-js/stroke';
import { dashForStrokeStyle, strokeDashStyleOf } from '@weasel-js/paint';
import { resolveAlign } from '@weasel-js/text';
import type { NodePropertiesEntry } from 'core/scene/NodeProperties';
import { minSizeOf, type MinSize } from 'core/scene/minSize';
import { ANGLE_RADIANS, decimal } from '@weasel-js/quantity';
import { poseLinearOf } from '@weasel-js/geom';
import { settleShapeGenerator } from 'features/paths/shapeGenerator';
import { SHAPE_GENERATOR_SECTIONS } from './shapeGeneratorProperties';
import { icon } from '../../icons.gen';
import type { IconRef } from '@weasel-js/icons';

/** Radians-stored / degrees-shown conversion for `pose.rotation` leaves.
 *  Display rounds to 0.1° so a canonical radian value doesn't render as
 *  a 15-digit float. */
export const rotationDegreesUnit: PrefNumberUnit = prefUnit(ANGLE_RADIANS, 'deg', {
  precision: 1,
  suffix: '°',
});

/** How a typed number reads. The stored value keeps every digit a drag or a scale gave it. */
const TWO_PLACES = decimal({ maxPlaces: 2, grouping: false });

/** `Stroke.width` off a partly-typed stroke object, or `undefined`. */
function strokeWidthOf(stroke: Record<string, unknown> | undefined): number | { px: number } | undefined {
  const w = stroke?.width;
  if (typeof w === 'number') return w;
  if (typeof w === 'object' && w !== null && typeof (w as { px?: unknown }).px === 'number') {
    return w as { px: number };
  }
  return undefined;
}

/** `Stroke.dash` — a stored array of lengths — read and written as a named
 *  style. The presets are multiples of the sibling `width`, which is why the
 *  encoding is handed the whole stroke rather than the field. */
const strokeDashEncoding: PrefEnumEncoding = {
  read: (dash, stroke) =>
    stroke === undefined
      ? undefined
      : strokeDashStyleOf(Array.isArray(dash) ? (dash as number[]) : undefined, strokeWidthOf(stroke)),
  write: (style, stroke) =>
    style === 'dashed' || style === 'dotted'
      ? dashForStrokeStyle(style, strokeWidthOf(stroke))
      // `solid` is stored as no dash at all. `custom` is reportable, not
      // authorable: it names an imported array, and the array it names is the
      // one already stored.
      : style === 'solid'
        ? undefined
        : stroke?.dash,
};

/** `Stroke.markerStart` / `markerMid` / `markerEnd` — a `MarkerRef` — read and
 *  written as a bare key, with the empty string standing for no marker. */
const markerEncoding: PrefEnumEncoding = {
  read: (ref) => {
    if (typeof ref === 'string') return ref;
    if (ref && typeof ref === 'object' && 'key' in ref) return String((ref as { key: string }).key);
    return '';
  },
  write: (value) => (value === '' ? undefined : value),
};

/** `TextStyle.fontStyle` as an Italic flag. Off removes the field rather than
 *  storing `'normal'`, which is what an absent one already means. */
const italicEncoding: PrefBooleanEncoding = {
  read: (stored) => stored === 'italic',
  write: (on) => (on ? 'italic' : undefined),
};

/** `TextStyle.align` read as the edge that paints, or as `justify`. The model
 *  also holds the reading-order pair `start` / `end`, which name an edge only
 *  under a stated `direction`. Under `auto` each paragraph takes its own from
 *  its text, so no segment is lit. A click writes the edge. */
const alignEncoding: PrefEnumEncoding = {
  read: (stored, style) => {
    if (stored === 'start' || stored === 'end') {
      const direction = style?.direction;
      return direction === 'ltr' || direction === 'rtl' ? resolveAlign(stored, direction) : undefined;
    }
    return stored as string | undefined;
  },
  write: (edge) => edge,
};

const DEFAULT_NIB = { angle: Math.PI / 6, ratio: 0.25 };

/** `Stroke.nib` as a flag: on keeps the nib held, or starts a default one,
 *  and off removes it. */
const nibEncoding: PrefBooleanEncoding = {
  read: (stored) => stored != null && typeof stored === 'object',
  write: (on, stroke) => (on ? (stroke?.nib ?? DEFAULT_NIB) : undefined),
};

/** `pose.transform` as a flag: on while the pose carries a skew or a per-axis
 *  scale, and off removes it. On keeps the one held, since a flag cannot
 *  author a matrix. */
const transformEncoding: PrefBooleanEncoding = {
  read: (stored) => poseLinearOf({ transform: stored }) !== null,
  write: (on, pose) => (on ? pose?.transform : undefined),
};

/** `data.overflow` as a flag: on is `'clip'`, and off removes the key, since
 *  absent draws past the box. */
const overflowEncoding: PrefBooleanEncoding = {
  read: (stored) => stored === 'clip',
  write: (on) => (on ? 'clip' : undefined),
};

type MarkerOptions = PrefEnum['options'];

/** The glyph of each built-in marker. A marker a consumer registers has none, and its option reads as text. */
const MARKER_ICONS: Readonly<Record<string, IconRef>> = {
  arrow: icon('markerArrow'),
  'arrow-open': icon('markerArrowOpen'),
  'arrow-concave': icon('markerArrowConcave'),
  'triangle-hollow': icon('markerTriangleHollow'),
  diamond: icon('markerDiamond'),
  'diamond-hollow': icon('markerDiamondHollow'),
  circle: icon('markerCircle'),
  square: icon('markerSquare'),
  bar: icon('markerBar'),
  dot: icon('markerDot'),
  'crow-one': icon('markerCrowOne'),
  'crow-many': icon('markerCrowMany'),
  'crow-zero-one': icon('markerCrowZeroOne'),
  'crow-one-many': icon('markerCrowOneMany'),
  'crow-zero-many': icon('markerCrowZeroMany'),
};
let markerOptionsCache: { generation: number; options: MarkerOptions } | undefined;

/** A `select` rather than a `toggle`: nine options will not fit a segmented
 *  strip. One array per state of the registry, so a reader comparing
 *  references sees a change only when the set changed. */
function markerOptions(): MarkerOptions {
  const generation = markerGeneration();
  if (markerOptionsCache?.generation !== generation) {
    markerOptionsCache = {
      generation,
      options: [
        { value: '', label: 'None', icon: icon('markerNone') },
        ...listMarkers().map((m) => ({ value: m.id, label: m.id, icon: MARKER_ICONS[m.id] })),
      ],
    };
  }
  return markerOptionsCache.options;
}

// An accessor: these schemas are built at module load, before a consumer can
// have registered a marker, so the list is read from the registry when asked.
function markerLeaf(leaf: Omit<PrefEnum, 'kind' | 'options' | 'default' | 'control' | 'encoding' | 'clearable'>): PrefEnum {
  return {
    kind: 'enum', default: '', control: 'select', encoding: markerEncoding, ...leaf,
    get options() { return markerOptions(); },
  };
}

/** `data.fill` is a whole `Fill`, so it is an object leaf, as the stroke is.
 *  Its field is a `paint` leaf, not a `color` one, because a color control
 *  would read `undefined` off a gradient and write a bare string over it.
 *  `block` for the same reason every stroke field is: the kind bar and the
 *  per-kind editor want the width a 64px label column takes. */
const FILL_LEAF: PrefLeaf = {
  kind: 'object',
  name: 'Fill',
  description: 'Fill paint.',
  default: { paint: { kind: 'solid', color: '#000000ff' } },
  block: true,
  children: {
    paint: { kind: 'paint', name: 'Fill', description: 'Fill paint.', default: { kind: 'solid', color: '#000000ff' }, alpha: true, block: true },
  },
};

/** A text node's `data.background`: a `Fill`, as `data.fill` is, painted over
 *  the whole box rather than the glyphs. */
const BACKGROUND_LEAF: PrefLeaf = {
  ...FILL_LEAF,
  name: 'Background',
  description: 'Paint behind the text, over the whole box.',
  default: { paint: { kind: 'solid', color: '#ffffffff' } },
  children: {
    paint: { kind: 'paint', name: 'Background', description: 'Paint behind the text.', default: { kind: 'solid', color: '#ffffffff' }, alpha: true, block: true },
  },
};

/** A whole `Stroke`: paint and line geometry, one value. */
const STROKE_LEAF: PrefLeaf = {
  kind: 'object',
  name: 'Stroke',
  description: 'Stroke paint and line geometry.',
  default: { paint: { kind: 'solid', color: '#000000ff' }, width: 1 },
  block: true,
  children: {
    // Every row is `block`: under a heading already reading STROKE,
    // a 64px label column spells the section name again and takes
    // the width the controls need. Each field leads with its own
    // glyph instead.
    // Unpaired: the paint field is a whole paint editor — a kind bar
    // over a per-kind body — and cannot share a row with a slider.
    width: { kind: 'number', name: 'Width', description: 'Stroke width, world units.', absentIsDefault: true, default: 1, min: 0, max: 20, step: 0.5, control: 'slider', icon: icon('strokeWidth'), block: true },
    paint: { kind: 'paint', name: 'Paint', description: 'Stroke paint.', default: { kind: 'solid', color: '#000000ff' }, alpha: true, block: true },
    // Three options each: a segmented control shows every one at
    // once where a select shows the current one and hides the rest
    // behind a click.
    cap: { kind: 'enum', name: 'Cap', description: 'How an open end is drawn.', absentIsDefault: true, default: 'butt', control: 'toggle', block: true, pair: { with: ['data.stroke.join', 'data.stroke.align'], label: 'Line' }, options: [{ value: 'butt', label: 'Butt', icon: icon('capButt') }, { value: 'round', label: 'Round', icon: icon('capRound') }, { value: 'square', label: 'Square', icon: icon('capSquare') }] },
    join: { kind: 'enum', name: 'Join', description: 'How a corner is drawn.', absentIsDefault: true, default: 'miter', control: 'toggle', block: true, options: [{ value: 'miter', label: 'Miter', icon: icon('joinMiter') }, { value: 'round', label: 'Round', icon: icon('joinRound') }, { value: 'bevel', label: 'Bevel', icon: icon('joinBevel') }] },
    align: { kind: 'enum', name: 'Align', description: 'Where the ribbon sits relative to the edge.', absentIsDefault: true, default: 'center', control: 'toggle', block: true, options: [{ value: 'inner', label: 'Inner', icon: icon('alignInner') }, { value: 'center', label: 'Center', icon: icon('alignCenter') }, { value: 'outer', label: 'Outer', icon: icon('alignOuter') }] },
    // Its own row: three bars already fill the one above, and the
    // dash pattern is a property of the line rather than of how the
    // ribbon meets the geometry.
    dash: { kind: 'enum', name: 'Style', description: 'Solid, dashed or dotted. Dash lengths are multiples of the stroke width, so a style holds as the width changes.', default: 'solid', control: 'toggle', block: true, encoding: strokeDashEncoding, options: [{ value: 'solid', label: 'Solid', icon: icon('dashSolid') }, { value: 'dashed', label: 'Dashed', icon: icon('dashDashed') }, { value: 'dotted', label: 'Dotted', icon: icon('dashDotted') }, { value: 'custom', label: 'Custom', icon: icon('dashCustom'), disabled: true }] },
    nib: { kind: 'boolean', name: 'Nib', description: 'A broad pen: the stroke is its full width moving across the nib, and thinner moving along it.', default: false, control: 'switch', block: true, encoding: nibEncoding },
    'nib.angle': { kind: 'number', name: 'Angle', description: 'The nib\'s edge, counterclockwise from level.', default: DEFAULT_NIB.angle, step: 1, unit: rotationDegreesUnit, block: true, showIf: { path: 'data.stroke.nib' }, pair: { with: 'data.stroke.nib.ratio', label: 'Nib' } },
    'nib.ratio': { kind: 'number', name: 'Thinnest', description: 'The width moving along the nib, as a fraction of the width moving across it.', default: DEFAULT_NIB.ratio, min: 0, max: 1, step: 0.05, control: 'slider', block: true, showIf: { path: 'data.stroke.nib' } },
    markerStart: markerLeaf({ name: 'Start', description: 'Marker at the first vertex of each open subpath.', block: true, pair: { with: ['data.stroke.markerMid', 'data.stroke.markerEnd'], label: 'Markers' } }),
    markerMid: markerLeaf({ name: 'Mid', description: 'Marker at every interior authored vertex.', block: true }),
    markerEnd: markerLeaf({ name: 'End', description: 'Marker at the last vertex of each open subpath.', block: true }),
  },
};

/** A box side's floor: the node's `data.minSize`, which resize and insert hold it to as well. */
const minSizeAt = (side: keyof MinSize): PrefBoundAt => (read) => minSizeOf({ minSize: read('data.minSize') })?.[side];

/** The pose box, its rotation, and the `transform` inside that. */
const LAYOUT: PrefSection = {
  name: 'Layout',
  members: {
    'pose.x': { kind: 'number', display: TWO_PLACES, measure: 'length', name: 'X', description: 'Left edge, world units.', default: 0, pair: { with: 'pose.y', label: 'Position' } },
    'pose.y': { kind: 'number', display: TWO_PLACES, measure: 'length', name: 'Y', description: 'Top edge, world units.', default: 0 },
    'pose.width': { kind: 'number', display: TWO_PLACES, measure: 'length', name: 'W', description: 'Width, world units.', default: 0, min: 0, minAt: minSizeAt('width'), pair: { with: 'pose.height', label: 'Size' } },
    'pose.height': { kind: 'number', display: TWO_PLACES, measure: 'length', name: 'H', description: 'Height, world units.', default: 0, min: 0, minAt: minSizeAt('height') },
    'pose.rotation': { kind: 'number', name: 'Rotation', description: 'Rotation about the box center.', default: 0, step: 1, unit: rotationDegreesUnit, absentIsDefault: true },
    'pose.transform': { kind: 'boolean', name: 'Skew', description: 'The skew or per-axis scale the box and rotation cannot hold. Off removes it.', default: false, control: 'switch', encoding: transformEncoding },
  },
};

/** Build the standard shape schema — Layout (pose box + rotation) +
 *  Appearance (fill / stroke), optionally a Text group. Matches the kit's
 *  builtin-shape data template (`{ path, fill, stroke?, text? }`,
 *  `useBuiltinShapeTools`). */
function shapeSchema(opts: { text?: boolean; generators?: readonly string[] } = {}): PrefSection {
  return {
    name: 'Properties',
    members: {
      layout: LAYOUT,
      ...Object.fromEntries((opts.generators ?? []).map((g) => [g, SHAPE_GENERATOR_SECTIONS[g]])),
      // What the node *is* outranks how it is painted: a text node's copy is
      // the first thing an editor reaches for.
      ...(opts.text
        ? {
            content: {
              name: 'Content',
              members: {
                // `block`: the content is the section, so a 64px label column
                // reading "Text" inside a section reading "Text" is one word
                // twice and a narrower field for the sake of it.
                'data.text': { kind: 'string', name: 'Text', description: 'Text content.', absentIsDefault: true, default: '', block: true },
              },
            },
          }
        : {}),
      appearance: {
        // Headless: `Fill` and `Stroke` head their own blocks, and an
        // `Appearance` rule over them names neither of the two paints a
        // reader is looking at.
        name: '',
        members: {
          'data.fill': FILL_LEAF,
          ...(opts.text ? { 'data.background': BACKGROUND_LEAF } : {}),
          // An object leaf: `data.stroke` is a whole `Stroke`, and its fields
          // belong to one value. Sibling leaves addressing into it would each
          // write one field of a value they can only half see.
          'data.stroke': STROKE_LEAF,
        },
      },
      ...(opts.text
        ? {
            text: {
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
                        fontStyle: { kind: 'boolean', name: 'Italic', description: 'Set the text in its italic face.', default: false, control: 'toggle', icon: icon('italic'), short: ['I'], pair: { with: ['data.style.underline', 'data.style.strikethrough', 'data.style.overline', 'data.style.script'], label: 'Style' }, encoding: italicEncoding },
                        underline: { kind: 'boolean', name: 'Underline', description: 'Underline the text.', absentIsDefault: true, default: false, control: 'toggle', icon: icon('underline'), short: ['U'] },
                        strikethrough: { kind: 'boolean', name: 'Strikethrough', description: 'Strike through the text.', absentIsDefault: true, default: false, control: 'toggle', icon: icon('strikethrough'), short: ['S'] },
                        overline: { kind: 'boolean', name: 'Overline', description: 'Rule the text above its ascent.', absentIsDefault: true, default: false, control: 'toggle', icon: icon('overline'), short: ['O'] },
                        script: { kind: 'enum', name: 'Script', description: 'Set the text smaller and raised or lowered, on the line it would otherwise hold.', default: undefined, control: 'toggle', clearable: true, options: [{ value: 'super', label: 'Superscript', icon: icon('superscript') }, { value: 'sub', label: 'Subscript', icon: icon('subscript') }] },
                        letterSpacing: { kind: 'number', display: TWO_PLACES, name: 'Tracking', description: 'Extra advance per glyph, world units.', absentIsDefault: true, default: 0, step: 0.1 },
                        textTransform: { kind: 'enum', name: 'Case', description: 'Draw the text in capitals, lowercase or title case. The text itself is unchanged.', absentIsDefault: true, default: 'none', control: 'toggle', options: [{ value: 'none', label: 'None', short: ['–'] }, { value: 'uppercase', label: 'Uppercase', short: ['AA'] }, { value: 'lowercase', label: 'Lowercase', short: ['aa'] }, { value: 'capitalize', label: 'Capitalize', short: ['Aa'] }] },
                        fontVariantCaps: { kind: 'enum', name: 'Small caps', description: 'Draw lowercase letters as smaller capitals. The text itself is unchanged.', absentIsDefault: true, default: 'normal', control: 'toggle', options: [{ value: 'normal', label: 'Normal', short: ['–'] }, { value: 'small-caps', label: 'Small caps', short: ['Sc'] }] },
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
                        align: { kind: 'enum', name: 'Align', description: 'Horizontal alignment.', absentIsDefault: true, default: 'left', control: 'toggle', encoding: alignEncoding, options: [{ value: 'left', label: 'Left', icon: icon('textAlignLeft') }, { value: 'center', label: 'Center', icon: icon('textAlignCenter') }, { value: 'right', label: 'Right', icon: icon('textAlignRight') }, { value: 'justify', label: 'Justify', icon: icon('textAlignJustify') }] },
                      },
                    },
                  },
                },
                'data.padding': { kind: 'number', display: TWO_PLACES, measure: 'length', name: 'Padding', description: 'Inset from the box to the text on every side, world units.', absentIsDefault: true, default: 0, min: 0, step: 1 },
                'data.verticalAlign': { kind: 'enum', name: 'Vertical', description: 'Where the lines sit in the box\'s height.', absentIsDefault: true, default: 'top', control: 'toggle', options: [{ value: 'top', label: 'Top', icon: icon('textAlignTop') }, { value: 'center', label: 'Middle', icon: icon('textAlignMiddle') }, { value: 'bottom', label: 'Bottom', icon: icon('textAlignBottom') }] },
                'data.overflow': { kind: 'boolean', name: 'Clip', description: 'Cut the text at the box\'s edge instead of drawing it past.', default: false, control: 'switch', encoding: overflowEncoding },
              },
            },
          }
        : {}),
    },
  };
}

/** The kinds whose nodes can hold a `data.generator`, and which kinds of it. */
const GENERATED_KINDS: Record<string, readonly string[] | undefined> = {
  polygon: ['polygon'],
  star: ['star'],
  path: ['polygon', 'star'],
};

function shapeEntry(name: string): NodePropertiesEntry {
  const generators = GENERATED_KINDS[name];
  return {
    name,
    schema: shapeSchema({ text: shapeKindInfo(name)?.text ?? false, ...(generators ? { generators } : {}) }),
    ...(generators ? { settle: settleShapeGenerator } : {}),
  };
}

/**
 * Default properties-trait entries covering the kit's built-in shape
 * kinds (`KIT_SHAPE_KINDS`) — the sibling of `defaultNodeRouting`. Every
 * kind gets the standard box schema; `text` adds a Text group. In
 * lockstep with `KIT_SHAPE_KINDS` by construction (derived via `.map`).
 */
export const defaultNodeProperties: readonly NodePropertiesEntry[] = KIT_SHAPE_KINDS.map(shapeEntry);

/**
 * Properties-trait entries for the *inferred* routing kinds
 * (`inferredNodeRouting`: `text` / `path` / `image`) — the vocabulary
 * consumers produce when they don't tag `data.kind` (e.g. WeaselDraw).
 * In lockstep with `inferredNodeRouting` by construction.
 */
export const inferredNodeProperties: readonly NodePropertiesEntry[] =
  inferredNodeRouting.map((e) => shapeEntry(e.name));
