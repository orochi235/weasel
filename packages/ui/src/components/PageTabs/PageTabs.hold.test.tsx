import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Disabled, ReadOnly } from '../Disabled';
import { PageTabs, type PageTabsProps } from './PageTabs';

const PAGES = [{ id: 'a', name: 'Cover' }, { id: 'b' }, { id: 'c' }];

function setup(wrap: (node: ReactNode) => ReactNode, props: Partial<PageTabsProps<{ id: string; name?: string }>> = {}) {
  const calls = { onSelect: vi.fn(), onRename: vi.fn(), onMove: vi.fn(), onAdd: vi.fn() };
  render(<>{wrap(<PageTabs aria-label="Pages" pages={PAGES} current="a" {...calls} {...props} />)}</>);
  const list = screen.getByRole('tablist');
  list.setPointerCapture = vi.fn();
  list.releasePointerCapture = vi.fn();
  return calls;
}

const tab = (name: string) => screen.getByRole('tab', { name });
const press = (el: HTMLElement) => {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 5, clientY: 5 });
  fireEvent.pointerUp(document, { pointerId: 1, button: 0, clientX: 5, clientY: 5 });
};
const add = () => screen.getByRole('button', { name: 'Add page' });

/** A press on a tab, a double press to rename it, a move by key, and the + button. */
function tryEverything() {
  press(tab('Page 2'));
  press(tab('Page 2'));
  fireEvent.keyDown(tab('Page 2'), { key: 'ArrowRight', altKey: true });
  fireEvent.click(add());
}

describe('PageTabs held', () => {
  it('unheld, goes to a page, renames, moves, and adds', () => {
    const calls = setup((n) => n);
    tryEverything();
    expect(calls.onSelect).toHaveBeenCalledWith('b');
    expect(screen.getByLabelText('Page name')).toBeInTheDocument();
    expect(calls.onAdd).toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText('Page name'), { key: 'Escape' });
    fireEvent.keyDown(tab('Page 2'), { key: 'ArrowRight', altKey: true });
    expect(calls.onMove).toHaveBeenCalled();
  });

  it('disabled with no reason still goes to a page, renames, moves, and adds nothing, and its + leaves the tab order', () => {
    const calls = setup((n) => n, { disabled: true });
    tryEverything();
    expect(calls.onSelect).toHaveBeenCalledWith('b');
    expect(screen.queryByLabelText('Page name')).toBeNull();
    expect(calls.onMove).not.toHaveBeenCalled();
    expect(calls.onAdd).not.toHaveBeenCalled();
    expect(add()).toBeDisabled();
  });

  it('disabled for a reason keeps its + reachable and says why', () => {
    const calls = setup((n) => n, { disabled: true, disabledReason: 'Locked' });
    tryEverything();
    expect(calls.onAdd).not.toHaveBeenCalled();
    expect(add()).not.toBeDisabled();
    expect(add().getAttribute('aria-disabled')).toBe('true');
    expect(add()).toHaveAccessibleDescription('Locked');
    expect(screen.getByRole('tablist').closest('[data-held]')?.getAttribute('data-held')).toBe('disabled');
  });

  it('read-only goes to a page, and renames, moves, and adds nothing', () => {
    const calls = setup((n) => <ReadOnly reason="Shared">{n}</ReadOnly>);
    tryEverything();
    expect(calls.onSelect).toHaveBeenCalledWith('b');
    expect(screen.queryByLabelText('Page name')).toBeNull();
    expect(calls.onMove).not.toHaveBeenCalled();
    expect(calls.onAdd).not.toHaveBeenCalled();
    expect(add()).toHaveAccessibleDescription('Shared');
  });

  it('nested scopes: the nearest reason wins, and disabled={false} adds nothing', () => {
    const calls = setup((n) => <Disabled reason="Locked"><Disabled reason="Busy">{n}</Disabled></Disabled>, { disabled: false });
    tryEverything();
    expect(calls.onAdd).not.toHaveBeenCalled();
    expect(add()).toHaveAccessibleDescription('Busy');
  });
});
