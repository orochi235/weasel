import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useColorModePreference } from '@weasel-js/theme/react';
import { ThemeSwitcher, type ThemeSwitcherOption } from '@weasel-js/ui/components/ThemeSwitcher';
import { Icon } from '@weasel-js/ui/components/Icon';
import { icon } from '../../icons.gen';

const meta: Meta<typeof ThemeSwitcher> = {
  title: 'ui/Foundations/ThemeSwitcher',
  component: ThemeSwitcher,
};
export default meta;
type Story = StoryObj<typeof ThemeSwitcher>;

/** Wired to `useColorModePreference`; the readout shows what `auto` resolves
 *  to. Shift-click steps backwards. */
export const WithPreferenceHook: Story = {
  render: function Render({ ariaLabel, size, variant }) {
    const { preference, setPreference, mode } = useColorModePreference();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ThemeSwitcher value={preference} onChange={setPreference} ariaLabel={ariaLabel} size={size} variant={variant} />
        <span>
          {preference} → {mode}
        </span>
      </div>
    );
  },
};

const SHAPES: ThemeSwitcherOption<'rect' | 'ellipse' | 'star'>[] = [
  { value: 'rect', icon: <Icon name={icon('core:rect')} size={16} />, label: 'Rectangle' },
  { value: 'ellipse', icon: <Icon name={icon('core:ellipse')} size={16} />, label: 'Ellipse' },
  { value: 'star', icon: <Icon name={icon('core:star')} size={16} />, label: 'Star' },
];

/** Any ordered list of options cycles the same way, under its own name. */
export const CustomOptions: Story = {
  tags: ['gallery'],
  render: function Render(args) {
    const [shape, setShape] = useState<'rect' | 'ellipse' | 'star'>('rect');
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ThemeSwitcher {...args} value={shape} onChange={setShape} options={SHAPES} ariaLabel="Shape" />
        <ThemeSwitcher {...args} value={shape} onChange={setShape} options={SHAPES} ariaLabel="Shape" size="md" />
        <ThemeSwitcher {...args} value={shape} onChange={setShape} options={SHAPES} ariaLabel="Shape" variant="solid" />
      </div>
    );
  },
};
