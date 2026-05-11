import { describe, expect, it } from 'vitest';
import { createDeleteOp } from './delete';

interface Obj { id: string; value: number }

function makeAdapter() {
  const inserts: Obj[] = [];
  const removes: string[] = [];
  return {
    insertNode: (o: Obj) => inserts.push(o),
    removeNode: (id: string) => removes.push(id),
    inserts,
    removes,
  };
}

describe('createDeleteOp', () => {
  it('applies as remove', () => {
    const obj: Obj = { id: 'a', value: 1 };
    const adapter = makeAdapter();
    createDeleteOp<Obj>({ node: obj }).apply(adapter as any);
    expect(adapter.removes).toEqual(['a']);
  });

  it('inverts to an insert', () => {
    const obj: Obj = { id: 'a', value: 1 };
    const adapter = makeAdapter();
    createDeleteOp<Obj>({ node: obj }).invert().apply(adapter as any);
    expect(adapter.inserts).toEqual([obj]);
  });
});
