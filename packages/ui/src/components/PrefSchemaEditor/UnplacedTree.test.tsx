import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import type { TreeNode } from '../Tree';
import { PrefSchemaEditor } from './PrefSchemaEditor';
import type { PaletteDrag } from './Palette';
import { UnplacedTree } from './UnplacedTree';
import { rowKey } from './treeRows.fixture';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const text = (name: string): PrefLeaf => ({ kind: 'string', name, description: '', default: '' });
const START: PrefGroup = {
  name: '',
  children: {
    view: { name: 'View', children: { grid: text('Grid') } },
    author: text('Author'),
    owner: text('Owner'),
  },
};

function Live() {
  const [schema, setSchema] = useState(START);
  return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
}
const unplaced = () => screen.getByRole('tree', { name: 'Unplaced' });
const structure = () => screen.getByRole('tree', { name: 'Schema structure' });
const selectedIn = (tree: HTMLElement) =>
  within(tree).queryAllByRole('treeitem', { selected: true }).map(rowKey);

describe('several unplaced nodes at once', () => {
  it('adds a row to the selection on Cmd-click, and replaces it on a plain click', () => {
    renderWithIcons(<Live />);
    fireEvent.click(within(unplaced()).getByText('author'));
    fireEvent.click(within(unplaced()).getByText('owner'), { metaKey: true });
    expect(selectedIn(unplaced())).toEqual(['author', 'owner']);
    expect(screen.getByRole('region', { name: 'Attributes' })).toHaveTextContent('2 selected');
    fireEvent.click(within(unplaced()).getByText('author'));
    expect(selectedIn(unplaced())).toEqual(['author']);
  });

  it('keeps a row selected in the structure tree when one here joins it', () => {
    renderWithIcons(<Live />);
    fireEvent.click(within(structure()).getByText('view'));
    fireEvent.click(within(unplaced()).getByText('author'), { metaKey: true });
    expect(selectedIn(structure())).toEqual(['view']);
    expect(selectedIn(unplaced())).toEqual(['author']);
  });

  it('carries every selected row the schema holds in a drag out of the tree', () => {
    const rows: TreeNode[] = [{ id: 'author', label: 'Author' }, { id: 'owner', label: 'Owner' }, { id: 'extra', label: 'Extra' }];
    const dropped: PaletteDrag[] = [];
    renderWithIcons(
      <UnplacedTree loose={rows} looseAt={(path) => START.children[path] ?? text(path)} waiting={null} sought=""
        selected={['author', 'owner']} onPick={() => {}} onDrag={() => {}} onDrop={(drag) => dropped.push(drag)} />,
    );
    const tree = unplaced();
    tree.setPointerCapture = vi.fn();
    tree.releasePointerCapture = vi.fn();
    const row = within(tree).getByRole('treeitem', { name: 'Owner' }).firstElementChild as HTMLElement;
    fireEvent.pointerDown(row, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 400, clientY: 200 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 400, clientY: 200 });
    expect(dropped.map((d) => d.from)).toEqual([['author', 'owner']]);
  });
});

describe('Add alias with several prefs selected', () => {
  const SEVERAL: PrefGroup = {
    name: '',
    children: { view: { name: 'View', children: { grid: text('Grid'), snap: text('Snap'), zoom: text('Zoom') } } },
  };
  function Editor() {
    const [schema, setSchema] = useState(SEVERAL);
    return <PrefSchemaEditor schema={schema} onChange={setSchema} />;
  }
  const add = () => screen.getByRole('button', { name: 'Add alias' });
  // An alias has no name of its own, so its row reads as its key alone, before its kind.
  const keys = () => within(structure()).getAllByRole('treeitem').map(rowKey);

  it('adds an alias of each, together after the one picked last', () => {
    renderWithIcons(<Editor />);
    fireEvent.click(within(structure()).getByText('snap'));
    fireEvent.click(within(structure()).getByText('grid'), { metaKey: true });
    expect(add()).toBeEnabled();
    fireEvent.click(add());
    expect(keys()).toEqual(['view', 'grid', 'snap2', 'grid2', 'snap', 'zoom']);
    expect(selectedIn(structure())).toEqual(['snap2', 'grid2']);
  });

  it('offers none while one of them is a group, which has no alias', () => {
    renderWithIcons(<Editor />);
    fireEvent.click(within(structure()).getByText('snap'));
    fireEvent.click(within(structure()).getByText('view'), { metaKey: true });
    expect(add()).toBeDisabled();
  });
});
