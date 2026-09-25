import type { Meta, StoryObj } from '@weasel-js/forge';
import { DragHandleGlyph } from './DragHandleGlyph';

const meta: Meta<typeof DragHandleGlyph> = {
  title: 'weasel-ui/DragHandleGlyph',
  component: DragHandleGlyph,
};
export default meta;
type Story = StoryObj<typeof DragHandleGlyph>;

export const Default: Story = {
  args: { size: 16 },
};

/** Proofed large, where a dot off the grid shows; the right-hand one is the size it ships at. */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      {[128, 64, 32, 16].map((size) => (
        <DragHandleGlyph key={size} size={size} />
      ))}
    </div>
  ),
};
