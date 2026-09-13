import type { Meta, StoryObj } from '@storybook/react-vite';
import { localStorageAdapter } from '../state/adapters';
import { Persistence } from '../state/Persistence';
import { FloatingPanel } from './FloatingPanel';
import { Legend } from './Legend';

// The panel positions against its offset parent, so a story needs a sized,
// positioned host or there is nothing for it to float in.
const meta: Meta<typeof FloatingPanel> = {
  title: 'labkit/Primitives/FloatingPanel',
  component: FloatingPanel,
  decorators: [
    (Story) => (
      <div className="lk-floating-panel-story-host">
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

// Remembered only under a provider; this one keeps it across story reloads.
export const Remembered: Story = {
  args: { persist: 'story-panel' },
  decorators: [
    (Story) => (
      <Persistence storageKey="labkit-story" storage={localStorageAdapter}>
        <Story />
      </Persistence>
    ),
  ],
};
