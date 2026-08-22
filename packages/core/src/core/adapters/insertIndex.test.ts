import { describe, expect, it } from 'vitest';
import { arrayAdapter } from './arrayAdapter';
import { createDeleteOp } from '../ops/delete';
import { applyOpsTo } from '../applyOps';

type Obj = { id: string; x: number; y: number; width: number; height: number };

function fixture() {
  const items: Obj[] = [
    { id: 'a', x: 0, y: 0, width: 10, height: 10 },
    { id: 'b', x: 20, y: 0, width: 10, height: 10 },
    { id: 'c', x: 40, y: 0, width: 10, height: 10 },
  ];
  const ref = { current: items };
  const setItems = (u: (i: Obj[]) => Obj[]): void => { ref.current = u(ref.current); };
  const adapter = arrayAdapter<Obj, Obj>({
    ref, setItems, toPose: (o) => o, fromPose: (o, p) => ({ ...o, ...p }), poseBounds: (p) => p,
  });
  return { adapter, order: () => ref.current.map((o) => o.id) };
}

describe('arrayAdapter — insertNode honors the op-supplied index', () => {
  it('undo of a middle delete restores paint order', () => {
    const { adapter, order } = fixture();
    const del = createDeleteOp({ node: { id: 'b', x: 20, y: 0, width: 10, height: 10 }, index: 1 });
    applyOpsTo(adapter as never, [del]);
    expect(order()).toEqual(['a', 'c']);
    applyOpsTo(adapter as never, [del.invert()]);
    expect(order()).toEqual(['a', 'b', 'c']);
  });

  it('undo of a multi-delete restores all positions, not a reversal', () => {
    const { adapter, order } = fixture();
    const ops = [
      createDeleteOp({ node: { id: 'c', x: 40, y: 0, width: 10, height: 10 }, index: 2 }),
      createDeleteOp({ node: { id: 'a', x: 0, y: 0, width: 10, height: 10 }, index: 0 }),
    ];
    applyOpsTo(adapter as never, ops);
    expect(order()).toEqual(['b']);
    // History undoes a batch by inverting in reverse order.
    applyOpsTo(adapter as never, [...ops].reverse().map((o) => o.invert()));
    expect(order()).toEqual(['a', 'b', 'c']);
  });

  it('an index past the end appends, and a fresh insert with no index appends', () => {
    const { adapter, order } = fixture();
    const del = createDeleteOp({ node: { id: 'z', x: 0, y: 0, width: 1, height: 1 }, index: 99 });
    applyOpsTo(adapter as never, [del.invert()]);
    expect(order()).toEqual(['a', 'b', 'c', 'z']);
  });
});
