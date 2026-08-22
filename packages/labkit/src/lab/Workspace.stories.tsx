import type { Meta, StoryObj } from '@storybook/react-vite';
import { Workspace } from './Workspace';

const meta: Meta<typeof Workspace> = {
  title: 'labkit/Lab/Workspace',
  component: Workspace,
};
export default meta;

type Story = StoryObj<typeof Workspace>;

const Tile = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: 'var(--wzl-surface-raised)',
      border: '1px solid var(--wzl-border)',
      borderRadius: 'var(--wzl-radius-md)',
      padding: 'var(--wzl-space-md)',
      minHeight: 120,
      display: 'grid',
      placeItems: 'center',
    }}
  >
    {children}
  </div>
);

export const OneTile: Story = {
  render: () => (
    <div style={{ height: 400 }}>
      <Workspace>
        <Tile>1</Tile>
      </Workspace>
    </div>
  ),
};

export const ThreeTiles: Story = {
  render: () => (
    <div style={{ height: 400 }}>
      <Workspace>
        <Tile>1</Tile>
        <Tile>2</Tile>
        <Tile>3</Tile>
      </Workspace>
    </div>
  ),
};

export const SevenTiles: Story = {
  render: () => (
    <div style={{ height: 600 }}>
      <Workspace>
        {Array.from({ length: 7 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static demo list
          <Tile key={i}>{i + 1}</Tile>
        ))}
      </Workspace>
    </div>
  ),
};

/** Draggable seams. Drag a tile edge, or Tab to a seam and press an arrow —
 *  a grid moves extents a whole cell at a time. */
export const Resizable: Story = {
  render: () => (
    <div style={{ height: 500 }}>
      <Workspace ids={['a', 'b', 'c', 'd', 'e']} resizable>
        <Tile>1</Tile>
        <Tile>2</Tile>
        <Tile>3</Tile>
        <Tile>4</Tile>
        <Tile>5</Tile>
      </Workspace>
    </div>
  ),
};
