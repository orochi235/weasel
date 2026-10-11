import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import type { PrefCondition, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefConditionEditor } from './PrefConditionEditor';
import s from './PrefConditionEditor.stories.module.css';

const meta: Meta<typeof PrefConditionEditor> = {
  title: 'Primitives/PrefConditionEditor',
  component: PrefConditionEditor,
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
function Live({ start }: { start?: PrefCondition }) {
  const [value, setValue] = useState<PrefCondition | undefined>(start);
  return (
    <div className={s.frame}>
      <PrefConditionEditor aria-label="Shown if" schema={SCHEMA} value={value} onChange={setValue} />
      <pre className={s.written}>{value === undefined ? 'undefined' : JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

/** No condition: only the control that adds a first row. */
export const Empty: Story = { render: () => <Live /> };

/** One row per kind: a boolean is on or off, an enum is one of its own options, a number is compared with a
 *  number, and anything else is only set or not. */
export const ARowPerKind: Story = {
  render: () => (
    <Live start={{ all: [
      { path: 'canvas.showGrid', is: true },
      { path: 'canvas.units', isNot: 'px' },
      { path: 'canvas.gridSize', atLeast: 4 },
      { path: 'canvas.author' },
    ] }} />
  ),
};

/** An enum compared against several of its options at once, under any of. */
export const AnyOf: Story = {
  render: () => <Live start={{ any: [{ path: 'canvas.units', in: ['mm', 'in'] }, { path: 'canvas.showGrid', is: false }] }} />,
};

/** What the rows have no controls for is text: a `not`, a combinator inside the top one, and a range. Each can
 *  be removed, and is otherwise handed back as it was when a row beside it is edited. */
export const ShownAsText: Story = {
  render: () => (
    <Live start={{ all: [
      { not: { path: 'canvas.author' } },
      { any: [{ path: 'canvas.units', is: 'mm' }, { path: 'canvas.gridSize', above: 16 }] },
      { path: 'canvas.gridSize', atLeast: 2, below: 64 },
      { path: 'canvas.showGrid' },
    ] }} />
  ),
};

/** A row reading a pref the schema does not hold, and one comparing an enum against a value it never holds:
 *  each says so under itself. */
export const Problems: Story = {
  render: () => (
    <Live start={{ all: [
      { path: 'canvas.showGrid', is: true },
      { path: 'canvas.snapping', is: true },
      { path: 'canvas.units', is: 'cm' },
    ] }} />
  ),
};
