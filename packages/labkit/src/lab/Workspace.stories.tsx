import type { Meta, StoryObj } from '@weasel-js/forge';
import { Workspace } from '@weasel-js/labkit';
import type { ReactNode } from 'react';
import '../frames.stories.less';
import './Workspace.stories.less';

const meta: Meta<typeof Workspace> = {
  title: 'labkit/Lab/Workspace',
  component: Workspace,
};
export default meta;

type Story = StoryObj<typeof Workspace>;

const Tile = ({ children }: { children: ReactNode }) => (
  <div className="lk-story-tile">{children}</div>
);

export const OneTile: Story = {
  render: (args) => (
    <div className="lk-story-h400">
      <Workspace {...args}>
        <Tile>1</Tile>
      </Workspace>
    </div>
  ),
};

export const ThreeTiles: Story = {
  render: (args) => (
    <div className="lk-story-h400">
      <Workspace {...args}>
        <Tile>1</Tile>
        <Tile>2</Tile>
        <Tile>3</Tile>
      </Workspace>
    </div>
  ),
};

export const SevenTiles: Story = {
  render: (args) => (
    <div className="lk-story-h600">
      <Workspace {...args}>
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
  render: (args) => (
    <div className="lk-story-h500">
      <Workspace {...args} ids={['a', 'b', 'c', 'd', 'e']} resizable>
        <Tile>1</Tile>
        <Tile>2</Tile>
        <Tile>3</Tile>
        <Tile>4</Tile>
        <Tile>5</Tile>
      </Workspace>
    </div>
  ),
};

/** Every tile has an expand button in its corner that shows it large over the
 *  page. The tile is lifted into the browser's top layer rather than
 *  remounted; Escape, the close button, or a click in the margin puts it back.
 *  Tile 1 also opens on a double-click, through `expandOnDoubleClick`. */
export const Lightbox: Story = {
  render: (args) => (
    <div className="lk-story-h500">
      <Workspace {...args} ids={['a', 'b', 'c']} resizable expandOnDoubleClick={(id) => id === 'a'}>
        <Tile>1</Tile>
        <Tile>2</Tile>
        <Tile>3</Tile>
      </Workspace>
    </div>
  ),
};
