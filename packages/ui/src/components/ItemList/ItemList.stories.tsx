import type { Meta, StoryObj } from '@weasel-js/forge';
import { type RefCallback, useState } from 'react';
import { type LayerListItem, useReorderDragList } from '../../useReorderDragList';
import { ItemList, type ItemListRow } from './ItemList';

const meta: Meta<typeof ItemList> = {
  title: 'weasel-ui/ItemList',
  component: ItemList,
};
export default meta;
type Story = StoryObj<typeof ItemList>;

/** Rows, one current and one muted, as a history list shows them. */
export const Basic: Story = {
  render: () => (
    <div style={{ width: 240 }}>
      <ItemList
        rows={[
          { id: 'a', label: 'Draw rectangle' },
          { id: 'b', label: 'Move 3 shapes', selected: true },
          { id: 'c', label: 'Delete ellipse', muted: true },
        ]}
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div style={{ width: 240 }}>
      <ItemList rows={[]} empty="Nothing drawn yet" />
    </div>
  ),
};

const LAYERS: LayerListItem[] = [
  { id: 'sky', label: 'Sky', swatch: '#6ab7ff' },
  { id: 'hills', label: 'Hills', swatch: '#7bc96f' },
  { id: 'house', label: 'House', swatch: '#e58f65' },
  { id: 'door', label: 'Door', swatch: '#8a5a44' },
];

/** Reordered with `useReorderDragList`: the dragged row holds its place while its ghost follows the pointer. Shift-click
 *  adds a row to the selection, and dragging a selected row drags them all. */
export const Reorder: Story = {
  render: () => {
    function Layers() {
      const [items, setItems] = useState(LAYERS);
      const [selected, setSelected] = useState<string[]>([]);
      const drag = useReorderDragList({
        items,
        selectedIds: selected,
        onPress: (id, mods) =>
          setSelected((prev) => (mods.shiftKey ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : [id])),
        onReorder: (ids, target) =>
          setItems((prev) => {
            const moving = prev.filter((it) => ids.includes(it.id));
            const before = prev.slice(0, target).filter((it) => !ids.includes(it.id));
            const after = prev.slice(target).filter((it) => !ids.includes(it.id));
            return [...before, ...moving, ...after];
          }),
      });
      const rows: ItemListRow[] = items.map((item, i) => ({
        id: item.id,
        label: item.label,
        selected: selected.includes(item.id),
        muted: drag.state.draggedIds?.includes(item.id) ?? false,
        leading: <span style={{ width: 10, height: 10, borderRadius: 2, background: item.swatch }} />,
        rowProps: drag.rowProps(item.id, i),
      }));
      return (
        <ItemList rows={rows} ref={drag.containerProps.ref as RefCallback<HTMLDivElement>} ghost={drag.state.ghost} />
      );
    }
    return (
      <div style={{ width: 240 }}>
        <Layers />
      </div>
    );
  },
};
