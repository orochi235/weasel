import type { Meta, StoryObj } from '@weasel-js/forge';
import { TileGrip, Workspace } from '@weasel-js/labkit';
import { useState } from 'react';

const meta: Meta<typeof TileGrip> = {
  title: 'labkit/Lab/Workspace/TileGrip',
  component: TileGrip,
};
export default meta;

type Story = StoryObj<typeof TileGrip>;

const Tile = ({ args, label }: { args: Story['args']; label: string }) => (
  <div
    style={{
      background: 'var(--wzl-surface-raised)',
      border: '1px solid var(--wzl-border)',
      borderRadius: 'var(--wzl-radius-md)',
      height: '100%',
      boxSizing: 'border-box',
      display: 'grid',
      gridTemplateRows: 'auto 1fr',
    }}
  >
    <TileGrip
      {...args}
      style={{
        padding: 'var(--wzl-space-sm) var(--wzl-space-md)',
        borderBottom: '1px solid var(--wzl-border)',
      }}
    >
      Tile {label}
    </TileGrip>
    <div style={{ display: 'grid', placeItems: 'center' }}>{label}</div>
  </div>
);

function ReorderableTiles({ args }: { args: Story['args'] }) {
  const [ids, setIds] = useState(['a', 'b', 'c']);
  return (
    <div style={{ height: 400 }}>
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
    <div style={{ height: 160, width: 240 }}>
      <Tile args={args} label="a" />
    </div>
  ),
};
