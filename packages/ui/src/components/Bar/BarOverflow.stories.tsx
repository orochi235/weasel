import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { Bar, type BarProps } from '@weasel-js/ui/components/Bar';
import s from './BarOverflow.stories.module.css';
import { icon } from '../../icons.gen';

const meta: Meta<typeof Bar> = {
  title: 'ui/Bar/Overflow',
  component: Bar,
};
export default meta;
type Story = StoryObj<typeof Bar>;

const number = (name: string, value: number): PrefGroup['children'][string] => ({ kind: 'number', name, description: '', default: value });
const flag = (name: string): PrefGroup['children'][string] => ({ kind: 'boolean', name, description: '', control: 'switch', default: false });

const TYPE: PrefGroup = {
  name: 'Type',
  as: 'bar',
  children: {
    size: number('Size', 12),
    leading: number('Leading', 14),
    tracking: number('Tracking', 0),
    marks: { name: 'Marks', as: 'section', children: { ligatures: flag('Ligatures'), kerning: flag('Kerning') } },
    align: {
      kind: 'enum',
      name: 'Align',
      description: '',
      default: 'left',
      control: 'toggle',
      options: [
        { value: 'left', label: 'Left', icon: icon('core:textAlignLeft') },
        { value: 'center', label: 'Center', icon: icon('core:textAlignCenter') },
        { value: 'right', label: 'Right', icon: icon('core:textAlignRight') },
      ],
    },
    color: { kind: 'color', name: 'Color', description: '', default: '#7ec8e3' },
    indent: number('Indent', 0),
  },
};

function Sized(args: BarProps) {
  const [values, setValues] = useState<Record<string, unknown>>({ size: 12, leading: 14, tracking: 0, align: 'left', color: '#7ec8e3', indent: 0 });
  return (
    <div className={s.room}>
      <Bar {...args} schema={TYPE} values={values} onChange={(path, value) => setValues((v) => ({ ...v, [path]: value }))} />
    </div>
  );
}

/** `overflow="menu"`: the cells the line has room for stay on it, and the button at its end opens the rest. Drag
 *  the corner of the box to give the bar more room or less. */
export const Menu: Story = { args: { label: 'Type', overflow: 'menu' }, render: (args) => <Sized {...args} /> };

/** The default: every cell stays on the line, and a framed bar scrolls. */
export const Scroll: Story = { args: { label: 'Type', framed: true }, render: (args) => <Sized {...args} /> };
