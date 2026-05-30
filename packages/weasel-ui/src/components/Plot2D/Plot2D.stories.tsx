import type { Meta, StoryObj } from '@storybook/react';
import { useRef } from 'react';
import { Plot2D, type Plot2DHandle } from './Plot2D';

interface DemoProps {
  width: number;
  height: number;
  showGrid: boolean;
  gridDivisions: number;
  showAxes: boolean;
}

function Demo(props: DemoProps) {
  return (
    <Plot2D
      width={props.width}
      height={props.height}
      grid={props.showGrid ? { divisions: props.gridDivisions } : false}
      axes={props.showAxes ? {} : false}
    />
  );
}

const meta: Meta<typeof Demo> = {
  title: 'weasel-ui/Plot2D',
  component: Demo,
  argTypes: {
    width: { control: { type: 'number', min: 100, max: 800, step: 20 } },
    height: { control: { type: 'number', min: 50, max: 600, step: 10 } },
    showGrid: { control: 'boolean' },
    gridDivisions: { control: { type: 'number', min: 1, max: 20, step: 1 } },
    showAxes: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<typeof Demo>;

export const EmptyPlot: Story = {
  args: {
    width: 400, height: 200,
    showGrid: true, gridDivisions: 3, showAxes: true,
  },
};

/**
 * Caller-rendered marks composed inside Plot2D. We use the ref handle's
 * `modelToPlot` to position circles at known model-space points.
 */
function WithChildren(props: DemoProps & { points: { x: number; y: number }[] }) {
  const plotRef = useRef<Plot2DHandle>(null);
  // Pre-compute the points in plot space on first render. Plot2D's
  // transforms are stable for fixed width/height/range, so a one-shot
  // lookup is fine for a static-data story.
  const pts = props.points.map((p) => ({
    model: p,
    plot: plotRef.current?.modelToPlot(p) ?? {
      x: p.x * props.width,
      y: (1 - p.y) * props.height,
    },
  }));
  return (
    <Plot2D
      ref={plotRef}
      width={props.width}
      height={props.height}
      grid={props.showGrid ? { divisions: props.gridDivisions } : false}
      axes={props.showAxes ? {} : false}
    >
      {pts.map((pt, i) => (
        <circle key={i} cx={pt.plot.x} cy={pt.plot.y} r={5} fill="currentColor" />
      ))}
    </Plot2D>
  );
}

export const WithChildMarks: StoryObj<typeof WithChildren> = {
  render: (args) => <WithChildren {...args} />,
  args: {
    width: 400, height: 200,
    showGrid: true, gridDivisions: 3, showAxes: true,
    points: [
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.7 },
      { x: 0.6, y: 0.4 },
      { x: 0.9, y: 0.9 },
    ],
  },
};
