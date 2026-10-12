import '@weasel-js/theme/tokens.css';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useEffect, useRef, useState } from 'react';
import { Tree, type TreeDropHandle, type TreeDropTarget, type TreeNode } from './index';

// A drag begun outside a tree and let go on it is hit-tested against real row boxes.

afterEach(cleanup);

const NODES: TreeNode[] = [
  { id: 'g', label: 'Group', children: [{ id: 'x', label: 'Ex' }, { id: 'y', label: 'Why' }] },
  { id: 'z', label: 'Zed' },
];

interface Seen {
  dropped: (TreeDropTarget | null)[];
  reported: TreeDropTarget | null;
}

/** A tree something outside it is dragged over: the pointer anywhere in the document is the drag. */
function Outside({ seen, refuse }: { seen: Seen; refuse?: boolean }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const drop = useRef<TreeDropHandle>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => setAt({ x: e.clientX, y: e.clientY });
    const up = (e: PointerEvent) => {
      seen.dropped.push(drop.current?.targetAt({ x: e.clientX, y: e.clientY }) ?? null);
      setAt(null);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
  }, [seen]);
  return (
    <Tree aria-label="T" nodes={NODES} defaultExpandedIds={['g']} externalDrag={at} dropRef={drop}
      canDrop={() => !refuse} onExternalTarget={(t) => { seen.reported = t; }} />
  );
}

const rowOf = (name: string) => screen.getByRole('treeitem', { name }).firstElementChild as HTMLElement;
const middleOf = (name: string) => {
  const r = rowOf(name).getBoundingClientRect();
  return { clientX: r.left + 30, clientY: r.top + r.height / 2 };
};
const send = (type: 'pointermove' | 'pointerup', at: { clientX: number; clientY: number }) =>
  document.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, ...at }));
const fresh = (): Seen => ({ dropped: [], reported: null });

test('let go in the same task as the last move, an outside drag lands where the pointer is', () => {
  const seen = fresh();
  render(<Outside seen={seen} />);
  // One task, so React has drawn nothing of the move when the release comes.
  send('pointermove', middleOf('Group'));
  send('pointerup', middleOf('Group'));
  expect(seen.dropped).toEqual([{ parentId: 'g', index: 2 }]);
});

test('let go a row on from the one the tree marked, an outside drag lands on the row under the pointer', () => {
  const seen = fresh();
  render(<Outside seen={seen} />);
  act(() => { send('pointermove', middleOf('Group')); });
  expect(screen.getByRole('treeitem', { name: 'Group' })).toHaveAttribute('data-drop', 'into');
  const zed = rowOf('Zed').getBoundingClientRect();
  const low = { clientX: zed.left + 30, clientY: zed.bottom - 2 };
  send('pointermove', low);
  send('pointerup', low);
  expect(seen.dropped).toEqual([{ parentId: null, index: 2 }]);
});

test('what the tree marks and reports for a point is what a drop at that point is told', () => {
  const seen = fresh();
  render(<Outside seen={seen} />);
  const ex = rowOf('Ex').getBoundingClientRect();
  const high = { clientX: ex.left + 30, clientY: ex.top + 2 };
  act(() => { send('pointermove', high); });
  expect(screen.getByRole('treeitem', { name: 'Ex' })).toHaveAttribute('data-drop', 'before');
  expect(seen.reported).toEqual({ parentId: 'g', index: 0 });
  send('pointerup', high);
  expect(seen.dropped).toEqual([seen.reported]);
});

test('off the tree, or where canDrop refuses, a drop has no target', () => {
  const seen = fresh();
  const { rerender } = render(<Outside seen={seen} />);
  const box = screen.getByRole('tree').getBoundingClientRect();
  send('pointerup', { clientX: box.right + 40, clientY: box.bottom + 40 });
  rerender(<Outside seen={seen} refuse />);
  send('pointerup', middleOf('Group'));
  expect(seen.dropped).toEqual([null, null]);
});
