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
  interpolation: 'linear' | 'catmull-rom' | 'catmull-rom-uniform' | 'catmull-rom-chordal' | 'monotone';
  endpoints: 'free' | 'pinned-x' | 'pinned-both';
  addPointMode: 'click-curve' | 'click-empty' | 'never';
  showGrid: boolean;
  gridDivisions?: number;
  showAxes: boolean;
  fillSide: 'none' | 'below' | 'above';
  hideNonInteractive: boolean;
  constrain: 'none' | 'function';
  /** Single control that scales the plot. Height is derived at the
   *  CurveEditor's natural 2:1 aspect — saves a second slider. */
  width: number;
}

function Interactive(props: InteractiveProps) {
  const [value, setValue] = useState(props.initial);
  return (
    <CurveEditor
      value={value}
      onInput={setValue}
      domain={props.domain}
      interpolation={props.interpolation}
      endpoints={props.endpoints}
      addPointMode={props.addPointMode}
      grid={props.showGrid ? { divisions: props.gridDivisions ?? 3 } : false}
      axes={props.showAxes ? {} : false}
      fill={props.fillSide === 'none' ? false : { side: props.fillSide }}
      hideNonInteractive={props.hideNonInteractive}
      constrain={props.constrain}
      width={props.width}
      height={Math.round(props.width / 2)}
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
    interpolation: {
      control: 'select',
      options: ['linear', 'catmull-rom', 'catmull-rom-uniform', 'catmull-rom-chordal', 'monotone'],
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
    fillSide: {
      control: 'inline-radio',
      options: ['none', 'below', 'above'],
    },
    hideNonInteractive: { control: 'boolean' },
    constrain: {
      control: 'inline-radio',
      options: ['none', 'function'],
    },
    width: { control: { type: 'number', min: 100, max: 800, step: 20 } },
  },
};
export default meta;

type Story = StoryObj<typeof Interactive>;

const COMMON: Partial<InteractiveProps> = {
  interpolation: 'catmull-rom',
  addPointMode: 'click-curve',
  showGrid: false,
  gridDivisions: 3,
  showAxes: true,
  fillSide: 'none',
  hideNonInteractive: false,
  constrain: 'none',
  width: 400,
};

export const EasingCurve: Story = {
  args: {
    ...COMMON,
    initial: [{ x: 0, y: 0 }, { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.9 }, { x: 1, y: 1 }],
    domain: '1d',
    endpoints: 'pinned-both',
    fillSide: 'below',
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
