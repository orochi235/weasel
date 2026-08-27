import { inferredNodeRouting } from './defaultNodeRouting';
import { KIT_SHAPE_KINDS } from './shapeKinds';
import type { NodePropertiesEntry } from 'core/scene/NodeProperties';
import type { ToolPrefGroup, ToolPrefNumberUnit } from 'tools/prefs';

const RAD_TO_DEG = 180 / Math.PI;

/** Radians-stored / degrees-shown conversion for `pose.rotation` leaves.
 *  Display rounds to 0.1° so a canonical radian value doesn't render as
 *  a 15-digit float. */
export const rotationDegreesUnit: ToolPrefNumberUnit = {
  toDisplay: (rad) => Math.round(rad * RAD_TO_DEG * 10) / 10,
  fromDisplay: (deg) => deg / RAD_TO_DEG,
  suffix: '°',
};

/** Build the standard shape schema — Layout (pose box + rotation) +
 *  Appearance (fill / stroke), optionally a Text group. Matches the kit's
 *  builtin-shape data template (`{ path, fill, stroke?, text? }`,
 *  `useBuiltinShapeTools`). */
function shapeSchema(opts: { text?: boolean } = {}): ToolPrefGroup {
  return {
    name: 'Properties',
    children: {
      layout: {
        name: 'Layout',
        children: {
          'pose.x': { kind: 'number', name: 'X', description: 'Left edge, world units.', default: 0, pair: 'Position' },
          'pose.y': { kind: 'number', name: 'Y', description: 'Top edge, world units.', default: 0, pair: 'Position' },
          'pose.width': { kind: 'number', name: 'W', description: 'Width, world units.', default: 0, min: 0, pair: 'Size' },
          'pose.height': { kind: 'number', name: 'H', description: 'Height, world units.', default: 0, min: 0, pair: 'Size' },
          'pose.rotation': { kind: 'number', name: 'Rotation', description: 'Rotation about the box center.', default: 0, step: 1, unit: rotationDegreesUnit },
        },
      },
      // What the node *is* outranks how it is painted: a text node's copy is
      // the first thing an editor reaches for.
      ...(opts.text
        ? {
            content: {
              name: 'Content',
              children: {
                // `block`: the content is the section, so a 64px label column
                // reading "Text" inside a section reading "Text" is one word
                // twice and a narrower field for the sake of it.
                'data.text': { kind: 'string', name: 'Text', description: 'Text content.', default: '', block: true },
              },
            },
          }
        : {}),
      appearance: {
        name: 'Appearance',
        children: {
          // A `paint` leaf, not a `color` one: `data.fill` is the tagged
          // `FillStyle` union, so a color control pointed at it would read
          // `undefined` off a gradient and write a bare string over it.
          'data.fill': { kind: 'paint', name: 'Fill', description: 'Fill paint.', default: { fill: 'solid', color: '#000000ff' }, alpha: true },
          // An object leaf: `data.stroke` is a whole `Stroke`, and its fields
          // belong to one value. Sibling leaves addressing into it would each
          // write one field of a value they can only half see.
          //
          // `dash` is absent on purpose: it is a `number[]`, and no leaf kind
          // edits one. It survives import, export and rendering untouched.
          'data.stroke': {
            kind: 'object',
            name: 'Stroke',
            description: 'Stroke paint and line geometry.',
            default: { paint: { fill: 'solid', color: '#000000ff' }, width: 1 },
            block: true,
            children: {
              // Both rows are `block`: under a heading already reading STROKE,
              // a 64px label column spells the section name again and takes
              // the width the controls need. Each field leads with its own
              // glyph instead.
              width: { kind: 'number', name: 'Width', description: 'Stroke width, world units.', default: 1, min: 0, max: 20, step: 0.5, control: 'slider', icon: 'strokeWidth', block: true, pair: 'Paint' },
              paint: { kind: 'paint', name: 'Color', description: 'Stroke paint.', default: { fill: 'solid', color: '#000000ff' }, alpha: true, block: true, pair: 'Paint' },
              // Three options each: a segmented control shows every one at
              // once where a select shows the current one and hides the rest
              // behind a click.
              cap: { kind: 'enum', name: 'Cap', description: 'How an open end is drawn.', default: 'butt', control: 'toggle', block: true, pair: 'Line', options: [{ value: 'butt', label: 'Butt', icon: 'capButt' }, { value: 'round', label: 'Round', icon: 'capRound' }, { value: 'square', label: 'Square', icon: 'capSquare' }] },
              join: { kind: 'enum', name: 'Join', description: 'How a corner is drawn.', default: 'miter', control: 'toggle', block: true, pair: 'Line', options: [{ value: 'miter', label: 'Miter', icon: 'joinMiter' }, { value: 'round', label: 'Round', icon: 'joinRound' }, { value: 'bevel', label: 'Bevel', icon: 'joinBevel' }] },
              align: { kind: 'enum', name: 'Align', description: 'Where the ribbon sits relative to the edge.', default: 'center', control: 'toggle', block: true, pair: 'Line', options: [{ value: 'inner', label: 'Inner', icon: 'alignInner' }, { value: 'center', label: 'Center', icon: 'alignCenter' }, { value: 'outer', label: 'Outer', icon: 'alignOuter' }] },
            },
          },
        },
      },
      ...(opts.text
        ? {
            text: {
              // Headless: `Character` and `Paragraph` carry the labels, and a
              // `Typography` heading over them names nothing a reader can't
              // already see.
              name: '',
              children: {
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
                  block: true,
                  children: {
                    character: {
                      name: 'Character',
                      children: {
                        fontFamily: { kind: 'font-family', name: 'Font', description: 'Registered font family.', default: 'sans-serif' },
                        fontSize: { kind: 'number', name: 'Size', description: 'Font size, world units.', default: 16, min: 1, step: 1, pair: 'Size / weight' },
                        fontWeight: { kind: 'number', name: 'Weight', description: 'Font weight, 100–900.', default: 400, min: 100, max: 900, step: 100, pair: 'Size / weight' },
                        fontStyle: { kind: 'enum', name: 'Style', description: 'Upright or italic.', default: 'normal', options: [{ value: 'normal', label: 'Normal' }, { value: 'italic', label: 'Italic' }] },
                        letterSpacing: { kind: 'number', name: 'Tracking', description: 'Extra advance per glyph, world units.', default: 0, step: 0.1 },
                        underline: { kind: 'boolean', name: 'Underline', description: 'Underline the text.', default: false },
                        strikethrough: { kind: 'boolean', name: 'Strikethrough', description: 'Strike through the text.', default: false },
                      },
                    },
                    paragraph: {
                      name: 'Paragraph',
                      children: {
                        align: { kind: 'enum', name: 'Align', description: 'Horizontal alignment.', default: 'left', control: 'toggle', options: [{ value: 'left', label: 'Left', short: 'L' }, { value: 'center', label: 'Center', short: 'C' }, { value: 'right', label: 'Right', short: 'R' }] },
                        lineHeight: { kind: 'number', name: 'Leading', description: 'Line height as a multiple of font size.', default: 1.2, min: 0.5, step: 0.1 },
                      },
                    },
                  },
                },
              },
            },
          }
        : {}),
    },
  };
}

/**
 * Default properties-trait entries covering the kit's built-in shape
 * kinds (`KIT_SHAPE_KINDS`) — the sibling of `defaultNodeRouting`. Every
 * kind gets the standard box schema; `text` adds a Text group. In
 * lockstep with `KIT_SHAPE_KINDS` by construction (derived via `.map`).
 */
export const defaultNodeProperties: readonly NodePropertiesEntry[] =
  KIT_SHAPE_KINDS.map((name) => ({
    name,
    schema: shapeSchema({ text: name === 'text' }),
  }));

/**
 * Properties-trait entries for the *inferred* routing kinds
 * (`inferredNodeRouting`: `text` / `path` / `image`) — the vocabulary
 * consumers produce when they don't tag `data.kind` (e.g. WeaselDraw).
 * In lockstep with `inferredNodeRouting` by construction.
 */
export const inferredNodeProperties: readonly NodePropertiesEntry[] =
  inferredNodeRouting.map((e) => ({
    name: e.name,
    schema: shapeSchema({ text: e.name === 'text' }),
  }));
