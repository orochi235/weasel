import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PointPicker } from './PointPicker';

interface InteractiveProps {
  initial: { x: number; y: number };
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  showGrid: boolean;
  gridDivisions: number;
  showAxes: boolean;
  locked: boolean;
  width: number;
}

function Interactive(props: InteractiveProps) {
  const [value, setValue] = useState(props.initial);
  return (
    <PointPicker
      value={value}
      onChange={setValue}
      xRange={[props.xMin, props.xMax]}
      yRange={[props.yMin, props.yMax]}
      grid={props.showGrid ? { divisions: props.gridDivisions } : false}
      axes={props.showAxes ? {} : false}
      locked={props.locked}
      width={props.width}
      height={Math.round(props.width / 2)}
    />
  );
}

const meta: Meta<typeof Interactive> = {
  title: 'weasel-ui/PointPicker',
  component: Interactive,
  argTypes: {
    initial: { control: false },
    xMin: { control: { type: 'number', step: 0.1 } },
    xMax: { control: { type: 'number', step: 0.1 } },
    yMin: { control: { type: 'number', step: 0.1 } },
    yMax: { control: { type: 'number', step: 0.1 } },
    showGrid: { control: 'boolean' },
    gridDivisions: { control: { type: 'number', min: 1, max: 20, step: 1 } },
    showAxes: { control: 'boolean' },
    locked: { control: 'boolean' },
    width: { control: { type: 'number', min: 100, max: 800, step: 20 } },
  },
};
export default meta;

type Story = StoryObj<typeof Interactive>;

const COMMON: Partial<InteractiveProps> = {
  xMin: 0, xMax: 1, yMin: 0, yMax: 1,
  showGrid: true, gridDivisions: 3, showAxes: true,
  locked: false,
  width: 400,
};

export const Default: Story = {
  args: { ...COMMON, initial: { x: 0.5, y: 0.5 } },
};

export const Locked: Story = {
  args: { ...COMMON, initial: { x: 0.3, y: 0.7 }, locked: true },
};

export const CustomRange: Story = {
  args: {
    ...COMMON,
    initial: { x: 0, y: 0 },
    xMin: -5, xMax: 5,
    yMin: -10, yMax: 10,
  },
};
