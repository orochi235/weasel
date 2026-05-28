import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { CurveEditor, type ControlPoint } from './CurveEditor';

/**
 * Storybook wrapper that owns the value state and forwards all visual
 * props to `<CurveEditor>`. Stories drive `props` via `args`, so the
 * Controls addon's UI exposes every toggle live.
 */
interface InteractiveProps {
  initial: ControlPoint[];
  domain: '1d' | '2d';
  endpoints: 'free' | 'pinned-x' | 'pinned-both';
  addPointMode: 'click-curve' | 'click-empty' | 'never';
  showGrid: boolean;
  gridDivisions?: number;
  showAxes: boolean;
  showFill: boolean;
  fillSide: 'below' | 'above';
  width: number;
  height: number;
}

function Interactive(props: InteractiveProps) {
  const [value, setValue] = useState(props.initial);
  return (
    <CurveEditor
      value={value}
      onChange={setValue}
      domain={props.domain}
      endpoints={props.endpoints}
      addPointMode={props.addPointMode}
      grid={props.showGrid ? { divisions: props.gridDivisions ?? 3 } : false}
      axes={props.showAxes ? {} : false}
      fill={props.showFill ? { side: props.fillSide } : false}
      width={props.width}
      height={props.height}
    />
  );
}

const meta: Meta<typeof Interactive> = {
  title: 'weasel-ui/CurveEditor',
  component: Interactive,
  argTypes: {
    initial: { control: false },
    domain: {
      control: 'inline-radio',
      options: ['1d', '2d'],
    },
    endpoints: {
      control: 'inline-radio',
      options: ['free', 'pinned-x', 'pinned-both'],
    },
    addPointMode: {
      control: 'inline-radio',
      options: ['click-curve', 'click-empty', 'never'],
    },
    showGrid: { control: 'boolean' },
    gridDivisions: { control: { type: 'number', min: 1, max: 20, step: 1 } },
    showAxes: { control: 'boolean' },
    showFill: { control: 'boolean' },
    fillSide: {
      control: 'inline-radio',
      options: ['below', 'above'],
    },
    width: { control: { type: 'number', min: 100, max: 800, step: 20 } },
    height: { control: { type: 'number', min: 100, max: 600, step: 20 } },
  },
};
export default meta;

type Story = StoryObj<typeof Interactive>;

const COMMON: Partial<InteractiveProps> = {
  addPointMode: 'click-curve',
  showGrid: false,
  gridDivisions: 3,
  showAxes: true,
  showFill: false,
  fillSide: 'below',
  width: 400,
  height: 200,
};

export const EasingCurve: Story = {
  args: {
    ...COMMON,
    initial: [{ x: 0, y: 0 }, { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.9 }, { x: 1, y: 1 }],
    domain: '1d',
    endpoints: 'pinned-both',
    showFill: true,
  },
};

export const TwoDimPath: Story = {
  args: {
    ...COMMON,
    initial: [{ x: 0.1, y: 0.5 }, { x: 0.3, y: 0.8 }, { x: 0.7, y: 0.2 }, { x: 0.9, y: 0.5 }],
    domain: '2d',
    endpoints: 'free',
  },
};

export const PinnedX: Story = {
  args: {
    ...COMMON,
    initial: [{ x: 0, y: 0.3 }, { x: 0.5, y: 0.7 }, { x: 1, y: 0.4 }],
    domain: '1d',
    endpoints: 'pinned-x',
  },
};

export const Empty: Story = {
  args: {
    ...COMMON,
    initial: [],
    domain: '2d',
    endpoints: 'free',
  },
};
