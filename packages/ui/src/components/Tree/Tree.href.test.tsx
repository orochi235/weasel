import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Tree, type TreeNode } from './Tree';

afterEach(cleanup);

const NODES: readonly TreeNode[] = [
  { id: 'docs', label: 'Docs', href: '#/docs', children: [{ id: 'intro', label: 'Intro', href: '#/intro' }] },
  { id: 'plain', label: 'Plain' },
];

const item = (name: string) => screen.getByRole('treeitem', { name });
const link = (name: string) => within(item(name)).getAllByRole('link')[0]!;

/** Clicks `el` and reports whether the tree left the event's default — the browser's navigation — alone. */
function clickLeaves(el: Element, init: MouseEventInit = {}): boolean {
  let left = false;
  const record = (event: Event) => {
    left = !event.defaultPrevented;
    // jsdom would navigate this page on an unprevented click on a link; the test only needs to know it was left.
    event.preventDefault();
  };
  document.addEventListener('click', record);
  fireEvent.click(el, init);
  document.removeEventListener('click', record);
  return left;
}

describe('Tree rows with an href', () => {
  it('renders the row as a link out of the tab order, under a treeitem that keeps its name', () => {
    render(<Tree aria-label="Pages" nodes={NODES} />);
    const docs = link('Docs');
    expect(docs).toHaveAttribute('href', '#/docs');
    expect(docs).toHaveAttribute('tabindex', '-1');
    expect(item('Docs')).toHaveAttribute('tabindex', '0');
    expect(within(item('Plain')).queryByRole('link')).toBeNull();
  });

  it('activates and focuses the row on a plain click, keeping the browser from following the link', () => {
    const onAction = vi.fn();
    render(<Tree aria-label="Pages" nodes={NODES} defaultExpandedIds={['docs']} onAction={onAction} selectionMode="single" />);
    expect(clickLeaves(link('Intro'))).toBe(false);
    expect(onAction).toHaveBeenCalledWith('intro', expect.objectContaining({ shiftKey: false }));
    expect(item('Intro')).toHaveAttribute('aria-selected', 'true');
    expect(item('Intro')).toHaveFocus();
  });

  it('activates on a Shift-click too', () => {
    const onAction = vi.fn();
    render(<Tree aria-label="Pages" nodes={NODES} defaultExpandedIds={['docs']} onAction={onAction} />);
    expect(clickLeaves(link('Intro'), { shiftKey: true })).toBe(false);
    expect(onAction).toHaveBeenCalledWith('intro', expect.objectContaining({ shiftKey: true }));
  });

  it.each([{ metaKey: true }, { ctrlKey: true }, { altKey: true }])('leaves a click with %o to the browser', (mods) => {
    const onAction = vi.fn();
    render(<Tree aria-label="Pages" nodes={NODES} defaultExpandedIds={['docs']} onAction={onAction} selectionMode="single" />);
    expect(clickLeaves(link('Intro'), mods)).toBe(true);
    expect(onAction).not.toHaveBeenCalled();
    expect(item('Intro')).toHaveAttribute('aria-selected', 'false');
  });

  it('folds a linked branch from its twisty without following the link or activating it', () => {
    const onAction = vi.fn();
    render(<Tree aria-label="Pages" nodes={NODES} onAction={onAction} />);
    const twisty = item('Docs').querySelector('[data-tree-twisty]')!;
    expect(clickLeaves(twisty)).toBe(false);
    expect(item('Docs')).toHaveAttribute('aria-expanded', 'true');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('activates a linked row from the keyboard as any other row', () => {
    const onAction = vi.fn();
    render(<Tree aria-label="Pages" nodes={NODES} onAction={onAction} />);
    fireEvent.keyDown(item('Plain'), { key: 'Home' });
    fireEvent.keyDown(item('Docs'), { key: 'Enter' });
    expect(onAction).toHaveBeenCalledWith('docs', expect.anything());
  });
});

describe('Tree current rows', () => {
  it('marks a current row with aria-current, and no other', () => {
    render(<Tree aria-label="Pages" nodes={[{ id: 'a', label: 'A', current: true }, { id: 'b', label: 'B' }]} />);
    expect(item('A')).toHaveAttribute('aria-current', 'true');
    expect(item('B')).not.toHaveAttribute('aria-current');
  });
});
