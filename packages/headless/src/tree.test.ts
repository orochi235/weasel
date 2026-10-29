import { describe, expect, it } from 'vitest';
import { rowKey } from './list';
import { treeKey, type TreeShape } from './tree';

type Row = { id: string; parent?: string; branch?: boolean; open?: boolean; locked?: boolean };
// a (open) > b, c (closed branch) ; d (open, empty)
const rows: Row[] = [
  { id: 'a', branch: true, open: true },
  { id: 'b', parent: 'a' },
  { id: 'c', parent: 'a', branch: true },
  { id: 'd', branch: true, open: true },
];
const shape: TreeShape<Row> = {
  isBranch: (r) => !!r.branch,
  isOpen: (r) => !!r.open,
  isChildOf: (child, parent) => child.parent === parent.id,
  canToggle: (r) => !r.locked,
};

describe('treeKey', () => {
  it('opens a closed branch with Right, then steps to its first child', () => {
    expect(treeKey(rows, 2, 'ArrowRight', shape)).toEqual({ handled: true, toggle: 2 });
    expect(treeKey(rows, 0, 'ArrowRight', shape)).toEqual({ handled: true, at: 1 });
  });
  it('takes Right on an open branch with no children without moving, and leaves a leaf alone', () => {
    expect(treeKey(rows, 3, 'ArrowRight', shape)).toEqual({ handled: true, at: null });
    expect(treeKey(rows, 1, 'ArrowRight', shape)).toEqual({ handled: false });
  });
  it('closes an open branch with Left, else steps to the parent', () => {
    expect(treeKey(rows, 0, 'ArrowLeft', shape)).toEqual({ handled: true, toggle: 0 });
    expect(treeKey(rows, 2, 'ArrowLeft', shape)).toEqual({ handled: true, at: 0 });
    expect(treeKey(rows, 1, 'ArrowLeft', shape)).toEqual({ handled: true, at: 0 });
  });
  it('mirrors under rtl: Left opens and steps in, Right closes and steps out', () => {
    const rtl = { ...shape, dir: 'rtl' as const };
    expect(treeKey(rows, 2, 'ArrowLeft', rtl)).toEqual({ handled: true, toggle: 2 });
    expect(treeKey(rows, 0, 'ArrowLeft', rtl)).toEqual({ handled: true, at: 1 });
    expect(treeKey(rows, 0, 'ArrowRight', rtl)).toEqual({ handled: true, toggle: 0 });
    expect(treeKey(rows, 1, 'ArrowRight', rtl)).toEqual({ handled: true, at: 0 });
  });
  it("takes a right-to-left list's dir through rowKey", () => {
    expect(rowKey(rows, 2, { key: 'ArrowLeft' }, { tree: shape, dir: 'rtl' })).toEqual({ kind: 'toggle', at: 2 });
  });
  it('leaves Left on a closed top-level row unhandled', () => {
    expect(treeKey([{ id: 'x' }], 0, 'ArrowLeft', shape)).toEqual({ handled: false });
  });
  it('steps past a branch that cannot toggle', () => {
    const locked = rows.map((r) => ({ ...r, locked: true }));
    expect(treeKey(locked, 2, 'ArrowRight', shape)).toEqual({ handled: true, at: null });
    expect(treeKey(locked, 0, 'ArrowLeft', shape)).toEqual({ handled: false });
  });
  it('ignores other keys', () => {
    expect(treeKey(rows, 0, 'ArrowDown', shape)).toEqual({ handled: false });
  });
});

describe('rowKey', () => {
  const all = { wrap: false, tree: shape, selectAll: true, activate: true, typeahead: true };
  it('selects all on Cmd/Ctrl+A only', () => {
    expect(rowKey(rows, 0, { key: 'a', metaKey: true }, all)).toEqual({ kind: 'selectAll' });
    expect(rowKey(rows, 0, { key: 'A', ctrlKey: true }, all)).toEqual({ kind: 'selectAll' });
    expect(rowKey(rows, 0, { key: 'a', metaKey: true, shiftKey: true }, all)).toBeNull();
    expect(rowKey(rows, 0, { key: 'a', metaKey: true }, { ...all, selectAll: false })).toBeNull();
  });
  it('moves on the arrows, extending with Shift, and stops at the ends', () => {
    expect(rowKey(rows, 0, { key: 'ArrowDown', shiftKey: true }, all)).toEqual({ kind: 'move', at: 1, extend: true });
    expect(rowKey(rows, 3, { key: 'ArrowDown' }, all)).toEqual({ kind: 'move', at: 3, extend: false });
    expect(rowKey(rows, 2, { key: 'Home' }, all)).toEqual({ kind: 'move', at: 0, extend: false });
  });
  it('hands Right and Left to the tree, and to nothing without one', () => {
    expect(rowKey(rows, 2, { key: 'ArrowRight' }, all)).toEqual({ kind: 'toggle', at: 2 });
    expect(rowKey(rows, 1, { key: 'ArrowLeft' }, all)).toEqual({ kind: 'move', at: 0, extend: false });
    expect(rowKey(rows, 1, { key: 'ArrowRight' }, all)).toBeNull();
    expect(rowKey(rows, 2, { key: 'ArrowRight' }, { wrap: false })).toBeNull();
  });
  it('activates on Enter and Space, unless a search is under way', () => {
    expect(rowKey(rows, 0, { key: 'Enter' }, all)).toEqual({ kind: 'activate' });
    expect(rowKey(rows, 0, { key: ' ' }, all)).toEqual({ kind: 'activate' });
    expect(rowKey(rows, 0, { key: ' ' }, all, true)).toEqual({ kind: 'type', held: true });
    expect(rowKey(rows, 0, { key: 'Enter' }, { ...all, activate: false })).toBeNull();
  });
  it('types ahead on a plain character only', () => {
    expect(rowKey(rows, 0, { key: 'x' }, all)).toEqual({ kind: 'type', held: false });
    expect(rowKey(rows, 0, { key: 'x', altKey: true }, all)).toBeNull();
    expect(rowKey(rows, 0, { key: 'x' }, { ...all, typeahead: false })).toBeNull();
  });
});
