import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { LayerList, type LayerListItem } from './LayerList';

const meta: Meta<typeof LayerList> = {
  title: 'weasel-ui/LayerList',
  component: LayerList,
};
export default meta;

type Story = StoryObj<typeof LayerList>;

function Demo() {
  const [items, setItems] = useState<LayerListItem[]>([
    { id: 'a', label: 'Layer A' },
    { id: 'b', label: 'Layer B' },
    { id: 'c', label: 'Layer C' },
    { id: 'd', label: 'Layer D' },
    { id: 'e', label: 'Layer E' },
  ]);
  const [selected, setSelected] = useState<string[]>([]);

  const onReorder = (ids: string[], targetIndex: number) => {
    setItems((prev) => {
      const moving = ids
        .map((id) => prev.find((p) => p.id === id))
        .filter((x): x is LayerListItem => Boolean(x));
      const remaining = prev.filter((p) => !ids.includes(p.id));
      // Translate targetIndex (in original items list) to remaining-list index.
      const insertBeforeId = prev[targetIndex]?.id;
      const insertAt = insertBeforeId !== undefined
        ? remaining.findIndex((p) => p.id === insertBeforeId)
        : remaining.length;
      const out = [...remaining];
      out.splice(insertAt < 0 ? remaining.length : insertAt, 0, ...moving);
      return out;
    });
  };

  return (
    <div style={{ width: 200 }}>
      <LayerList
        items={items}
        selectedIds={selected}
        onSelect={setSelected}
        onReorder={onReorder}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <Demo />,
};

export const Empty: Story = {
  args: {
    items: [],
    selectedIds: [],
    onSelect: () => {},
    onReorder: () => {},
    empty: 'No layers in this group',
  },
};
