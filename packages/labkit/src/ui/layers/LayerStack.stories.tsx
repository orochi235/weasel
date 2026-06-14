import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { LayerStack, type LayerStackItem } from './LayerStack';

const meta: Meta<typeof LayerStack> = {
  title: 'UI/Layers/LayerStack',
  component: LayerStack,
};
export default meta;

const seed: LayerStackItem[] = [
  { id: 1, kind: 'fill', primaryValue: 'dome', primaryOptions: ['aqua', 'bevel', 'dome'] },
  { id: 2, kind: 'tail', accent: '#f55', badge: '1' },
  { id: 3, kind: 'shadow' },
];

export const Basic: StoryObj<typeof LayerStack> = {
  render: () => {
    const [items, setItems] = useState(seed);
    let next = 4;
    return (
      <div style={{ width: 320 }}>
        <LayerStack
          title="Layers"
          items={items}
          paletteKinds={['fill', 'tail', 'shadow']}
          onAdd={(kind) => setItems([...items, { id: next++, kind }])}
          onRemove={(id) => setItems(items.filter((i) => i.id !== id))}
          onReorder={(ids) => {
            const byId = new Map(items.map((i) => [i.id, i]));
            const reordered = ids.flatMap((id) => {
              const found = byId.get(id);
              return found ? [found] : [];
            });
            setItems(reordered);
          }}
          onPrimaryChange={(id, value) =>
            setItems(items.map((i) => (i.id === id ? { ...i, primaryValue: value } : i)))
          }
          renderBody={(item) => <div style={{ color: '#888' }}>body for {item.kind}</div>}
        />
      </div>
    );
  },
};
