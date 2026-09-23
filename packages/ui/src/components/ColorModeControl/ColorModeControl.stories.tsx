import type { Meta, StoryObj } from '@weasel-js/forge';
import { useColorModePreference } from '@weasel-js/theme/react';
import { ColorModeControl } from './ColorModeControl';

const meta: Meta<typeof ColorModeControl> = {
  title: 'ui/Foundations/ColorModeControl',
  component: ColorModeControl,
};
export default meta;
type Story = StoryObj<typeof ColorModeControl>;

/** Wired to `useColorModePreference`; the readout shows what `auto` resolves to. */
export const WithPreferenceHook: Story = {
  render: function Render() {
    const { preference, setPreference, mode } = useColorModePreference();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ColorModeControl value={preference} onChange={setPreference} />
        <span>
          {preference} → {mode}
        </span>
      </div>
    );
  },
};

export const SizesAndVariants: Story = {
  render: function Render() {
    const { preference, setPreference } = useColorModePreference();
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'start' }}>
        <ColorModeControl value={preference} onChange={setPreference} />
        <ColorModeControl value={preference} onChange={setPreference} size="sm" />
        <ColorModeControl value={preference} onChange={setPreference} variant="flat" />
        <ColorModeControl value={preference} onChange={setPreference} variant="minimal" size="sm" />
      </div>
    );
  },
};
