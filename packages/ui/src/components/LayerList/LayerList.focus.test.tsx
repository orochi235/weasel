import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { useState, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { LayerList, type LayerListItem } from './LayerList';

const row = (label: string) => screen.getByText(label).closest('[role="row"]') as HTMLElement;

describe('LayerList focus', () => {
  it('stays put on ArrowLeft when the parent is a card, which the arrows do not walk', () => {
    const items: LayerListItem[] = [
      { id: 'top', label: 'Top' },
      { id: 'card', label: 'Card', children: [{ id: 'c1', label: 'One' }, { id: 'c2', label: 'Two' }] },
    ];
    renderWithIcons(<LayerList items={items} renderBody={(item) => (item.id === 'card' ? <div>body</div> : null)} />);
    act(() => row('One').focus());
    fireEvent.keyDown(row('One'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(row('One'));
  });

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

describe('LayerList card handle', () => {
  const body = (): ReactElement => <div>body</div>;

  it('shows a badge without offering a drag when the list cannot be reordered', () => {
    renderWithIcons(<LayerList items={[{ id: 'a', label: 'Alpha', badge: '1' }]} renderBody={body} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Drag to reorder/ })).toBeNull();
  });

  it('keeps the handle a button when the list can be reordered', () => {
    renderWithIcons(<LayerList items={[{ id: 'a', label: 'Alpha', badge: '1' }]} renderBody={body} onReorder={() => {}} />);
    expect(screen.getByRole('button', { name: 'Drag to reorder Alpha' })).toHaveTextContent('1');
  });
});
