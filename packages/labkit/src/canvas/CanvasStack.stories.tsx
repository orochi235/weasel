import type { Meta, StoryObj } from '@weasel-js/forge';
import { useArgs } from '@weasel-js/forge/preview-api';
import type { CanvasLayerDescriptor } from '@weasel-js/labkit/canvas';
import { CanvasStack, type CanvasStackProps } from '@weasel-js/labkit/canvas';
import { ScaleIndicator } from '@weasel-js/labkit/primitives';

const meta: Meta<typeof CanvasStack> = {
  title: 'labkit/Canvas/CanvasStack',
  component: CanvasStack,
  parameters: { layout: 'fullscreen' },
  // The view is an arg, not the harness's own state, so a Live lens's copy and a Pixels capture show it as panned.
  args: { view: { zoom: 1, pan: { x: 50, y: 50 } } },
  argTypes: { view: { control: false }, onViewChange: { control: false } },
};
export default meta;

type Story = StoryObj<typeof CanvasStack>;

function makeColoredLayer(id: string, color: string, x: number, y: number): CanvasLayerDescriptor {
  return {
    id,
    visible: true,
    render: (ctx, view) => {
      ctx.fillStyle = color;
      ctx.fillRect(
        x * view.zoom + view.pan.x,
        y * view.zoom + view.pan.y,
        80 * view.zoom,
        80 * view.zoom,
      );
    },
  };
}

function Harness({
  layers,
  view,
  ...args
}: Partial<CanvasStackProps> & { layers: CanvasLayerDescriptor[] }) {
  const [, updateArgs] = useArgs();
  return (
    <div style={{ width: '100cqi', height: '100cqb' }}>
      <CanvasStack
        {...args}
        layers={layers}
        view={view ?? { zoom: 1, pan: { x: 50, y: 50 } }}
        onViewChange={(next) => updateArgs({ view: next })}
      >
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <ScaleIndicator />
        </div>
      </CanvasStack>
    </div>
  );
}

export const Default: Story = {
  render: (args) => <Harness {...args} layers={[makeColoredLayer('a', '#3a86ff', 0, 0)]} />,
};

export const MultiLayer: Story = {
  render: (args) => (
    <Harness
      {...args}
      layers={[
        makeColoredLayer('a', '#3a86ff', 0, 0),
        makeColoredLayer('b', '#ff006e', 60, 60),
        makeColoredLayer('c', '#ffbe0b', 120, 120),
      ]}
    />
  ),
};

export const WithScaleIndicator: Story = {
  render: (args) => <Harness {...args} layers={[makeColoredLayer('a', '#06d6a0', 0, 0)]} />,
};
