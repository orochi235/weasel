import type { Meta, StoryObj } from '@storybook/react';
import { WorkspaceGrid } from './WorkspaceGrid';

const meta: Meta<typeof WorkspaceGrid> = {
  title: 'Lab/WorkspaceGrid',
  component: WorkspaceGrid,
};
export default meta;

type Story = StoryObj<typeof WorkspaceGrid>;

const Tile = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      background: 'var(--lk-bg-elevated)',
      border: '1px solid var(--lk-border)',
      borderRadius: 'var(--lk-radius)',
      padding: 'var(--lk-spacing-md)',
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
      <WorkspaceGrid>
        <Tile>1</Tile>
      </WorkspaceGrid>
    </div>
  ),
};

export const ThreeTiles: Story = {
  render: () => (
    <div style={{ height: 400 }}>
      <WorkspaceGrid>
        <Tile>1</Tile>
        <Tile>2</Tile>
        <Tile>3</Tile>
      </WorkspaceGrid>
    </div>
  ),
};

export const SevenTiles: Story = {
  render: () => (
    <div style={{ height: 600 }}>
      <WorkspaceGrid>
        {Array.from({ length: 7 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static demo list
          <Tile key={i}>{i + 1}</Tile>
        ))}
      </WorkspaceGrid>
    </div>
  ),
};
