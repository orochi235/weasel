import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { useColorModePreference } from '@weasel-js/theme/react';
import { EllipseIcon, RectIcon, StarIcon } from '../../icons';
import { ThemeSwitcher, type ThemeSwitcherOption } from './ThemeSwitcher';

const meta: Meta<typeof ThemeSwitcher> = {
  title: 'ui/Foundations/ThemeSwitcher',
  component: ThemeSwitcher,
};
export default meta;
type Story = StoryObj<typeof ThemeSwitcher>;

/** Wired to `useColorModePreference`; the readout shows what `auto` resolves
 *  to. Shift-click steps backwards. */
export const WithPreferenceHook: Story = {
  render: function Render() {
    const { preference, setPreference, mode } = useColorModePreference();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ThemeSwitcher value={preference} onChange={setPreference} />
        <span>
          {preference} → {mode}
        </span>
      </div>
    );
  },
};

const SHAPES: ThemeSwitcherOption<'rect' | 'ellipse' | 'star'>[] = [
  { value: 'rect', icon: <RectIcon size={16} />, label: 'Rectangle' },
  { value: 'ellipse', icon: <EllipseIcon size={16} />, label: 'Ellipse' },
  { value: 'star', icon: <StarIcon size={16} />, label: 'Star' },
];

/** Any ordered list of options cycles the same way, under its own name. */
export const CustomOptions: Story = {
  tags: ['gallery'],
  render: function Render() {
    const [shape, setShape] = useState<'rect' | 'ellipse' | 'star'>('rect');
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ThemeSwitcher value={shape} onChange={setShape} options={SHAPES} ariaLabel="Shape" />
        <ThemeSwitcher value={shape} onChange={setShape} options={SHAPES} ariaLabel="Shape" size="md" />
        <ThemeSwitcher value={shape} onChange={setShape} options={SHAPES} ariaLabel="Shape" variant="secondary" />
      </div>
    );
  },
};
