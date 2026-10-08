import { describe, expect, it } from 'vitest';
import { resolveDrop, type DropRow } from './dropTarget';

const H = 20;
/** Rows in display order; `top` follows from position. */
function rows(spec: Array<Omit<DropRow, 'top' | 'height'>>): DropRow[] {
  return spec.map((r, i) => ({ ...r, top: i * H, height: H }));
}
const leaf = (id: string, index: number, parentId: string | null = null, level = 1) =>
  ({ id, parentId, level, index, branch: false, expanded: false, childCount: 0 });

describe('resolveDrop — flat list', () => {
  const flat = rows([leaf('a', 0), leaf('b', 1), leaf('c', 2)]);

  it('drops before a row from its upper half and after it from its lower half', () => {
    expect(resolveDrop(flat, { x: 0, y: 25 }).target).toEqual({ parentId: null, index: 1 });
    expect(resolveDrop(flat, { x: 0, y: 35 }).target).toEqual({ parentId: null, index: 2 });
  });

  it('drops at the end below every row, and at 0 above them', () => {
    expect(resolveDrop(flat, { x: 0, y: 999 }).target).toEqual({ parentId: null, index: 3 });
    expect(resolveDrop(flat, { x: 0, y: -5 }).target).toEqual({ parentId: null, index: 0 });
  });

  it('treats a gap between rows as above the next row', () => {
    const gapped = flat.map((r, i) => ({ ...r, top: i * (H + 10) }));
    expect(resolveDrop(gapped, { x: 0, y: 25 }).target).toEqual({ parentId: null, index: 1 });
  });

  it('treats the exact midpoint as after, as the flat list always did', () => {
    expect(resolveDrop(flat, { x: 0, y: 30 }).target).toEqual({ parentId: null, index: 2 });
  });
});

describe('resolveDrop — tree', () => {
  // g (expanded) > [x, y]; then z
  const tree = rows([
    { id: 'g', parentId: null, level: 1, index: 0, branch: true, expanded: true, childCount: 2 },
    leaf('x', 0, 'g', 2),
    leaf('y', 1, 'g', 2),
    leaf('z', 1),
  ]);
  const indent = { originX: 0, indent: 16 };

  it('drops into a branch from the middle half of its row', () => {
    expect(resolveDrop(tree, { x: 0, y: 10 }, indent)).toEqual({
      target: { parentId: 'g', index: 2 },
      mark: { id: 'g', where: 'into' },
    });
  });

  it('drops before a branch from its top quarter', () => {
    expect(resolveDrop(tree, { x: 0, y: 2 }, indent).target).toEqual({ parentId: null, index: 0 });
  });

  it('puts the bottom quarter of an expanded branch before its first child', () => {
    expect(resolveDrop(tree, { x: 0, y: 18 }, indent)).toEqual({
      target: { parentId: 'g', index: 0 },
      mark: { id: 'x', where: 'before' },
    });
  });

  it('reads the level from x below the last row of a subtree', () => {
    // lower half of y: deep x stays inside g, shallow x goes after g
    expect(resolveDrop(tree, { x: 40, y: 55 }, indent).target).toEqual({ parentId: 'g', index: 2 });
    expect(resolveDrop(tree, { x: 2, y: 55 }, indent)).toEqual({
      target: { parentId: null, index: 1 },
      mark: { id: 'g', where: 'after' },
    });
  });

  it('drops into a collapsed branch at the end of its children', () => {
    const collapsed = rows([
      { id: 'g', parentId: null, level: 1, index: 0, branch: true, expanded: false, childCount: 3 },
    ]);
    expect(resolveDrop(collapsed, { x: 0, y: 10 }).target).toEqual({ parentId: 'g', index: 3 });
  });

  it('returns the top-level start with no mark for an empty tree', () => {
    expect(resolveDrop([], { x: 0, y: 0 })).toEqual({ target: { parentId: null, index: 0 }, mark: null });
  });
});
