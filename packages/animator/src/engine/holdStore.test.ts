import { describe, expect, it } from 'vitest';
import { createHoldStore } from './holdStore';

/** A store over `rows` rows of `axes` numbers, committed at `committed`. */
function rig(axes: number, rows: number, angles?: number[]) {
  const committed = new Float64Array(rows * axes);
  let reads = 0;
  const store = createHoldStore(axes, rows, (row, out, at) => {
    reads += 1;
    for (let k = 0; k < axes; k++) out[at + k] = committed[row * axes + k]!;
  }, angles);
  const delta = (row: number): number[] => Array.from(store.delta.subarray(row * axes, (row + 1) * axes));
  const cover = (row: number): number[] => Array.from(store.cover.subarray(row * axes, (row + 1) * axes));
  return { store, committed, delta, cover, reads: () => reads };
}

const constant = (v: number[], w = 1, fixed = true) => ({
  value: (out: Float64Array, at: number) => out.set(v, at),
  weight: () => w,
  fixed,
});

describe('a hold store', () => {
  it('folds a row\'s holds into what they add to its committed value, and how much they cover', () => {
    const r = rig(2, 4);
    r.committed.set([10, 10], 2);
    r.store.join(r.store.free(1), 1, constant([30, 50], 0.5));
    r.store.refold(1);
    expect(r.delta(1)).toEqual([10, 20]);
    expect(r.cover(1)).toEqual([0.5, 0.5]);
    expect(r.delta(0)).toEqual([0, 0]);
    expect([...r.store.held.subarray(0, r.store.size)]).toEqual([1]);
  });

  it('mixes two holds on a row as alternatives, by weight', () => {
    const r = rig(1, 1);
    r.store.join(r.store.free(0), 0, constant([10], 0.75));
    r.store.join(r.store.free(0), 0, constant([30], 0.75));
    r.store.refold(0);
    expect(r.delta(0)[0]).toBeCloseTo(20, 9);
    expect(r.cover(0)).toEqual([1]);
    expect(r.store.count[0]).toBe(2);
  });

  it('holds only the axes a hold covers', () => {
    const r = rig(2, 1);
    r.store.join(r.store.free(0), 0, { ...constant([5, 7]), covers: Uint8Array.of(0, 1) });
    r.store.refold(0);
    expect(r.delta(0)).toEqual([0, 7]);
    expect(r.cover(0)).toEqual([0, 1]);
  });

  it('turns the short way round on an angle axis', () => {
    const r = rig(1, 1, [0]);
    r.committed[0] = 0.1;
    r.store.join(r.store.free(0), 0, constant([2 * Math.PI - 0.1]));
    r.store.refold(0);
    expect(r.delta(0)[0]).toBeCloseTo(-0.2, 9);
  });

  it('asks a hold that is not fixed each frame, and a fixed one only when it is refolded', () => {
    const r = rig(1, 2);
    let x = 1;
    let asked = 0;
    r.store.join(r.store.free(0), 0, { value: (out, at) => { asked += 1; out[at] = x; }, weight: () => 1 });
    let y = 1;
    r.store.join(r.store.free(1), 1, { value: (out, at) => { out[at] = y; }, weight: () => 1, fixed: true });
    r.store.refold(1);
    x = 2;
    y = 2;
    r.store.frame();
    expect(r.delta(0)).toEqual([2]);
    expect(r.delta(1)).toEqual([1]);
    expect(asked).toBe(1);
    r.store.refold(1);
    expect(r.delta(1)).toEqual([2]);
  });

  it('asks no value of a hold at weight 0', () => {
    const r = rig(1, 1);
    let asked = 0;
    r.store.join(r.store.free(0), 0, { value: () => { asked += 1; }, weight: () => 0 });
    r.store.frame();
    expect(asked).toBe(0);
    expect(r.cover(0)).toEqual([0]);
  });

  it('folds a layer the caller writes, which has no sources', () => {
    const r = rig(1, 3);
    const layer = r.store.layer();
    for (const row of [0, 2]) r.store.join(layer, row);
    layer.values.set([5, 0, 9]);
    layer.weights.set([1, 0, 0.5]);
    r.store.refold(0);
    r.store.refold(2);
    expect([r.delta(0)[0], r.delta(2)[0]]).toEqual([5, 4.5]);
  });

  it('leaves out a hold it is told to skip, asking nothing', () => {
    const r = rig(1, 1);
    const a = r.store.free(0);
    r.store.join(a, 0, constant([10], 0.5));
    r.store.join(r.store.free(0), 0, constant([30], 0.5));
    r.store.refold(0);
    const delta = [0];
    const total = [0];
    r.store.fold(0, [0], 0, a, delta, total);
    expect([delta[0], total[0]]).toEqual([15, 0.5]);
  });

  it('clears a row no hold stands on any more, and keeps its rows as it grows', () => {
    const r = rig(1, 1);
    const layer = r.store.free(0);
    r.store.join(layer, 0, constant([4]));
    r.store.refold(0);
    r.store.grow(10);
    expect(r.delta(0)).toEqual([4]);
    r.store.join(r.store.free(9), 9, constant([3]));
    r.store.part(layer, 0);
    expect(r.delta(0)).toEqual([0]);
    expect(r.store.count[0]).toBe(0);
    expect([...r.store.held.subarray(0, r.store.size)]).toEqual([9]);
  });
});
