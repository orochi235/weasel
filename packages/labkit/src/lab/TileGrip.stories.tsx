import type { Meta, StoryObj } from '@weasel-js/forge';
import { TileGrip, Workspace } from '@weasel-js/labkit';
import { useState } from 'react';
import '../frames.stories.less';
import './Workspace.stories.less';

const meta: Meta<typeof TileGrip> = {
  title: 'labkit/Lab/Workspace/TileGrip',
  component: TileGrip,
};
export default meta;

type Story = StoryObj<typeof TileGrip>;

const Tile = ({ args, label }: { args: Story['args']; label: string }) => (
  <div className="lk-story-tile lk-story-tile--gripped">
    <TileGrip
      {...args}
      className={['lk-story-tile__grip', args?.className].filter(Boolean).join(' ')}
    >
      Tile {label}
    </TileGrip>
    <div className="lk-story-tile__body">{label}</div>
  </div>
);

function ReorderableTiles({ args }: { args: Story['args'] }) {
  const [ids, setIds] = useState(['a', 'b', 'c']);
  return (
    <div className="lk-story-h400">
      <Workspace ids={ids} reorderable onReorder={setIds}>
        {ids.map((id) => (
          <Tile key={id} args={args} label={id} />
        ))}
      </Workspace>
    </div>
  );
}

/** Plain tiles, each with a grip for a header. Drag a header to move its tile;
 *  the workspace reports the new order and the story commits it. */
export const Reorderable: Story = {
  render: (args) => <ReorderableTiles args={args} />,
};

/** Outside a reorderable workspace a grip is a plain `div`. */
export const OutsideWorkspace: Story = {
  render: (args) => (
    <div className="lk-story-card">
      <Tile args={args} label="a" />
    </div>
  ),
};
