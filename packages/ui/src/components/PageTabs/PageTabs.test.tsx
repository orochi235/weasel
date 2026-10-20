import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PageTabs, type PageTabsProps } from './PageTabs';

const PAGES = [{ id: 'a', name: 'Cover' }, { id: 'b' }, { id: 'c' }];

function setup(props: Partial<PageTabsProps<{ id: string; name?: string }>> = {}) {
  const handlers = {
    onSelect: vi.fn(), onRename: vi.fn(), onMove: vi.fn(), onAdd: vi.fn(), onTabContextMenu: vi.fn(),
  };
  const view = render(<PageTabs aria-label="Pages" pages={PAGES} current="a" {...handlers} {...props} />);
  const list = screen.getByRole('tablist');
  list.setPointerCapture = vi.fn();
  list.releasePointerCapture = vi.fn();
  return { ...handlers, view };
}

const tab = (name: string) => screen.getByRole('tab', { name });
const press = (el: HTMLElement) => {
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 5, clientY: 5 });
  fireEvent.pointerUp(document, { pointerId: 1, button: 0, clientX: 5, clientY: 5 });
};

describe('PageTabs', () => {
  it('labels each page by its name, or its place when it has none, and lights the current one', () => {
    setup({ current: 'b' });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Cover', 'Page 2', 'Page 3']);
    expect(tab('Page 2').getAttribute('aria-selected')).toBe('true');
    expect(tab('Cover').getAttribute('aria-selected')).toBe('false');
  });

  it('lights no tab when no page is current, without selecting one itself', () => {
    const { onSelect } = setup({ current: null });
    expect(screen.getAllByRole('tab').every((t) => t.getAttribute('aria-selected') === 'false')).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('reports a press on a tab, the lit one included, once per press', () => {
    const { onSelect } = setup();
    press(tab('Cover'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith('a');
  });

  it('renames on a double press: Enter commits and Escape cancels', () => {
    const { onRename } = setup();
    press(tab('Page 2'));
    press(tab('Page 2'));
    const field = screen.getByLabelText('Page name');
    fireEvent.change(field, { target: { value: 'Body' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('b', 'Body');
    expect(screen.queryByLabelText('Page name')).toBeNull();

    press(tab('Page 3'));
    press(tab('Page 3'));
    fireEvent.keyDown(screen.getByLabelText('Page name'), { key: 'Escape' });
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it('adds a page from the + button', () => {
    const { onAdd } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
    expect(onAdd).toHaveBeenCalled();
  });

  it('reports a right-click on a tab with its page id', () => {
    const { onTabContextMenu } = setup();
    fireEvent.contextMenu(tab('Page 3'));
    expect(onTabContextMenu).toHaveBeenCalledWith('c', expect.anything());
  });

  it('reports a drag as the page\'s place in the new order', () => {
    const { onMove } = setup();
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((el, i) => {
      Object.defineProperty(el, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ x: i * 80, y: 0, top: 0, left: i * 80, right: (i + 1) * 80, bottom: 30, width: 80, height: 30 } as DOMRect),
      });
    });
    fireEvent.pointerDown(tabs[0]!, { pointerId: 1, button: 0, clientX: 40, clientY: 15 });
    act(() => {
      fireEvent.pointerMove(document, { pointerId: 1, clientX: 120, clientY: 15 });
      fireEvent.pointerMove(document, { pointerId: 1, clientX: 210, clientY: 15 });
    });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 210, clientY: 15 });
    expect(onMove).toHaveBeenCalledWith('a', 2);
  });

  it('moves a tab one place with Alt+Left and Alt+Right', () => {
    const { onMove } = setup();
    fireEvent.keyDown(tab('Page 2'), { key: 'ArrowRight', altKey: true });
    expect(onMove).toHaveBeenLastCalledWith('b', 2);
    fireEvent.keyDown(tab('Page 2'), { key: 'ArrowLeft', altKey: true });
    expect(onMove).toHaveBeenLastCalledWith('b', 0);
    fireEvent.keyDown(tab('Cover'), { key: 'ArrowLeft', altKey: true });
    expect(onMove).toHaveBeenCalledTimes(2);
  });
});
