import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Readout } from './Readout';

const meta: Meta<typeof Readout> = {
  title: 'labkit/Primitives/Readout',
  component: Readout,
};
export default meta;

type Story = StoryObj<typeof Readout>;

const FIGURE_SPACE = ' ';

export const Measurements: Story = {
  tags: ['gallery'],
  args: {
    rows: [
      { label: 'Lock margin', value: 'locked +47.9°', status: 'success' },
      { label: 'Score', value: `${FIGURE_SPACE}0.145` },
      { label: 'Residual', value: `${FIGURE_SPACE}3.020` },
      { label: 'Overshoot', value: 'over 12.345', status: 'danger' },
    ],
  },
};

export const WithTitleAndNote: Story = {
  args: {
    title: 'Fit',
    rows: [
      { label: 'Score', value: '0.145' },
      { label: 'Iterations', value: `${FIGURE_SPACE}${FIGURE_SPACE}42` },
    ],
    children: 'Scores under 0.2 converge within one pass.',
  },
};

/** Values vanish while the cursor is off the picture; the rows hold their
 *  place and the readout its height. */
export const ValuesComeAndGo: Story = {
  render: () => {
    const [on, setOn] = useState(true);
    return (
      <div>
        <button type="button" onClick={() => setOn((v) => !v)}>
          {on ? 'Hide values' : 'Show values'}
        </button>
        <Readout
          rows={[
            { label: 'x', value: on ? `${FIGURE_SPACE}12.50` : undefined },
            { label: 'y', value: on ? '-3.75' : undefined },
            { label: 'Hit', value: on ? 'inside' : undefined, status: on ? 'success' : undefined },
          ]}
        />
      </div>
    );
  },
};
