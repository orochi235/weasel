import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { TileShelf, TileStacks, type TileItem } from '@weasel-js/ui/components/IsoTile';
import s from './IsoTile.stories.module.css';

/** Which pass first saw each item, and the passes that saw it. */
const SEEN: Record<string, number[]> = {
  d1: [1, 2, 4, 5], d2: [1, 3], d3: [1], d4: [2, 3, 5, 6], d5: [2], d6: [3, 6], d7: [5], d8: [6],
};

const columns: TileItem[][] = Array.from({ length: 7 }, (_, i) => Object.entries(SEEN)
  .filter(([, at]) => at.includes(i + 1))
  .map(([key, at]) => {
    const first = at[0] === i + 1;
    return { key, first, tone: first ? (at.length > 1 ? s.accent : s.warning) : s.gray, title: `pass ${i + 1} · ${key}${first ? ', new' : ', seen before'}` };
  })
  .sort((a, b) => Number(a.first) - Number(b.first)));

const meta: Meta<typeof TileStacks> = {
  title: 'ui/IsoTile/TileStacks',
  component: TileStacks,
  args: { columns, 'aria-label': 'Findings per pass', span: 10, trailing: '≈ 3 not found yet', emptyTitle: (c) => `pass ${c} · no findings` },
};
export default meta;
type Story = StoryObj<typeof TileStacks>;

/** Each pass's findings stacked, repeats under new ones; pass 7 found nothing. Hover a tile to trace its item across
 *  every pass. */
export const Passes: Story = {};

/** One trace shared with a `TileShelf` through `traced` and `onTrace`: hovering either lights the same key in both. */
export const SharedTrace: Story = {
  render: (args) => <Shared {...args} />,
};

function Shared(props: Parameters<typeof TileStacks>[0]) {
  const [traced, setTraced] = useState<string | null>(null);
  return (
    <>
      <TileStacks {...props} traced={traced} onTrace={setTraced} />
      <TileShelf aria-label="Fix groups" traced={traced} onTrace={setTraced} groups={[
        { key: 'b1', label: 'b1', items: [{ key: 'd1', tone: s.success }, { key: 'd4', tone: s.accent, marked: true }] },
        { key: 'b2', label: 'b2', items: ['d2', 'd3', 'd5'].map((key) => ({ key })) },
        { key: 'done', label: 'done', items: [{ key: 'd6', tone: s.danger }, { key: 'd7', tone: s.success }, { key: 'd8', tone: s.success }] },
      ]} />
    </>
  );
}
