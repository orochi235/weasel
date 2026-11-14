import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { ZoomControl } from '@weasel-js/ui/components/ZoomControl';

const meta: Meta<typeof ZoomControl> = {
  title: 'ui/ZoomControl',
  component: ZoomControl,
  args: { zoom: 1, min: 0.1, max: 8 },
};
export default meta;

type Story = StoryObj<typeof ZoomControl>;

/** Drag the slider or type a percentage; 25, 50, 100, 200, and 400% are detents. */
export const Default: Story = {
  render: (args) => {
    const [zoom, setZoom] = useState(args.zoom);
    return <ZoomControl {...args} zoom={zoom} onZoomChange={setZoom} />;
  },
};

/** A wider range: the field holds "1600%". */
export const WideRange: Story = {
  args: { min: 0.05, max: 16 },
  render: Default.render,
};
