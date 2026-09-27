import type { Meta, StoryObj } from '@weasel-js/forge';
import { DragGrip } from './DragGrip';

const meta: Meta<typeof DragGrip> = {
  title: 'weasel-ui/DragGrip',
  component: DragGrip,
};
export default meta;
type Story = StoryObj<typeof DragGrip>;

export const Default: Story = {
  args: { size: 16 },
};

/** Proofed large, where a dot off the grid shows; the right-hand one is the size it ships at. */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      {[128, 64, 32, 16].map((size) => (
        <DragGrip key={size} size={size} />
      ))}
    </div>
  ),
};
