import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { CurveField } from './CurveField';

const meta: Meta<typeof CurveField> = {
  title: 'UI/Properties/CurveField',
  component: CurveField,
};
export default meta;

export const DomeContour: StoryObj<typeof CurveField> = {
  render: () => {
    const [v, setV] = useState<number[]>([0, -1, 0.5, 0.5, 1, 0.7]);
    return (
      <div style={{ width: 280 }}>
        <CurveField values={v} min={-1} max={1} step={0.02} width={280} onChange={setV} />
      </div>
    );
  },
};
