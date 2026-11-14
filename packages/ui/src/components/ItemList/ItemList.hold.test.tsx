import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Checkbox } from '../Checkbox';
import { Disabled, ReadOnly } from '../Disabled';
import { ItemList, type ItemListProps } from './ItemList';

function renderList(wrap: (node: ReactNode) => ReactNode, props: Partial<ItemListProps> = {}) {
  const calls = { onActivate: vi.fn(), onNudge: vi.fn(), onSelectRange: vi.fn(), onPointerDown: vi.fn() };
  const rows = ['Alpha', 'Beta', 'Gamma'].map((label) => ({
    id: label.toLowerCase(), label, rowProps: { onPointerDown: calls.onPointerDown },
  }));
  render(
    <>
      {wrap(
        <ItemList
          rows={rows} selection="multi" containerProps={{ 'aria-label': 'Items' }}
          onActivate={calls.onActivate} onNudge={calls.onNudge} onSelectRange={calls.onSelectRange}
          {...props}
        />,
      )}
    </>,
  );
  return calls;
}

const option = (name: string) => screen.getByRole('option', { name });

/** A press, a range, a nudge, and the press a drag starts from. */
function tryEverything() {
  fireEvent.pointerDown(option('Beta'), { button: 0 });
  fireEvent.click(option('Beta'));
  act(() => option('Beta').focus());
  fireEvent.keyDown(option('Beta'), { key: 'ArrowDown', shiftKey: true });
  fireEvent.keyDown(option('Gamma'), { key: 'ArrowUp', altKey: true });
}

describe('ItemList held', () => {
  it('unheld, every press, range, nudge, and drag start goes through', () => {
    const calls = renderList((n) => n);
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).toHaveBeenCalled();
  });

  it('disabled with no reason refuses everything and leaves the tab order', () => {
    const calls = renderList((n) => n, { disabled: true });
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    for (const o of screen.getAllByRole('option')) {
      expect(o.getAttribute('tabindex')).toBe('-1');
      expect(o.getAttribute('aria-disabled')).toBe('true');
    }
  });

  it('disabled for a reason refuses everything, keeps a tab stop, and says why', () => {
    const calls = renderList((n) => n, { disabled: true, disabledReason: 'Busy' });
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    expect(screen.getAllByRole('option').filter((o) => o.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(option('Alpha')).toHaveAccessibleDescription('Busy');
    expect(screen.getByRole('listbox').getAttribute('data-held')).toBe('disabled');
  });

  it('read-only still activates and extends, and nudges and drags nothing', () => {
    const calls = renderList((n) => <ReadOnly reason="Shared">{n}</ReadOnly>);
    tryEverything();
    expect(calls.onActivate).toHaveBeenCalled();
    expect(calls.onSelectRange).toHaveBeenCalled();
    expect(calls.onNudge).not.toHaveBeenCalled();
    expect(calls.onPointerDown).not.toHaveBeenCalled();
    expect(option('Alpha')).toHaveAccessibleDescription('Shared');
  });

  it('read-only, a grid is aria-readonly and holds its rows\' controls', () => {
    const onChange = vi.fn();
    render(
      <ItemList
        readOnly
        rows={[{ id: 'a', label: 'Alpha', trailing: <Checkbox aria-label="Show Alpha" onChange={onChange} /> }]}
        containerProps={{ 'aria-label': 'Items' }}
      />,
    );
    expect(screen.getByRole('grid').getAttribute('aria-readonly')).toBe('true');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show Alpha' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('nested scopes: the nearest reason wins, disabled={false} adds nothing, and disabled beats read-only', () => {
    const calls = renderList(
      (n) => <ReadOnly><Disabled reason="Locked"><Disabled reason="Busy">{n}</Disabled></Disabled></ReadOnly>,
      { disabled: false },
    );
    tryEverything();
    expect(calls.onActivate).not.toHaveBeenCalled();
    expect(option('Alpha')).toHaveAccessibleDescription('Busy');
  });
});
