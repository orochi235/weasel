import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { useState, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { LayerList, type LayerListItem } from './LayerList';
import { row } from './layerList.fixture';

describe('LayerList focus', () => {
  function Removable(props: { initial: LayerListItem[] }): ReactElement {
    const [items, setItems] = useState(props.initial);
    return <LayerList items={items} onRemove={(id) => setItems((list) => list.filter((it) => it.id !== id))} />;
  }
  const ABC: LayerListItem[] = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }];

  it('moves focus to the row that takes a removed row\'s place', () => {
    renderWithIcons(<Removable initial={ABC} />);
    const remove = screen.getByRole('button', { name: 'Remove Beta' });
    act(() => remove.focus());
    fireEvent.click(remove);
    expect(document.activeElement).toBe(row('Gamma'));
  });

  it('moves focus to the last row when the last one is removed', () => {
    renderWithIcons(<Removable initial={ABC} />);
    const remove = screen.getByRole('button', { name: 'Remove Gamma' });
    act(() => remove.focus());
    fireEvent.click(remove);
    expect(document.activeElement).toBe(row('Beta'));
  });

  it('keeps focus among the siblings when the last child of a group is removed', () => {
    const drop = (list: LayerListItem[], id: string): LayerListItem[] =>
      list.filter((it) => it.id !== id).map((it) => (it.children ? { ...it, children: drop(it.children, id) } : it));
    function Nested(): ReactElement {
      const [items, setItems] = useState<LayerListItem[]>([
        { id: 'g', label: 'Group', children: [{ id: 'g1', label: 'One' }, { id: 'g2', label: 'Two' }] },
        { id: 'z', label: 'Zed' },
      ]);
      return <LayerList items={items} onRemove={(id) => setItems((list) => drop(list, id))} />;
    }
    renderWithIcons(<Nested />);
    const remove = screen.getByRole('button', { name: 'Remove Two' });
    act(() => remove.focus());
    fireEvent.click(remove);
    expect(document.activeElement).toBe(row('One'));
  });

  it('leaves focus alone when a row is removed by a press that never focused it', () => {
    renderWithIcons(<Removable initial={ABC} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Beta' }));
    expect(document.activeElement).toBe(document.body);
  });
});
