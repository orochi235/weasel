import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScaleIndicator } from './ScaleIndicator';

const meta: Meta<typeof ScaleIndicator> = {
  title: 'labkit/Primitives/ScaleIndicator',
  component: ScaleIndicator,
  args: { unit: 'ft', pixelsPerUnit: 50 },
};
export default meta;

type Story = StoryObj<typeof ScaleIndicator>;

export const NoZoom: Story = { args: { zoom: 1 } };
export const ZoomedIn: Story = { args: { zoom: 4 } };
export const ZoomedOut: Story = { args: { zoom: 0.25 } };
export const Meters: Story = { args: { zoom: 1, unit: 'm', pixelsPerUnit: 100 } };
