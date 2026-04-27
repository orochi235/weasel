import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';
import { useLabContext } from './LabContext';

const StubInstrument: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({ value: 50 }),
  initialState: (config) => ({ doubled: (config as { value: number }).value * 2 }),
  render: ({ state }) => (
    <div className="lk-stub-display">
      doubled: {(state as { doubled: number }).doubled}
    </div>
  ),
};

const meta: Meta<typeof Lab> = {
  title: 'Lab/Lab',
  component: Lab,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Lab>;

export const Default: Story = {
  args: {
    instruments: [StubInstrument],
    defaultInstrument: 'Stub',
    title: 'Default Lab',
    storage: null,
  },
};

function AddSecondWorkspace() {
  const ctx = useLabContext();
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    if (ctx.workspaces.length < 2) ctx.addWorkspace('Stub');
  }, []);
  return null;
}

export const TwoWorkspaces: Story = {
  args: {
    instruments: [StubInstrument],
    defaultInstrument: 'Stub',
    title: 'Two Workspaces',
    storage: null,
    children: <AddSecondWorkspace />,
  },
};
