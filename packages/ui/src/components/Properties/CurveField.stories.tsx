import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { CurveField } from '@weasel-js/ui/components/Properties';

const meta: Meta<typeof CurveField> = {
  title: 'ui/Properties/CurveField',
  component: CurveField,
};
export default meta;

export const DomeContour: StoryObj<typeof CurveField> = {
  args: { min: -1, max: 1, step: 0.02, width: 280 },
  render: ({ min = -1, max = 1, step = 0.02, width = 280, ...args }) => {
    const [v, setV] = useState<number[]>([0, -1, 0.5, 0.5, 1, 0.7]);
    return (
      <div style={{ width }}>
        <CurveField {...args} values={v} min={min} max={max} step={step} width={width} onChange={setV} />
      </div>
    );
  },
};
