import type { Meta, StoryObj } from '@weasel-js/forge';
import { useColorModePreference } from '@weasel-js/theme/react';
import { ColorModeControl } from '@weasel-js/ui/components/ColorModeControl';
import s from './ColorModeControl.stories.module.css';

const meta: Meta<typeof ColorModeControl> = {
  title: 'ui/ColorModeControl',
  component: ColorModeControl,
};
export default meta;
type Story = StoryObj<typeof ColorModeControl>;

/** Wired to `useColorModePreference`; the readout shows what `auto` resolves to. */
export const WithPreferenceHook: Story = {
  render: function Render(args) {
    const { preference, setPreference, mode } = useColorModePreference();
    return (
      <div className={s.row}>
        <ColorModeControl {...args} value={preference} onChange={setPreference} />
        <span>
          {preference} → {mode}
        </span>
      </div>
    );
  },
};

export const SizesAndVariants: Story = {
  tags: ['gallery'],
  render: function Render(args) {
    const { preference, setPreference } = useColorModePreference();
    return (
      <div className={s.column}>
        <ColorModeControl {...args} value={preference} onChange={setPreference} />
        <ColorModeControl {...args} value={preference} onChange={setPreference} size="sm" />
        <ColorModeControl {...args} value={preference} onChange={setPreference} variant="flat" />
        <ColorModeControl {...args} value={preference} onChange={setPreference} variant="minimal" size="sm" />
      </div>
    );
  },
};
