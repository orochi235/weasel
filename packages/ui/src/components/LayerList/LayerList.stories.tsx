import type { Meta, StoryObj } from '@weasel-js/forge';
import { type CSSProperties, useState } from 'react';
import { LayerList, type LayerListItem, moveLayers } from '@weasel-js/ui/components/LayerList';
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

/** A document's objects: click to select, Cmd/Ctrl-click to add, shift-click for a range, drag a selected
 *  row to move the whole selection. The fixed Background row selects alone
 *  and no drop lands below it. */
export const Selectable: Story = {
  render: (args) => {
    const [items, setItems] = useState<LayerListItem[]>([
      { id: 'title', label: 'Title', leading: swatch('#222') },
      { id: 'sun', label: 'Sun', leading: swatch('#f5b041') },
      { id: 'hill', label: 'Hill', leading: swatch('#58d68d') },
      { id: 'sky', label: 'Sky', leading: swatch('#5dade2') },
      { id: 'bg', label: 'Background', leading: swatch('#fff'), fixed: true },
    ]);
    const [selected, setSelected] = useState<string[]>(['sun']);
    return (
      <div className={s.narrow}>
        <LayerList
          {...args}
          items={items}
          selectedIds={selected}
          onSelectionChange={setSelected}
          onReorder={(move) => setItems(moveLayers(items, move))}
        />
      </div>
    );
  },
};

/** Layers that hold layers, each with a visibility checkbox. A drag reorders a
 *  row among its siblings or drops it into another layer; Right steps from a row to its checkbox. */
export const Nested: Story = {
  render: (args) => {
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
      { id: 'report', label: 'Report', fixed: true },
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
          {...args}
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
