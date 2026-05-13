import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { LayerList } from './LayerList';

const ITEMS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

describe('LayerList', () => {
  it('renders one row per item with its label', () => {
    render(
      <LayerList items={ITEMS} selectedIds={[]} onSelect={() => {}} onReorder={() => {}} />
    );
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();
  });

  it('click on row fires onSelect with [id]', () => {
    const onSelect = vi.fn();
    render(<LayerList items={ITEMS} selectedIds={[]} onSelect={onSelect} onReorder={() => {}} />);
    fireEvent.pointerDown(screen.getByText('Beta'), { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(screen.getByText('Beta'), { clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
    expect(onSelect).toHaveBeenLastCalledWith(['b']);
  });

  it('shift-click on unselected row adds it to selection', () => {
    const onSelect = vi.fn();
    render(<LayerList items={ITEMS} selectedIds={['a']} onSelect={onSelect} onReorder={() => {}} />);
    fireEvent.pointerDown(screen.getByText('Gamma'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(screen.getByText('Gamma'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    expect(onSelect).toHaveBeenLastCalledWith(['a', 'c']);
  });

  it('shift-click on already-selected row removes it', () => {
    const onSelect = vi.fn();
    render(<LayerList items={ITEMS} selectedIds={['a', 'c']} onSelect={onSelect} onReorder={() => {}} />);
    fireEvent.pointerDown(screen.getByText('Alpha'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(screen.getByText('Alpha'), { clientX: 0, clientY: 0, shiftKey: true, pointerId: 1, isPrimary: true });
    expect(onSelect).toHaveBeenLastCalledWith(['c']);
  });

  it('empty items prop renders the empty-state node', () => {
    render(
      <LayerList items={[]} selectedIds={[]} onSelect={() => {}} onReorder={() => {}} empty={<span>No layers</span>} />
    );
    expect(screen.getByText('No layers')).toBeTruthy();
  });

  it('selected row has the selected class', () => {
    const { container } = render(
      <LayerList items={ITEMS} selectedIds={['b']} onSelect={() => {}} onReorder={() => {}} />
    );
    const rows = container.querySelectorAll('[data-row-index]');
    expect(rows[1].className).toMatch(/selected/);
  });

  it('locked rows emit data-locked="true"', () => {
    const items = [
      { id: 'a', label: 'Alpha' },
      { id: 'page', label: 'Page', locked: true },
    ];
    const { container } = render(
      <LayerList items={items} selectedIds={[]} onSelect={() => {}} onReorder={() => {}} />
    );
    const rows = container.querySelectorAll('[data-row-index]');
    expect(rows[0].getAttribute('data-locked')).toBeNull();
    expect(rows[1].getAttribute('data-locked')).toBe('true');
  });
});
