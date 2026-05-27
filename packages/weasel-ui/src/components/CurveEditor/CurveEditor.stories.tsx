import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { CurveEditor, type ControlPoint } from './CurveEditor';

const meta: Meta<typeof CurveEditor> = {
  title: 'weasel-ui/CurveEditor',
  component: CurveEditor,
};
export default meta;

type Story = StoryObj<typeof CurveEditor>;

function Interactive(props: {
  initial: ControlPoint[];
  domain?: '1d' | '2d';
  endpoints?: 'free' | 'pinned-x' | 'pinned-both';
  width?: number;
  height?: number;
  showGrid?: boolean;
  showAxes?: boolean;
}) {
  const [value, setValue] = useState(props.initial);
  return (
    <CurveEditor
      value={value}
      onChange={setValue}
      domain={props.domain}
      endpoints={props.endpoints}
      width={props.width ?? 400}
      height={props.height ?? 200}
      showGrid={props.showGrid}
      showAxes={props.showAxes}
    />
  );
}

export const EasingCurve: Story = {
  render: () => (
    <Interactive
      initial={[{ x: 0, y: 0 }, { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.9 }, { x: 1, y: 1 }]}
      domain="1d"
      endpoints="pinned-both"
      showGrid
      showAxes
    />
  ),
};

export const TwoDimPath: Story = {
  render: () => (
    <Interactive
      initial={[{ x: 0.1, y: 0.5 }, { x: 0.3, y: 0.8 }, { x: 0.7, y: 0.2 }, { x: 0.9, y: 0.5 }]}
      domain="2d"
      endpoints="free"
      showGrid
    />
  ),
};

export const PinnedX: Story = {
  render: () => (
    <Interactive
      initial={[{ x: 0, y: 0.3 }, { x: 0.5, y: 0.7 }, { x: 1, y: 0.4 }]}
      domain="1d"
      endpoints="pinned-x"
      showAxes
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <Interactive
      initial={[]}
      domain="2d"
      endpoints="free"
      showGrid
    />
  ),
};
