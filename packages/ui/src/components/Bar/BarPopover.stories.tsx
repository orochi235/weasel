import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Icon } from '../../icons/Icon';
import { PropertyField } from '../Properties/PropertyField';
import { PropertyList } from '../Properties/PropertyList';
import { BarPopover } from './BarPopover';
import s from './Bar.stories.module.css';
import { icon } from '../../icons.gen';

const meta: Meta<typeof BarPopover> = {
  title: 'ui/Bar/BarPopover',
  component: BarPopover,
};
export default meta;
type Story = StoryObj<typeof BarPopover>;

function Margins() {
  const [top, setTop] = useState(4);
  const [side, setSide] = useState(8);
  return (
    <PropertyList>
      <PropertyField kind="number" label="Top" value={top} onChange={setTop} />
      <PropertyField kind="number" label="Side" value={side} onChange={setSide} />
    </PropertyList>
  );
}

/** A value made of several fields, opened from the bar. */
export const Rows: Story = {
  args: { label: 'Margins' },
  render: (args) => (
    <div className={s.strip}>
      <BarPopover {...args}>
        <Margins />
      </BarPopover>
    </div>
  ),
};

export const WithIcon: Story = {
  args: { label: 'Margins', icon: <Icon name={icon('chevron')} size={14} /> },
  render: Rows.render,
};
