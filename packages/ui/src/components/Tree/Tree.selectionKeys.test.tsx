import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Tree, type TreeNode } from './Tree';

afterEach(() => { cleanup(); });

const NODES: readonly TreeNode[] = [
  { id: 'fruit', label: 'Fruit', children: [{ id: 'apple', label: 'Apple' }, { id: 'banana', label: 'Banana' }] },
  { id: 'water', label: 'Water' },
];

const item = (name: string) => screen.getByRole('treeitem', { name });
const selected = () => screen.getAllByRole('treeitem').filter((el) => el.getAttribute('aria-selected') === 'true').map((el) => el.firstElementChild?.textContent);
const key = (k: string, opts: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(document.activeElement!, { key: k, ...opts });

function Picked({ follows }: { follows?: boolean }) {
  const [ids, setIds] = useState<Set<string>>(new Set(['apple']));
  return <Tree aria-label="Food" nodes={NODES} defaultExpandedIds={['fruit']} selectionMode="multiple"
    selectionFollowsFocus={follows} selectedIds={ids} onSelectionChange={setIds} />;
}

describe('Tree — the selection and the keys that move focus', () => {
  it('moves focus alone by default', () => {
    render(<Picked />);
    act(() => item('Apple').focus());
    key('ArrowDown');
    expect(document.activeElement).toBe(item('Banana'));
    expect(selected()).toEqual(['Apple']);
  });

  it('brings the selection along under selectionFollowsFocus', () => {
    render(<Picked follows />);
    act(() => item('Apple').focus());
    key('ArrowDown');
    expect(selected()).toEqual(['Banana']);
    key('End');
    expect(selected()).toEqual(['Water']);
    key('Home');
    expect(selected()).toEqual(['Fruit']);
  });

  it('extends a multiple selection with Shift, whether or not the selection follows focus', () => {
    for (const follows of [false, true]) {
      const { unmount } = render(<Picked follows={follows} />);
      fireEvent.click(screen.getByText('Apple'));
      // A click focuses the row in a browser; jsdom moves no focus.
      act(() => item('Apple').focus());
      key('ArrowDown', { shiftKey: true });
      key('ArrowDown', { shiftKey: true });
      expect(selected()).toEqual(['Apple', 'Banana', 'Water']);
      key('ArrowUp', { shiftKey: true });
      expect(selected()).toEqual(['Apple', 'Banana']);
      unmount();
    }
  });
});
