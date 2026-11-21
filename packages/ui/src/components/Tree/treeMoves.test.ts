import { describe, expect, it } from 'vitest';
import type { TreeNode } from './Tree';
import { draggedIdsFor, isNoopMove, keyboardTarget, landsInside, parentsOf } from './treeMoves';

const T: TreeNode[] = [
  { id: 'g', label: 'g', children: [
    { id: 'x', label: 'x' },
    { id: 'h', label: 'h', children: [{ id: 'y', label: 'y' }] },
  ] },
  { id: 'z', label: 'z' },
  { id: 'w', label: 'w' },
];

describe('treeMoves', () => {
  it('maps each id to its parent', () => {
    expect(parentsOf(T).get('y')).toBe('h');
    expect(parentsOf(T).get('g')).toBeNull();
  });

  it('drags the selection in tree order, without nodes whose ancestor is also selected', () => {
    expect(draggedIdsFor(T, new Set(['z', 'y', 'g']), 'z')).toEqual(['g', 'z']);
    expect(draggedIdsFor(T, new Set(['z']), 'x')).toEqual(['x']);
  });

  it('carries a node whose selected ancestor stays behind', () => {
    const held: TreeNode[] = [{ ...T[0]!, immovable: true }, ...T.slice(1)];
    expect(draggedIdsFor(held, new Set(['g', 'x', 'y']), 'x')).toEqual(['x', 'y']);
    const heldH: TreeNode[] = [{ ...T[0]!, children: [T[0]!.children![0]!, { ...T[0]!.children![1]!, immovable: true }] }, ...T.slice(1)];
    expect(draggedIdsFor(heldH, new Set(['g', 'h', 'y']), 'g')).toEqual(['g']);
  });

  it('leaves a selected disabled node behind', () => {
    const off: TreeNode[] = [...T.slice(0, 2), { ...T[2]!, disabled: true }];
    expect(draggedIdsFor(off, new Set(['z', 'w']), 'z')).toEqual(['z']);
  });

  it('refuses a target inside a dragged node', () => {
    expect(landsInside(T, ['g'], { parentId: 'h', index: 0 })).toBe(true);
    expect(landsInside(T, ['g'], { parentId: 'g', index: 0 })).toBe(true);
    expect(landsInside(T, ['x'], { parentId: 'h', index: 0 })).toBe(false);
  });

  it('calls a drop that leaves a contiguous run in place a no-op', () => {
    expect(isNoopMove(T, ['z', 'w'], { parentId: null, index: 1 })).toBe(true);
    expect(isNoopMove(T, ['z', 'w'], { parentId: null, index: 3 })).toBe(true);
    expect(isNoopMove(T, ['z'], { parentId: null, index: 0 })).toBe(false);
  });

  it('computes keyboard targets', () => {
    expect(keyboardTarget(T, ['z'], 'up')).toEqual({ parentId: null, index: 0 });
    expect(keyboardTarget(T, ['z'], 'down')).toEqual({ parentId: null, index: 3 });
    expect(keyboardTarget(T, ['w'], 'down')).toBeNull();
    expect(keyboardTarget(T, ['y'], 'out')).toEqual({ parentId: 'g', index: 2 });
    expect(keyboardTarget(T, ['g'], 'out')).toBeNull();
    expect(keyboardTarget(T, ['z'], 'in')).toEqual({ parentId: 'g', index: 2 });
    expect(keyboardTarget(T, ['w'], 'in')).toBeNull(); // z is a leaf
  });
});
