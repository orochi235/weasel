import { describe, it, expect } from 'vitest';
import { findConflicts } from './conflicts';
import type { Tool } from '../../types';

function tool(id: string, bindings: unknown[]): Tool<unknown> {
  return { id, bindings } as unknown as Tool<unknown>;
}

const clickRect = (actionId = 'x') => ({ spec: { kind: 'click', target: 'empty' }, actionId });

describe('findConflicts', () => {
  it('returns nothing for a single tool', () => {
    expect(findConflicts([tool('a', [clickRect()])])).toEqual([]);
  });

  it('flags two tools claiming the same tuple', () => {
    const c = findConflicts([tool('a', [clickRect()]), tool('b', [clickRect()])]);
    expect(c).toHaveLength(1);
    expect(c[0].toolIds.sort()).toEqual(['a', 'b']);
    expect(c[0].gesture).toBe('click');
    expect(c[0].target).toBe('empty');
  });

  it('flags a three-way conflict', () => {
    const c = findConflicts([tool('a', [clickRect()]), tool('b', [clickRect()]), tool('c', [clickRect()])]);
    expect(c).toHaveLength(1);
    expect(c[0].toolIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('does NOT flag different targets', () => {
    const a = tool('a', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'selected-body' }, actionId: 'y' }]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('does NOT flag different modifier requirements on the same target', () => {
    const a = tool('a', [{ spec: { kind: 'click', target: 'empty', mods: { shift: true } }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'empty', mods: { alt: true } }, actionId: 'y' }]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('does NOT flag a broad binding alongside a narrow one', () => {
    // Specificity ordering resolves this cleanly, and the untargeted one is
    // usually the intended fallback.
    const a = tool('a', [{ spec: { kind: 'click' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'y' }]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('separates conflicts by phase', () => {
    const a = tool('a', [{ spec: { kind: 'wheel', phase: 'engaged' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'wheel', phase: 'engaged' }, actionId: 'y' }]);
    const c = tool('c', [{ spec: { kind: 'wheel' }, actionId: 'z' }]);
    const conflicts = findConflicts([a, b, c]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].phase).toBe('engaged');
  });

  it('flags a tool that binds the same tuple twice', () => {
    // Newly possible: bindings are an array, where phase tables were objects
    // whose duplicate keys collapsed.
    const c = findConflicts([tool('a', [clickRect('x'), clickRect('y')])]);
    expect(c).toHaveLength(1);
    expect(c[0].toolIds).toEqual(['a', 'a']);
  });

  it('does NOT flag an any-phase binding against an initial-phase one', () => {
    // Regression: `phaseOf` used to collapse every non-'engaged' PhaseSpec to
    // 'initial', so these two bucketed together and reported a conflict that
    // isn't one — they fire in different phases.
    const a = tool('a', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'empty', phase: 'initial' }, actionId: 'y' }]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('flags two any-phase bindings on the same tuple', () => {
    const a = tool('a', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'y' }]);
    const c = findConflicts([a, b]);
    expect(c).toHaveLength(1);
    expect(c[0].phase).toBe('any');
  });
});
