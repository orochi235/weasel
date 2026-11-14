import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Disabled, ReadOnly } from '../Disabled';
import { LayerList, type LayerListItem, type LayerListProps } from './LayerList';

const ITEMS: LayerListItem[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
];

function renderList(wrap: (node: ReactNode) => ReactNode, props: Partial<LayerListProps> = {}) {
  const calls = {
    onReorder: vi.fn(), onSelectionChange: vi.fn(), onVisibilityChange: vi.fn(), onLockChange: vi.fn(),
    onRename: vi.fn(), onRemove: vi.fn(), onAdd: vi.fn(),
  };
  render(<>{wrap(<LayerList items={ITEMS} selectedIds={[]} addKinds={['fill']} {...calls} {...props} />)}</>);
  return calls;
}

const rowOf = (name: string) => screen.getByRole('row', { name });

/** A press on every control the list has, a rename by F2 and by double-click, a selection, and a keyboard move. */
function tryEverything() {
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show Beta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lock Beta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Beta' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add fill' }));
  fireEvent.click(screen.getByText('Beta'));
  act(() => rowOf('Beta').focus());
  fireEvent.keyDown(rowOf('Beta'), { key: 'ArrowUp', altKey: true });
  fireEvent.keyDown(rowOf('Beta'), { key: 'F2' });
  fireEvent.doubleClick(screen.getByText('Alpha'));
}

const EDITS = ['onReorder', 'onVisibilityChange', 'onLockChange', 'onRemove', 'onAdd'] as const;

describe('LayerList held', () => {
  it('unheld, every control, the selection, a move, and a rename go through', () => {
    const calls = renderList((n) => n);
    tryEverything();
    for (const name of [...EDITS, 'onSelectionChange'] as const) expect(calls[name], name).toHaveBeenCalled();
    expect(screen.getAllByRole('textbox', { name: /^Rename/ }).length).toBeGreaterThan(0);
  });

  it('disabled with no reason refuses everything, its controls natively disabled', () => {
    const calls = renderList((n) => n, { disabled: true });
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add fill' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Show Beta' })).toBeDisabled();
    expect(rowOf('Beta').getAttribute('tabindex')).toBe('-1');
  });

  it('disabled for a reason refuses everything and keeps its controls reachable, saying why once', () => {
    const calls = renderList((n) => n, { disabled: true, disabledReason: 'Locked' });
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    const add = screen.getByRole('button', { name: 'Add fill' });
    expect(add).not.toBeDisabled();
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(add).toHaveAccessibleDescription('Locked');
    expect(rowOf('Alpha')).toHaveAccessibleDescription('Locked');
    expect(screen.getByRole('checkbox', { name: 'Show Beta' })).not.toBeDisabled();
  });

  it('read-only still selects, and changes nothing else', () => {
    const calls = renderList((n) => <ReadOnly reason="Shared">{n}</ReadOnly>);
    tryEverything();
    expect(calls.onSelectionChange).toHaveBeenCalled();
    for (const name of EDITS) expect(calls[name], name).not.toHaveBeenCalled();
    expect(calls.onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Show Beta' }).getAttribute('aria-readonly')).toBe('true');
    expect(screen.getByRole('button', { name: 'Remove Beta' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('nested scopes: the nearest reason wins and disabled={false} adds nothing', () => {
    const calls = renderList((n) => <Disabled reason="Locked"><Disabled reason="Busy">{n}</Disabled></Disabled>, { disabled: false });
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    expect(rowOf('Alpha')).toHaveAccessibleDescription('Busy');
  });
});
