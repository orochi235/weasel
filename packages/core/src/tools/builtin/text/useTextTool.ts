import { useMemo, createElement } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import type { ToolPrefGroup } from '../../prefs';
import { TextIcon } from '../../../icons';

const PRESENTATION = {
  label: 'Text',
  icon: createElement(TextIcon),
  group: 'type',
};

/** Text tool. Drag-rect insertion is owned end-to-end by the dispatcher's
 *  `insertAction` (kind: `'text'`); click-on-selected-text-node enters edit
 *  mode via the `enterTextEdit` action.
 *
 *  Consumers must register both the `insert` dep (e.g. through
 *  `SceneCanvas`'s `useInsertDepSource`) and the `textEdit` dep
 *  (`enterTextEditAction`'s contract — see
 *  `src/interactions/actions/defaults/enterTextEdit.ts`). Custom node
 *  factories and hit gating belong on those deps, not on the tool. */
export function useTextTool(options: InsertToolOptions = {}): Tool<undefined> {
  const { behaviors } = options;
  return useMemo<Tool<undefined>>(
    () =>
      defineTool<undefined>({
        id: 'text',
        capabilities: ['creates-text'],
        hookName: 'useTextTool',
        cursor: 'text',
        presentation: PRESENTATION,
        bindings: [
          { spec: { kind: 'drag' }, actionId: 'insert', opts: { params: { kind: 'text' }, ...insertBindingBehaviors(behaviors) } },
          { spec: { kind: 'click', target: 'selected-body' }, actionId: 'enterTextEdit' },
        ],
      }),
    [behaviors],
  );
}

/** Both script primitives are fractions of the inherited size, so both read
 *  as percentages. The step is a tenth of a point because the field snaps the
 *  *displayed* value to it, and a coarser one would render a superscript's
 *  58.3% as 60% and commit that on the next edit. */
const PERCENT = {
  toDisplay: (v: number) => Math.round(v * 1000) / 10,
  // Rounded rather than divided: 33.3 / 100 is 0.33299999999999996, and that
  // dust would be written into the document and shown back on the next read.
  fromDisplay: (v: number) => Math.round(v * 1000) / 100_000,
  suffix: '%',
};

/** A run flag: on or off per character, drawn as one segment of a bar. */
const flag = (name: string, icon: string) =>
  ({
    kind: 'boolean',
    name,
    description: `${name} for the characters in the range.`,
    icon,
    control: 'toggle',
    pair: 'Character style',
    default: false,
  }) as const;

/**
 * What the tool offers while a caret range is active — the character half of
 * text styling, against the node-level Character group a selection shows.
 *
 * Keyed by {@link StyledRun} field, so a host reads values out of a
 * `RangeStyle` and writes a `RunStylePatch` back with no name mapping of its
 * own. `script` is a preset over `baselineShift` and `fontScale`, so all three
 * are here and naming either primitive overrides that half.
 */
useTextTool.options = {
  name: 'Text',
  description: 'Character styling for the selected range.',
  children: {
    bold: flag('Bold', 'bold'),
    italic: flag('Italic', 'italic'),
    underline: flag('Underline', 'underline'),
    strikethrough: flag('Strikethrough', 'strikethrough'),
    overline: flag('Overline', 'overline'),
    // Clearable: the two values are exclusive *and* absent is a third state,
    // so clicking the lit segment turns the script off.
    script: {
      kind: 'enum',
      name: 'Script',
      description: 'Raise or lower the range off the baseline, at a smaller size.',
      control: 'toggle',
      clearable: true,
      default: undefined,
      options: [
        { value: 'super', label: 'Superscript', icon: 'superscript' },
        { value: 'sub', label: 'Subscript', icon: 'subscript' },
      ],
    },
    textTransform: {
      kind: 'enum',
      name: 'Case',
      description: 'Draw the range in capitals, lowercase or title case. The text itself is unchanged.',
      control: 'toggle',
      default: 'none',
      options: [{ value: 'none', label: 'None', short: ['–'] }, { value: 'uppercase', label: 'Uppercase', short: ['AA'] }, { value: 'lowercase', label: 'Lowercase', short: ['aa'] }, { value: 'capitalize', label: 'Capitalize', short: ['Aa'] }],
    },
    fontVariantCaps: {
      kind: 'enum',
      name: 'Small caps',
      description: 'Draw lowercase letters in the range as smaller capitals. The text itself is unchanged.',
      control: 'toggle',
      default: 'normal',
      options: [{ value: 'normal', label: 'Normal', short: ['–'] }, { value: 'small-caps', label: 'Small caps', short: ['Sc'] }],
    },
    fontFamily: {
      kind: 'font-family',
      name: 'Font',
      description: 'Typeface for the range.',
      default: undefined,
    },
    // Listed from the weights the range's family has registered. Bold is a
    // preset over it: toggling Bold clears it, picking one clears Bold.
    fontWeight: {
      kind: 'font-weight',
      name: 'Weight',
      description: 'Weight of the range, from the faces its family has.',
      default: undefined,
    },
    fontSize: { kind: 'number', name: 'Size', description: 'Type size.', min: 1, step: 1, default: 16 },
    letterSpacing: {
      kind: 'number',
      name: 'Tracking',
      // The typographic term, short enough for a strip; `name` stays the
      // accessible one.
      short: ['VA'],
      description: 'Space added between characters.',
      step: 0.1,
      default: 0,
    },
    baselineShift: {
      kind: 'number',
      name: 'Baseline shift',
      short: ['Shift'],
      description: 'Raise or lower the range, in ems of the inherited size.',
      step: 0.001,
      unit: PERCENT,
      default: 0,
    },
    fontScale: {
      kind: 'number',
      name: 'Scale',
      description: 'Size of the range against the inherited size.',
      min: 0.01,
      step: 0.001,
      unit: PERCENT,
      default: 1,
    },
    fill: {
      kind: 'color',
      name: 'Color',
      description: 'Ink for the range.',
      alpha: true,
      default: '#000000',
    },
  },
} satisfies ToolPrefGroup;
