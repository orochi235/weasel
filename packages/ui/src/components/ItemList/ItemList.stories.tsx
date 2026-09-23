import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { useReorderDragList, type LayerListItem } from '../../useReorderDragList';
import { ItemList } from './ItemList';

const meta: Meta<typeof ItemList> = {
  title: 'ui/ItemList',
  component: ItemList,
};
export default meta;
type Story = StoryObj<typeof ItemList>;

export const Basic: Story = {
  args: {
    rows: [
      { id: 'a', label: 'Background' },
      { id: 'b', label: 'Sketch', selected: true },
      { id: 'c', label: 'Ink' },
      { id: 'd', label: 'Redo entry', muted: true },
    ],
  },
};

/** Drag a row. The hook's `targetIndex` goes to `dropIndex` and the list draws
 *  the seam; its `draggedIds` mark the rows that are `dragging`. */
export const Reorder: Story = {
  render: function Render() {
    const [items, setItems] = useState<LayerListItem[]>([
      { id: 'page', label: 'Page', locked: true },
      { id: 'a', label: 'Background' },
      { id: 'b', label: 'Sketch' },
      { id: 'c', label: 'Ink' },
      { id: 'd', label: 'Highlights' },
    ]);
    const [selected, setSelected] = useState<string[]>(['b']);
    const drag = useReorderDragList({
      items,
      selectedIds: selected,
      onPress: (id) => setSelected([id]),
      onReorder: (ids, target) => {
        setItems((cur) => {
          const moving = cur.filter((it) => ids.includes(it.id));
          const before = cur.slice(0, target).filter((it) => !ids.includes(it.id));
          const after = cur.slice(target).filter((it) => !ids.includes(it.id));
          return [...before, ...moving, ...after];
        });
      },
    });
    return (
      <div style={{ width: 220 }}>
        <ItemList
          ref={drag.containerProps.ref}
          dropIndex={drag.state.targetIndex}
          rows={items.map((it, i) => ({
            id: it.id,
            label: it.label,
            selected: selected.includes(it.id),
            dragging: drag.state.draggedIds?.includes(it.id),
            rowProps: drag.rowProps(it.id, i),
          }))}
        />
      </div>
    );
  },
};
