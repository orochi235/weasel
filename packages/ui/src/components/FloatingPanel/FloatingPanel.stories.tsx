import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { FloatingPanel, type FloatingPlacement } from '@weasel-js/ui/components/FloatingPanel';
import { Legend } from '@weasel-js/ui/components/Legend';
import s from './FloatingPanel.stories.module.css';

// The panel positions against its offset parent, so a story needs a sized,
// positioned host or there is nothing for it to float in.
const meta: Meta<typeof FloatingPanel> = {
  title: 'ui/FloatingPanel',
  component: FloatingPanel,
  decorators: [
    (Story) => (
      <div className={s.host}>
        <Story />
      </div>
    ),
  ],
  args: { children: 'drag me' },
};
export default meta;

type Story = StoryObj<typeof FloatingPanel>;

export const BottomLeft: Story = {};

export const TopRight: Story = { args: { anchor: 'top-right' } };

export const TwoCornersOnly: Story = {
  args: { anchor: 'top-left', snapCorners: ['top-left', 'bottom-right'] },
};

export const HoldingALegend: Story = {
  args: {
    anchor: 'bottom-right',
    children: (
      <Legend
        entries={[
          { key: 'contour', label: 'contour', color: '#7d7f86' },
          { key: 'floor', label: 'bend floor', color: '#9a9ca3', mark: 'dash' },
          { key: 'authored', label: 'authored', color: '#2aa87a', mark: 'dot' },
        ]}
      />
    ),
  },
};

/** The owner holds the placement: here it shows where the last drag left the panel. */
export const Controlled: Story = {
  render: (args) => {
    const [place, setPlace] = useState<FloatingPlacement>({ x: 0, y: 0, anchor: 'top-left' });
    return (
      <FloatingPanel {...args} value={place} onChange={setPlace}>
        {place.anchor ?? `${Math.round(place.x)}, ${Math.round(place.y)}`}
      </FloatingPanel>
    );
  },
};
