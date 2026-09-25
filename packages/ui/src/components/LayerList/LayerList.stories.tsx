import type { Meta, StoryObj } from '@weasel-js/forge';
import { type CSSProperties, useState } from 'react';
import { LayerList, type LayerListItem, moveLayers } from './LayerList';
import s from './LayerList.stories.module.css';

const meta: Meta<typeof LayerList> = {
  title: 'ui/LayerList',
  component: LayerList,
};
export default meta;
type Story = StoryObj<typeof LayerList>;

// A custom property rather than a class: the swatch's color is data.
const swatch = (color: string) => (
  <span className={s.swatch} style={{ '--swatch': color } as CSSProperties} aria-hidden="true" />
);

/** A document's objects: click to select, shift-click to add, drag a selected
 *  row to move the whole selection. The locked Background row selects alone
 *  and walls off drops below it. */
export const Selectable: Story = {
  render: () => {
    const [items, setItems] = useState<LayerListItem[]>([
      { id: 'title', label: 'Title', leading: swatch('#222') },
      { id: 'sun', label: 'Sun', leading: swatch('#f5b041') },
      { id: 'hill', label: 'Hill', leading: swatch('#58d68d') },
      { id: 'sky', label: 'Sky', leading: swatch('#5dade2') },
      { id: 'bg', label: 'Background', leading: swatch('#fff'), locked: true },
    ]);
    const [selected, setSelected] = useState<string[]>(['sun']);
    return (
      <div className={s.narrow}>
        <LayerList
          items={items}
          selectedIds={selected}
          onSelect={setSelected}
          onReorder={(move) => setItems(moveLayers(items, move))}
        />
      </div>
    );
  },
};

/** Layers that hold layers, each with a visibility checkbox. A drag reorders a
 *  row among its own siblings and never moves it to another parent. */
export const Nested: Story = {
  render: () => {
    const [items, setItems] = useState<LayerListItem[]>([
      {
        id: 'ingest',
        label: 'Ingest',
        children: [
          { id: 'fetch', label: 'Fetch' },
          { id: 'parse', label: 'Parse' },
        ],
      },
      {
        id: 'solve',
        label: 'Solve',
        defaultCollapsed: true,
        children: [
          { id: 'seed', label: 'Seed' },
          {
            id: 'relax',
            label: 'Relax',
            children: [
              { id: 'sweep', label: 'Sweep' },
              { id: 'check', label: 'Check' },
            ],
          },
        ],
      },
      { id: 'report', label: 'Report', locked: true },
    ]);
    const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
    const shown = (list: LayerListItem[]): LayerListItem[] =>
      list.map((it) => ({
        ...it,
        visible: !hidden.has(it.id),
        ...(it.children ? { children: shown(it.children) } : {}),
      }));
    return (
      <div className={s.narrow}>
        <LayerList
          items={shown(items)}
          onReorder={(move) => setItems(moveLayers(items, move))}
          onVisibilityChange={(id, visible) =>
            setHidden((prev) => {
              const next = new Set(prev);
              if (visible) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
      </div>
    );
  },
};

/** A stack of effects, each a card whose settings fold away. Each takes the
 *  next tone of the theme's list, and the palette adds more. */
export const Cards: Story = {
  render: () => {
    const [items, setItems] = useState<LayerListItem[]>([
      { id: '1', label: 'fill', tone: 0 },
      { id: '2', label: 'stroke', tone: 1 },
      { id: '3', label: 'shadow', tone: 2, defaultCollapsed: true },
    ]);
    const [next, setNext] = useState(4);
    return (
      <div className={s.wide}>
        <LayerList
          title="Effects"
          items={items}
          addKinds={['fill', 'stroke', 'shadow']}
          onAdd={(kind) => {
            setItems([...items, { id: String(next), label: kind, tone: next - 1 }]);
            setNext(next + 1);
          }}
          onRemove={(id) => setItems(items.filter((it) => it.id !== id))}
          onReorder={(move) => setItems(moveLayers(items, move))}
          renderBody={(item) => <div className={s.note}>settings for {item.label}</div>}
        />
      </div>
    );
  },
};
