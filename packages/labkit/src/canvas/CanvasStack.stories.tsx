import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ScaleIndicator } from '../primitives/ScaleIndicator';
import { CanvasStack } from './CanvasStack';
import type { CanvasLayerDescriptor } from './useLayerScheduler';

const meta: Meta<typeof CanvasStack> = {
  title: 'Canvas/CanvasStack',
  component: CanvasStack,
  parameters: { layout: 'fullscreen' },
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

function Harness({ layers }: { layers: CanvasLayerDescriptor[] }) {
  const [view, setView] = useState({ zoom: 1, pan: { x: 50, y: 50 } });
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CanvasStack layers={layers} view={view} onViewChange={setView}>
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <ScaleIndicator />
        </div>
      </CanvasStack>
    </div>
  );
}

export const Default: Story = {
  render: () => <Harness layers={[makeColoredLayer('a', '#3a86ff', 0, 0)]} />,
};

export const MultiLayer: Story = {
  render: () => (
    <Harness
      layers={[
        makeColoredLayer('a', '#3a86ff', 0, 0),
        makeColoredLayer('b', '#ff006e', 60, 60),
        makeColoredLayer('c', '#ffbe0b', 120, 120),
      ]}
    />
  ),
};

export const WithScaleIndicator: Story = {
  render: () => <Harness layers={[makeColoredLayer('a', '#06d6a0', 0, 0)]} />,
};
