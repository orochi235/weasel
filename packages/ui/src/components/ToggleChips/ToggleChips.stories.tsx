import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Badge } from '@weasel-js/ui/components/Badge';
import { ToggleChips, type ToggleChipsItem } from '@weasel-js/ui/components/ToggleChips';
import s from './ToggleChips.stories.module.css';

const meta: Meta<typeof ToggleChips> = {
  title: 'ui/ToggleChips',
  component: ToggleChips,
};

export default meta;
type Story = StoryObj<typeof ToggleChips>;

const NAMES = ['core', 'geom', 'paint', 'stroke', 'renderer', 'minimap', 'parallax', 'diagram', 'editing', 'path-tools', 'labkit', 'forge'];

const badges: readonly ToggleChipsItem[] = NAMES.map((name, i) => ({
  value: name,
  label: <Badge size="sm" variant="subtle" emphasis="low" tint={i}>{name}</Badge>,
}));

/** Badges in a narrow column, wrapping. Press one to flip it; drag across others to set each to what the press set. */
export const Sweep: Story = {
  args: { 'aria-label': 'Packages' },
  render: ({ 'aria-label': ariaLabel, disabled, readOnly }) => {
    const [value, setValue] = useState<string[]>(NAMES.slice(0, 6));
    return (
      <div className={s.column}>
        <ToggleChips aria-label={ariaLabel} sweep items={badges} value={value} onChange={setValue} disabled={disabled} readOnly={readOnly} />
      </div>
    );
  },
};

/** Plain text labels, one mixed and one disabled, without a sweep. */
export const Plain: Story = {
  args: { 'aria-label': 'Styles' },
  render: ({ 'aria-label': ariaLabel }) => {
    const [value, setValue] = useState<string[]>(['Bold']);
    const items: ToggleChipsItem[] = ['Bold', 'Italic', 'Underline', 'Strike', 'Code'].map((w) => ({
      value: w,
      label: <Badge size="sm">{w}</Badge>,
      ...(w === 'Code' ? { disabled: true } : {}),
    }));
    return <ToggleChips aria-label={ariaLabel} items={items} value={value} mixedValues={['Italic']} onChange={setValue} />;
  },
};
