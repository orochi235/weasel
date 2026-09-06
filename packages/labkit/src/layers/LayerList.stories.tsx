import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { LayerList, type LayerTreeNode } from './LayerList';

const meta: Meta<typeof LayerList> = {
  title: 'labkit/layers/LayerList',
  component: LayerList,
};
export default meta;
type Story = StoryObj<typeof LayerList>;

const FLAT: LayerTreeNode[] = [
  { id: 'plants', label: 'Plants' },
  { id: 'grid', label: 'Grid' },
  { id: 'legend', label: 'Legend', alwaysOn: true },
];

const NESTED: LayerTreeNode[] = [
  {
    id: 'ingest',
    label: 'Ingest',
    children: [
      { id: 'ingest.fetch', label: 'Fetch' },
      { id: 'ingest.parse', label: 'Parse' },
    ],
  },
  {
    id: 'solve',
    label: 'Solve',
    defaultCollapsed: true,
    children: [
      { id: 'solve.seed', label: 'Seed' },
      {
        id: 'solve.relax',
        label: 'Relax',
        children: [
          { id: 'solve.relax.sweep', label: 'Sweep' },
          { id: 'solve.relax.check', label: 'Check' },
        ],
      },
    ],
  },
  { id: 'report', label: 'Report', alwaysOn: true },
];

function Demo({ seed }: { seed: LayerTreeNode[] }) {
  const [layers, setLayers] = useState(seed);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  return (
    <div style={{ width: 220 }}>
      <LayerList
        layers={layers}
        visibility={visibility}
        onReorder={setLayers}
        onToggle={(id, visible) => setVisibility((v) => ({ ...v, [id]: visible }))}
      />
    </div>
  );
}

/** No node has children, so no row spends width on a twisty column. */
export const Flat: Story = { render: () => <Demo seed={FLAT} /> };

/** Dragging a row reorders it among its own siblings — a drag never moves a
 *  layer to a different parent. */
export const Tree: Story = { render: () => <Demo seed={NESTED} /> };
