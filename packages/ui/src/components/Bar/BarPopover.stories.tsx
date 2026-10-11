import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Icon } from '../../icons/Icon';
import { PropertyField } from '../Properties/PropertyField';
import { PropertyList } from '../Properties/PropertyPanel';
import { BarPopover } from './BarPopover';
import s from './Bar.stories.module.css';

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
  render: () => (
    <div className={s.strip}>
      <BarPopover label="Margins">
        <Margins />
      </BarPopover>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className={s.strip}>
      <BarPopover label="Margins" icon={<Icon name="chevron" size={14} />}>
        <Margins />
      </BarPopover>
    </div>
  ),
};
