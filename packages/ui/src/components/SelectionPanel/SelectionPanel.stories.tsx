import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  asNodeId,
  createScene,
  defaultNodeProperties,
  inferredNodeProperties,
  inferredNodeRouting,
  solid,
  strokeOf,
  type RectPose,
} from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';

interface Data {
  path?: unknown;
  text?: string;
  style?: unknown;
  fill?: unknown;
  stroke?: unknown;
}

const POSE: RectPose = { x: 40, y: 24, width: 220, height: 140 };

function sceneWith(data: Data) {
  const scene = createScene<Data, 'default', RectPose>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'leaf', layer: 'default', pose: POSE, data });
  return scene;
}

const selection = { current: [asNodeId('n')] };

function Panel({ data }: { data: Data }) {
  return (
    <div style={{ inlineSize: 260 }}>
      <SelectionPanel
        scene={sceneWith(data)}
        selection={selection}
        properties={[...defaultNodeProperties, ...inferredNodeProperties]}
        routing={inferredNodeRouting}
      />
    </div>
  );
}

const meta: Meta<typeof Panel> = {
  title: 'weasel-ui/SelectionPanel',
  component: Panel,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof Panel>;

/** A path node: pose, fill, and the stroke's fields under one block. */
export const Shape: Story = {
  args: {
    data: {
      path: { kind: 'rect', x: 40, y: 24, width: 220, height: 140 },
      fill: solid('#7fb069'),
      stroke: { ...strokeOf('#1c1c1c', 6), cap: 'round', join: 'bevel' },
    },
  },
};

/** A stroke carrying a dash array that matches no preset — what an SVG import
 *  produces. Style reports it as Custom, which it does not offer to author. */
export const ImportedDash: Story = {
  args: {
    data: {
      path: { kind: 'rect', x: 40, y: 24, width: 220, height: 140 },
      fill: solid('#7fb069'),
      stroke: { ...strokeOf('#1c1c1c', 6), dash: [9, 2, 2, 2] },
    },
  },
};

/** A text node: the same appearance block, plus the style leaf's Character and
 *  Paragraph groups. */
export const Text: Story = {
  args: {
    data: {
      text: 'The quick brown fox',
      fill: solid('#1c1c1c'),
      style: { fontSize: 18, fontFamily: 'sans-serif', fontWeight: 500, align: 'center', lineHeight: 1.4 },
    },
  },
};
