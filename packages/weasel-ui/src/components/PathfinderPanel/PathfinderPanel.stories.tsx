import type { Meta, StoryObj } from '@storybook/react-vite';
import { PathfinderPanel } from './PathfinderPanel';
import type { BooleansAdapter, UseBooleansReturn } from '@orochi235/weasel';
import { asNodeId } from '@orochi235/weasel';

const meta: Meta<typeof PathfinderPanel> = {
  title: 'weasel-ui/PathfinderPanel',
  component: PathfinderPanel,
};
export default meta;

type Story = StoryObj<typeof PathfinderPanel>;

const noopActions: UseBooleansReturn = {
  union: () => console.log('union'),
  intersect: () => console.log('intersect'),
  subtract: () => console.log('subtract'),
  exclude: () => console.log('exclude'),
  divide: () => console.log('divide'),
};

function adapterWith(paths: number): Pick<BooleansAdapter, 'getSelection' | 'getWorldPath'> {
  const ids = Array.from({ length: paths }, (_, i) => asNodeId(`id-${i}`));
  return {
    getSelection: () => ids,
    getWorldPath: (id) => (
      ids.includes(id)
        ? { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' }
        : undefined
    ),
  };
}

export const Default: Story = {
  args: {
    adapter: adapterWith(2),
    actions: noopActions,
  },
};

export const Disabled: Story = {
  args: {
    adapter: adapterWith(0),
    actions: noopActions,
  },
};

export const Vertical: Story = {
  args: {
    adapter: adapterWith(2),
    actions: noopActions,
    orientation: 'vertical',
  },
};

export const CustomIcons: Story = {
  args: {
    adapter: adapterWith(2),
    actions: noopActions,
    icons: {
      union: <span style={{ fontSize: 14 }}>∪</span>,
      intersect: <span style={{ fontSize: 14 }}>∩</span>,
      exclude: <span style={{ fontSize: 14 }}>⊕</span>,
    },
  },
};
