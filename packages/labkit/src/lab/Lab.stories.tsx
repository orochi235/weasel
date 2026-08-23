import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect } from 'react';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';
import { useLabContext } from './LabContext';

const StubInstrument: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({ value: 50 }),
  initialState: (config) => ({ doubled: (config as { value: number }).value * 2 }),
  render: ({ state }) => (
    <div className="lk-stub-display">doubled: {(state as { doubled: number }).doubled}</div>
  ),
};

const meta: Meta<typeof Lab> = {
  title: 'labkit/Lab/Lab',
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

function AddSecondTrial() {
  const ctx = useLabContext();
  useEffect(() => {
    if (ctx.trials.length < 2) ctx.addTrial('Stub');
  }, [ctx]);
  return null;
}

export const TwoTrials: Story = {
  args: {
    instruments: [StubInstrument],
    defaultInstrument: 'Stub',
    title: 'Two Trials',
    storage: null,
    children: <AddSecondTrial />,
  },
};
