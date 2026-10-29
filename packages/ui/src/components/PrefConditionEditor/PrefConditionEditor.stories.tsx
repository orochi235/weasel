import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import type { PrefCondition, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefConditionEditor, type PrefConditionEditorProps } from '@weasel-js/ui/components/PrefConditionEditor';
import s from './PrefConditionEditor.stories.module.css';

const meta: Meta<typeof PrefConditionEditor> = {
  title: 'ui/Foundations/PrefConditionEditor',
  component: PrefConditionEditor,
  args: { 'aria-label': 'Shown if' },
};
export default meta;

type Story = StoryObj<typeof PrefConditionEditor>;

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        showGrid: { kind: 'boolean', name: 'Show grid', description: '', default: true },
        gridSize: { kind: 'number', name: 'Grid size', description: '', default: 8, min: 1 },
        units: {
          kind: 'enum', name: 'Units', description: '', default: 'px',
          options: [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }, { value: 'in', label: 'Inches' }],
        } as PrefLeaf,
        author: { kind: 'string', name: 'Author', description: '', default: '' } as PrefLeaf,
      },
    },
  },
};

/** The editor over a condition it holds, with what it wrote last under it. */
function Live({ start, schema = SCHEMA, ...args }: Partial<PrefConditionEditorProps> & { start?: PrefCondition }) {
  const [value, setValue] = useState<PrefCondition | undefined>(start);
  return (
    <div className={s.frame}>
      <PrefConditionEditor {...args} schema={schema} value={value} onChange={setValue} />
      <pre className={s.written}>{value === undefined ? 'undefined' : JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

/** No condition: only the control that adds a first row. */
export const Empty: Story = { render: (args) => <Live {...args} /> };

/** One row per kind: a boolean is on or off, an enum is one of its own options, a number is compared with a
 *  number, and anything else is only set or not. */
export const ARowPerKind: Story = {
  render: (args) => (
    <Live {...args} start={{ all: [
      { path: 'canvas.showGrid', is: true },
      { path: 'canvas.units', isNot: 'px' },
      { path: 'canvas.gridSize', atLeast: 4 },
      { path: 'canvas.author' },
    ] }} />
  ),
};

/** An enum compared against several of its options at once, under any of. */
export const AnyOf: Story = {
  render: (args) => <Live {...args} start={{ any: [{ path: 'canvas.units', in: ['mm', 'in'] }, { path: 'canvas.showGrid', is: false }] }} />,
};

/** A group among the rows holds rows of its own under its own quantifier, and a group may hold another. A
 *  number's row takes a second bound to make a range, and what is not set is a comparison like any other. */
export const Groups: Story = {
  render: (args) => (
    <Live {...args} start={{ all: [
      { not: { path: 'canvas.author' } },
      { any: [
        { path: 'canvas.units', is: 'mm' },
        { all: [{ path: 'canvas.showGrid', is: true }, { path: 'canvas.gridSize', above: 16 }] },
      ] },
      { path: 'canvas.gridSize', atLeast: 2, below: 64 },
    ] }} />
  ),
};

/** A `not` around a group is its quantifier: none of its rows, or not all of them. */
export const NoneOf: Story = {
  render: (args) => <Live {...args} start={{ not: { any: [{ path: 'canvas.units', is: 'px' }, { path: 'canvas.showGrid', is: false }] } }} />,
};

/** A row reading a pref the schema does not hold, and one comparing an enum against a value it never holds:
 *  each says so under itself. */
export const Problems: Story = {
  render: (args) => (
    <Live {...args} start={{ all: [
      { path: 'canvas.showGrid', is: true },
      { path: 'canvas.snapping', is: true },
      { path: 'canvas.units', is: 'cm' },
    ] }} />
  ),
};

const LAYOUT: PrefGroup = {
  name: 'Sidebar',
  children: { compact: { kind: 'boolean', name: 'Compact', description: '', default: false } },
};

/** `over`: the condition belongs to a layout drawn over another schema, and may read that schema's prefs. The
 *  picker lists them after the layout's own, each named for the schema it is in. */
export const OverAnotherSchema: Story = {
  render: (args) => <Live {...args} schema={LAYOUT} over={SCHEMA} start={{ all: [{ path: 'compact', is: false }, { path: 'canvas.showGrid', is: true }] }} />,
};
