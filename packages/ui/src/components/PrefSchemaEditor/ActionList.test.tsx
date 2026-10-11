import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { TreeProps } from '../Tree';
import { ActionList } from './ActionList';
import type { EditorAction } from './editorActions';
import type { PaletteDrag } from './Palette';

const tree = vi.hoisted(() => ({ props: null as unknown }));
vi.mock('../Tree', async (original) => ({
  ...(await original<typeof import('../Tree')>()),
  Tree: (props: unknown) => {
    tree.props = props;
    return null;
  },
}));

afterEach(cleanup);

const ACTIONS: readonly EditorAction[] = [{ key: 'edit.copy', label: 'Copy' }, { key: 'edit.paste', label: 'Paste' }];

function drags() {
  const onDrag = vi.fn<(drag: PaletteDrag | null) => void>();
  const onDrop = vi.fn<(drag: PaletteDrag) => void>();
  render(<ActionList actions={ACTIONS} sought="" onDrag={onDrag} onDrop={onDrop} />);
  const props = () => tree.props as TreeProps;
  return {
    move(id: string, x: number): PaletteDrag {
      props().onDragOutside!([id], { x, y: 0 }, 'move');
      return onDrag.mock.lastCall![0]!;
    },
    drop(id: string, x: number): PaletteDrag {
      props().onDropOutside!([id], { x, y: 0 }, 'move');
      return onDrop.mock.lastCall![0];
    },
  };
}

describe('ActionList', () => {
  it('holds one node from the first move of a drag to its drop', () => {
    const { move, drop } = drags();
    const first = move('edit.copy', 10);
    expect(first.node).toMatchObject({ kind: 'action', action: 'edit.copy' });
    expect(move('edit.copy', 20).node).toBe(first.node);
    expect(drop('edit.copy', 30).node).toBe(first.node);
  });

  it('makes a new node for the next drag of the same action', () => {
    const { move, drop } = drags();
    const first = drop('edit.copy', 10).node;
    expect(move('edit.copy', 20).node).not.toBe(first);
    expect(move('edit.copy', 20).node).toEqual(first);
  });
});
