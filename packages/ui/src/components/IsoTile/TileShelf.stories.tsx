import type { Meta, StoryObj } from '@weasel-js/forge';
import { TileShelf, type TileShelfGroup } from '@weasel-js/ui/components/IsoTile';
import s from './IsoTile.stories.module.css';

const TONES = [s.gray, s.accent, s.success, s.warning, s.danger];

const groups: TileShelfGroup[] = [
  { key: 'b3', label: 'b3', items: Array.from({ length: 5 }, (_, i) => ({ key: `b3-${i}`, tone: TONES[i % 2], title: `item ${i + 1} of b3` })) },
  { key: 'b4', label: 'b4', items: Array.from({ length: 3 }, (_, i) => ({ key: `b4-${i}`, marked: i === 1, title: `item ${i + 1} of b4` })) },
  { key: 'done', label: 'done', items: Array.from({ length: 9 }, (_, i) => ({ key: `done-${i}`, tone: TONES[2 + (i % 3)], marked: i === 4 })) },
];

const meta: Meta<typeof TileShelf> = {
  title: 'ui/IsoTile/TileShelf',
  component: TileShelf,
  args: { groups, 'aria-label': 'Fix groups' },
};
export default meta;
type Story = StoryObj<typeof TileShelf>;

/** Tiles standing in labeled groups, a dot over the marked ones. Hover a tile: its group keeps its colors, the rest
 *  fade, and it is outlined over its neighbors. */
export const Groups: Story = {};

/** A key traced from elsewhere: the shelf shows it without a hover. */
export const Traced: Story = { args: { traced: 'b4-1' } };
