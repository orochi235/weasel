import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SceneCanvas, useScene } from '@weasel-js/core';
import { ItemList } from '@weasel-js/ui/components/ItemList';
import type { HudListRow, ListWidget as HudListWidget } from '@weasel-js/hud';
import { useHud, useHudContribution } from '@weasel-js/hud/react';
import s from '../widgets.stories.module.css';

interface ListWidgetArgs {
  selection: 'none' | 'single' | 'multi';
  rowCount: number;
  width: number;
}

const LABELS = ['Background', 'Sketch', 'Ink', 'Highlights', 'Shadows', 'Notes', 'Grid', 'Guides'];

/** A HUD list beside the DOM `ItemList` it shares one measure with, both on the same rows. Tab into the canvas,
 *  move with the arrows or by typing, pick with Enter or a press. */
function ListWidget({ selection, rowCount, width }: ListWidgetArgs) {
  const hud = useHud();
  const entry = useHudContribution(hud, { font: 'sans-serif' });
  const scene = useScene<{ id: string }>({ items: [] });
  const [current, setCurrent] = useState('b');
  const rows = LABELS.slice(0, rowCount).map((label, i): HudListRow => {
    const id = String.fromCharCode(97 + i);
    return { id, label, selected: id === current, ...(i === 0 ? { swatch: '#3b82f6' } : {}) };
  });
  const select = selection === 'none' ? undefined : selection;

  const list = useRef<HudListWidget | null>(null);
  useEffect(() => {
    const w = hud.list({
      id: 'layers', x: 16, y: 16, w: width, rows, selection: select, accessibleName: 'Layers', onActivate: setCurrent,
    });
    list.current = w;
    return () => { w.dispose(); list.current = null; };
    // Created once per shape; the rows follow below without costing the widget its focus.
  }, [hud, width, select]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { list.current?.setRows(rows); });

  return (
    <div className={s.pair}>
      <SceneCanvas scene={scene} width={width + 32} height={320} ambient={[entry]} aria-label="HUD list" />
      <div className={s.dom} style={{ width }}>
        <ItemList
          rows={rows.map(({ swatch, ...r }) => (swatch ? { ...r, leading: <span className={s.swatch} /> } : r))}
          selection={select}
          onActivate={setCurrent}
          containerProps={{ 'aria-label': 'Layers (DOM)' }}
        />
      </div>
    </div>
  );
}

const meta: Meta<typeof ListWidget> = {
  title: 'hud/ListWidget',
  component: ListWidget,
  args: { selection: 'single', rowCount: 5, width: 200 },
  argTypes: {
    selection: { control: 'inline-radio', options: ['none', 'single', 'multi'] },
    rowCount: { control: { type: 'range', min: 0, max: LABELS.length, step: 1 } },
    width: { control: { type: 'range', min: 120, max: 320, step: 10 } },
  },
};
export default meta;
type Story = StoryObj<typeof ListWidget>;

export const Selectable: Story = {};
export const Plain: Story = { args: { selection: 'none' } };
export const Empty: Story = { args: { rowCount: 0 } };
