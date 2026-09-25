import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { useReorderDragList, type PressModifiers, type ReorderItem } from '../../useReorderDragList';
import { Button } from '../Button';
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

/** Selectable rows make a listbox. Tab in, move with the arrows, pick with
 *  Enter or Space. */
export const Selectable: Story = {
  render: function Render() {
    const [current, setCurrent] = useState('b');
    return (
      <div style={{ width: 220 }}>
        <ItemList
          selection="single"
          containerProps={{ 'aria-label': 'History' }}
          onActivate={setCurrent}
          rows={['Initial', 'Draw rect', 'Fill', 'Move'].map((label, i) => ({
            id: String.fromCharCode(97 + i),
            label,
            selected: String.fromCharCode(97 + i) === current,
          }))}
        />
      </div>
    );
  },
};

/** Drag a row, or move it with Alt+Up/Down. A dragged row holds its place while
 *  its `ghost` follows the pointer. The hook's `targetIndex` goes to
 *  `dropIndex` and the list draws the seam; its `draggedIds` mark the rows
 *  that are `dragging`; its `nudge` is the keyboard move. Shift+click or
 *  Shift+Space adds to the selection; Shift+Up/Down and Shift+Home/End select
 *  a range through `onSelectRange`. */
export const Reorder: Story = {
  render: function Render() {
    const [items, setItems] = useState<ReorderItem[]>([
      { id: 'page', label: 'Page', locked: true },
      { id: 'a', label: 'Background' },
      { id: 'b', label: 'Sketch' },
      { id: 'c', label: 'Ink' },
      { id: 'd', label: 'Highlights' },
    ]);
    const [selected, setSelected] = useState<string[]>(['b']);
    const press = (id: string, mods: PressModifiers) => setSelected((cur) => {
      if (!mods.shiftKey) return [id];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });
    const drag = useReorderDragList({
      items,
      selectedIds: selected,
      onPress: press,
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
          selection="multi"
          containerProps={{ 'aria-label': 'Layers' }}
          onActivate={(id, _i, mods) => press(id, mods)}
          onSelectRange={setSelected}
          onNudge={drag.nudge}
          dropIndex={drag.state.targetIndex}
          ghost={drag.state.ghost}
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

/** Rows with controls become a grid: Right steps into a row's toggles, Left or
 *  Escape steps back out, and a toggle's click never selects its row. */
export const WithControls: Story = {
  render: function Render() {
    const [selected, setSelected] = useState('a');
    const [hidden, setHidden] = useState<string[]>(['c']);
    const [locked, setLocked] = useState<string[]>([]);
    const flip = (list: string[], id: string) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    return (
      <div style={{ width: 260 }}>
        <ItemList
          selection="single"
          containerProps={{ 'aria-label': 'Layers' }}
          onActivate={setSelected}
          rows={['Background', 'Sketch', 'Ink'].map((label, i) => {
            const id = String.fromCharCode(97 + i);
            return {
              id,
              label,
              selected: id === selected,
              muted: hidden.includes(id),
              trailing: (
                <>
                  <Button size="sm" variant="ghost" pressed={!hidden.includes(id)}
                    onClick={() => setHidden((h) => flip(h, id))}>
                    {hidden.includes(id) ? 'Show' : 'Hide'}
                  </Button>
                  <Button size="sm" variant="ghost" pressed={locked.includes(id)}
                    onClick={() => setLocked((l) => flip(l, id))}>
                    Lock
                  </Button>
                </>
              ),
            };
          })}
        />
      </div>
    );
  },
};
