import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { TreeNode, TreeProps } from '../Tree';
import { actionCatalog } from './actionCatalog';
import { ActionList } from './ActionList';
import type { EditorAction } from './editorActions';
import type { PaletteDrag } from './Palette';
import type { ActionCatalog } from './useActionCatalog';

const tree = vi.hoisted(() => ({ props: null as unknown }));
vi.mock('../Tree', async (original) => ({
  ...(await original<typeof import('../Tree')>()),
  Tree: (props: unknown) => {
    tree.props = props;
    return null;
  },
}));

afterEach(cleanup);

const ACTIONS: readonly EditorAction[] = [{ key: 'edit.copy', label: 'Copy', tags: ['clipboard'] }, { key: 'edit.paste', label: 'Paste' }];
const COPY = 'edit/editCopy';

function listed(over: Partial<ActionCatalog> = {}, sought = '') {
  const onDrag = vi.fn<(drag: PaletteDrag | null) => void>();
  const onDrop = vi.fn<(drag: PaletteDrag) => void>();
  const catalog: ActionCatalog = {
    actions: ACTIONS, root: actionCatalog(ACTIONS), editable: true, selected: [],
    pick: vi.fn(), clear: vi.fn(), recorded: () => [], restore: vi.fn(), commit: vi.fn(), move: vi.fn(), addGroup: vi.fn(), remove: vi.fn(), ...over,
  };
  render(<ActionList catalog={catalog} sought={sought} onDrag={onDrag} onDrop={onDrop} />);
  const props = () => tree.props as TreeProps;
  return {
    catalog,
    props,
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

const ids = (nodes: readonly TreeNode[]): unknown[] => nodes.map((n) => (n.children ? [n.id, ids(n.children)] : n.id));

describe('ActionList', () => {
  it('lists the catalog’s groups and the prefs under them, by tree path', () => {
    expect(ids(listed().props().nodes)).toEqual([['edit', [COPY, 'edit/editPaste']]]);
  });

  it('finds a pref by its registered action’s tags', () => {
    expect(ids(listed({}, 'clip').props().nodes)).toEqual([['edit', [COPY]]]);
  });

  it('holds one node from the first move of a drag to its drop: a copy of the catalog’s pref', () => {
    const { move, drop, catalog } = listed();
    const first = move(COPY, 10);
    expect(first.node).toMatchObject({ kind: 'action', action: 'edit.copy' });
    expect(first.node).not.toBe((catalog.root.children.edit as typeof catalog.root).children.editCopy);
    expect(first.item.key).toBe('editCopy');
    expect(move(COPY, 20).node).toBe(first.node);
    expect(drop(COPY, 30).node).toBe(first.node);
  });

  it('makes a new node for the next drag of the same action', () => {
    const { move, drop } = listed();
    const first = drop(COPY, 10).node;
    expect(move(COPY, 20).node).not.toBe(first);
    expect(move(COPY, 20).node).toEqual(first);
  });

  it('drags no group out', () => {
    const { props } = listed();
    expect(props().onDragOutside!(['edit'], { x: 0, y: 0 }, 'move')).toBe(false);
  });

  it('hands a move within the tree to the catalog, as a place in the schema', () => {
    const { props, catalog } = listed();
    expect(props().canDrop!([COPY], { parentId: null, index: 0 }, 'move')).toBe(true);
    props().onMove!([COPY], { parentId: null, index: 0 });
    expect(catalog.move).toHaveBeenCalledWith([COPY], { parentPath: null, index: 0 });
  });

  it('takes no drop where the catalog takes no edit, or from outside', () => {
    expect(listed({ editable: false }).props().canDrop!([COPY], { parentId: null, index: 0 }, 'move')).toBe(false);
    cleanup();
    expect(listed().props().canDrop!([], { parentId: null, index: 0 }, 'move')).toBe(false);
  });

  it('reports the rows picked, and shows the ones the catalog holds as selected', () => {
    const { props, catalog } = listed({ selected: [COPY] });
    expect([...props().selectedIds!]).toEqual([COPY]);
    props().onSelectionChange!(new Set(['edit']));
    expect(catalog.pick).toHaveBeenCalledWith(new Set(['edit']));
  });
});
