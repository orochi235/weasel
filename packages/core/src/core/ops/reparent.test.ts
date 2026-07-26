import { describe, expect, it } from 'vitest';
import { createReparentOp } from './reparent';

describe('createReparentOp', () => {
  function makeAdapter() {
    const calls: { id: string; parentId: string | null }[] = [];
    return {
      setParent: (id: string, parentId: string | null) => calls.push({ id, parentId }),
      calls,
    };
  }

  it('apply calls setParent(id, toParentId)', () => {
    const op = createReparentOp({ id: 'a', fromParentId: 'old', toParentId: 'new' });
    const adapter = makeAdapter();
    op.apply(adapter as never);
    expect(adapter.calls).toEqual([{ id: 'a', parentId: 'new' }]);
  });

  it('invert swaps fromParentId and toParentId', () => {
    const op = createReparentOp({ id: 'a', fromParentId: 'old', toParentId: 'new' });
    const adapter = makeAdapter();
    op.invert().apply(adapter as never);
    expect(adapter.calls).toEqual([{ id: 'a', parentId: 'old' }]);
  });

  it('handles null parents on either side', () => {
    const adapter = makeAdapter();
    createReparentOp({ id: 'a', fromParentId: null, toParentId: 'new' }).invert().apply(adapter as never);
    createReparentOp({ id: 'b', fromParentId: 'old', toParentId: null }).apply(adapter as never);
    expect(adapter.calls).toEqual([
      { id: 'a', parentId: null },
      { id: 'b', parentId: null },
    ]);
  });

  it('default label is "Reparent"', () => {
    const op = createReparentOp({ id: 'a', fromParentId: null, toParentId: 'p' });
    expect(op.label).toBe('Reparent');
  });

  it('explicit label overrides default and propagates through invert', () => {
    const op = createReparentOp({ id: 'a', fromParentId: null, toParentId: 'p', label: 'Custom' });
    expect(op.label).toBe('Custom');
    expect(op.invert().label).toBe('Custom');
  });

  it('coalesceKey is stable per id', () => {
    const op1 = createReparentOp({ id: 'a', fromParentId: null, toParentId: 'p' });
    const op2 = createReparentOp({ id: 'a', fromParentId: 'p', toParentId: 'q' });
    expect(op1.coalesceKey).toBe('reparent:a');
    expect(op2.coalesceKey).toBe('reparent:a');
    expect(op1.invert().coalesceKey).toBe('reparent:a');
  });

  it('different ids get different coalesceKeys', () => {
    expect(createReparentOp({ id: 'a', fromParentId: null, toParentId: 'p' }).coalesceKey).toBe('reparent:a');
    expect(createReparentOp({ id: 'b', fromParentId: null, toParentId: 'p' }).coalesceKey).toBe('reparent:b');
  });
});
