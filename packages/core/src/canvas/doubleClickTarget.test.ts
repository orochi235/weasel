/**
 * What a double-click names: the outermost group above the hit, inside the entered group, so each
 * double-click drills one level further in. Single picks are untouched.
 */
import { describe, expect, it } from 'vitest';
import { buildClassifyTarget } from './affordanceAt';
import { doubleClickTarget } from './doubleClickTarget';

// outer > inner > leaf; outer > sibling; frame (not a group) > framed; bare at the root.
const PARENT: Record<string, string | null> = {
  outer: null, inner: 'outer', leaf: 'inner', sibling: 'outer', frame: null, framed: 'frame', bare: null,
};
const KIND: Record<string, string> = {
  outer: 'group', inner: 'group', leaf: 'path', sibling: 'rect', frame: 'frame', framed: 'path', bare: 'path',
};
const tree = (scope: string | null = null) => ({
  parentOf: (id: string) => PARENT[id] ?? null,
  kindOf: (id: string) => KIND[id],
  scope,
});

describe('doubleClickTarget', () => {
  it('names the outermost group above a hit at the scene root', () => {
    expect(doubleClickTarget('leaf', tree())).toBe('outer');
    expect(doubleClickTarget('sibling', tree())).toBe('outer');
    expect(doubleClickTarget('inner', tree())).toBe('outer');
  });

  it('names the outermost group inside the entered one, one level further in', () => {
    expect(doubleClickTarget('leaf', tree('outer'))).toBe('inner');
    expect(doubleClickTarget('leaf', tree('inner'))).toBe('leaf');
    expect(doubleClickTarget('sibling', tree('outer'))).toBe('sibling');
  });

  it('names the hit itself where no group stands above it', () => {
    expect(doubleClickTarget('bare', tree())).toBe('bare');
    expect(doubleClickTarget('framed', tree())).toBe('framed');
  });

  it('names a group the hit is, at the scope root', () => {
    expect(doubleClickTarget('outer', tree())).toBe('outer');
    expect(doubleClickTarget('outer', tree('outer'))).toBe('outer');
  });

  it('walks to the root from a hit outside the entered group', () => {
    expect(doubleClickTarget('leaf', tree('elsewhere'))).toBe('outer');
  });
});

describe('buildClassifyTarget — what a double-click names', () => {
  const pickBest = (wx: number) => (wx < 50 ? 'leaf' : wx < 100 ? 'bare' : null);
  const classify = buildClassifyTarget(
    () => ['outer'], pickBest, (id) => KIND[id], (id) => doubleClickTarget(id, tree()),
  );

  it('keeps the hit as the body and carries the group a double-click names beside it', () => {
    expect(classify({ x: 10, y: 0 })).toEqual({
      body: 'unselected-body', kind: 'path', id: 'leaf',
      doubleClick: { body: 'selected-body', kind: 'group', id: 'outer' },
    });
  });

  it('carries nothing extra where a double-click names the hit itself', () => {
    expect(classify({ x: 60, y: 0 })).toEqual({ body: 'unselected-body', kind: 'path', id: 'bare' });
  });
});
