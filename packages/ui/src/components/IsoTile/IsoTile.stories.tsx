import type { Meta, StoryObj } from '@weasel-js/forge';
import { IsoTile } from '@weasel-js/ui/components/IsoTile';
import s from './IsoTile.stories.module.css';

const meta: Meta<typeof IsoTile> = {
  title: 'ui/IsoTile',
  component: IsoTile,
  args: { x: 4, y: 12, width: 28, height: 7, depth: 8, tone: s.accent, title: 'one tile' },
  render: (args) => <svg viewBox="0 0 48 24" width={192}><IsoTile {...args} /></svg>,
};
export default meta;
type Story = StoryObj<typeof IsoTile>;

/** One tile: a front face, its top lit and its side shaded, all in the tone's `--tile`. */
export const Flat: Story = {};

/** Stood on end, as a shelf's tiles are. */
export const Standing: Story = {
  args: { x: 18, y: 8, width: 7, height: 26, depth: 6, tone: s.success },
  render: (args) => <svg viewBox="0 0 48 40" width={192}><IsoTile {...args} /></svg>,
};
