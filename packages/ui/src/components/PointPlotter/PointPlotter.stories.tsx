import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PointPlotter } from './PointPlotter';
import type { ControlPoint } from '../CurveEditor';

interface InteractiveProps {
  initial: ControlPoint[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  showGrid: boolean;
  gridDivisions: number;
  showAxes: boolean;
  minPoints?: number;
  maxPoints?: number;
  addPointMode: 'click-empty' | 'never';
  width: number;
}

function Interactive(props: InteractiveProps) {
  const [value, setValue] = useState<ControlPoint[]>(props.initial);
  return (
    <PointPlotter
      value={value}
      onInput={setValue}
      xRange={[props.xMin, props.xMax]}
      yRange={[props.yMin, props.yMax]}
      grid={props.showGrid ? { divisions: props.gridDivisions } : false}
      axes={props.showAxes ? {} : false}
      minPoints={props.minPoints}
      maxPoints={props.maxPoints}
      addPointMode={props.addPointMode}
      width={props.width}
      height={Math.round(props.width / 2)}
    />
  );
}

const meta: Meta<typeof Interactive> = {
  title: 'weasel-ui/PointPlotter',
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
    minPoints: { control: { type: 'number', min: 0, max: 20, step: 1 } },
    maxPoints: { control: { type: 'number', min: 1, max: 50, step: 1 } },
    addPointMode: { control: 'inline-radio', options: ['click-empty', 'never'] },
    width: { control: { type: 'number', min: 100, max: 800, step: 20 } },
  },
};
export default meta;

type Story = StoryObj<typeof Interactive>;

const COMMON: Partial<InteractiveProps> = {
  xMin: 0, xMax: 1, yMin: 0, yMax: 1,
  showGrid: true, gridDivisions: 3, showAxes: true,
  addPointMode: 'click-empty',
  width: 400,
};

export const Default: Story = {
  args: {
    ...COMMON,
    initial: [
      { x: 0.2, y: 0.3 },
      { x: 0.5, y: 0.6 },
      { x: 0.8, y: 0.2 },
    ],
  },
};

export const Bounded: Story = {
  args: {
    ...COMMON,
    initial: [{ x: 0.5, y: 0.5 }],
    minPoints: 1,
    maxPoints: 6,
  },
};

export const Empty: Story = {
  args: { ...COMMON, initial: [] },
};

export const NoInsert: Story = {
  args: {
    ...COMMON,
    initial: [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }],
    addPointMode: 'never',
  },
};

export const CustomRange: Story = {
  args: {
    ...COMMON,
    initial: [{ x: 0, y: 0 }],
    xMin: -5, xMax: 5,
    yMin: -10, yMax: 10,
  },
};
