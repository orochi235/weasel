import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useColorModePreference } from '@weasel-js/theme/react';
import { CycleButton, COLOR_MODE_OPTIONS, type CycleButtonOption } from '@weasel-js/ui/components/CycleButton';
import { Icon } from '@weasel-js/ui/components/Icon';
import { icon } from '../../icons.gen';

const meta: Meta<typeof CycleButton> = {
  title: 'ui/CycleButton',
  component: CycleButton,
};
export default meta;
type Story = StoryObj<typeof CycleButton>;

/** `COLOR_MODE_OPTIONS` wired to `useColorModePreference`: a theme switch. The readout shows
 *  what `auto` resolves to. Shift-click steps backwards. */
export const ColorMode: Story = {
  render: function Render({ size, variant }) {
    const { preference, setPreference, mode } = useColorModePreference();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CycleButton
          value={preference}
          onChange={setPreference}
          options={COLOR_MODE_OPTIONS}
          aria-label="Theme"
          size={size}
          variant={variant}
        />
        <span>
          {preference} → {mode}
        </span>
      </div>
    );
  },
};

const SHAPES: CycleButtonOption<'rect' | 'ellipse' | 'star'>[] = [
  { value: 'rect', icon: <Icon name={icon('core:rect')} size={16} />, label: 'Rectangle' },
  { value: 'ellipse', icon: <Icon name={icon('core:ellipse')} size={16} />, label: 'Ellipse' },
  { value: 'star', icon: <Icon name={icon('core:star')} size={16} />, label: 'Star' },
];

/** Any ordered list of options cycles the same way, under its own name. */
export const CustomOptions: Story = {
  tags: ['gallery'],
  render: function Render({ size, variant }) {
    const [shape, setShape] = useState<'rect' | 'ellipse' | 'star'>('rect');
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CycleButton value={shape} onChange={setShape} options={SHAPES} aria-label="Shape" size={size} variant={variant} />
        <CycleButton value={shape} onChange={setShape} options={SHAPES} aria-label="Shape" size="md" />
        <CycleButton value={shape} onChange={setShape} options={SHAPES} aria-label="Shape" variant="solid" />
      </div>
    );
  },
};
