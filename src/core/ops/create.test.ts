import { describe, expect, it } from 'vitest';
import { createInsertOp } from './create';

interface Obj { id: string; value: number }

function makeAdapter() {
  const inserts: Obj[] = [];
  const removes: string[] = [];
  return {
    insertObject: (o: Obj) => inserts.push(o),
    removeObject: (id: string) => removes.push(id),
    inserts,
    removes,
  };
}

describe('createInsertOp', () => {
  it('applies as insert', () => {
    const obj: Obj = { id: 'a', value: 1 };
    const adapter = makeAdapter();
    createInsertOp<Obj>({ object: obj }).apply(adapter as any);
    expect(adapter.inserts).toEqual([obj]);
  });

  it('inverts to a remove', () => {
    const obj: Obj = { id: 'a', value: 1 };
    const adapter = makeAdapter();
    createInsertOp<Obj>({ object: obj }).invert().apply(adapter as any);
    expect(adapter.removes).toEqual(['a']);
  });
});
