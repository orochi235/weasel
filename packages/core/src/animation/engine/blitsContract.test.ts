import { describe, expect, it } from 'vitest';
import { kit, mix, spring, sum, tween, vec } from '@msb235/blits';

type U = { u: number };
type P = { p: number[] };
const linear = (x: number) => x;

describe('blits behaviors the animator codec relies on', () => {
  it('a tween subject started with to(id, 1, at) is at ease((t - at) / ms)', () => {
    const m = mix<number, U>(kit<U>({ u: sum() }));
    m.sync(0);
    const ms = new Map([[1, 1000], [2, 500]]);
    const tw = tween<number, U>('u', { from: 0, to: 1, ms: (id) => ms.get(id)!, ease: linear });
    m.cue({ patch: tw });
    tw.to(1, 1, 0);
    tw.to(2, 1, 0);
    m.sync(250);
    const cols = { u: new Float64Array(2) };
    m.pull([1, 2], cols);
    expect(cols.u[0]).toBeCloseTo(0.25, 9);
    expect(cols.u[1]).toBeCloseTo(0.5, 9);
  });

  it('pull reads a sum channel no voice reaches as 0', () => {
    const m = mix<number, U>(kit<U>({ u: sum() }));
    m.sync(0);
    const cols = { u: new Float64Array([42]) };
    m.pull([7], cols);
    expect(cols.u[0]).toBe(0);
  });

  it('fade({ subject, over: 0 }) takes one subject off a voice and leaves the rest', () => {
    const m = mix<number, U>(kit<U>({ u: sum() }));
    m.sync(0);
    const tw = tween<number, U>('u', { from: 0, to: 1, ms: 1000, ease: linear });
    const h = m.cue({ patch: tw });
    tw.to(1, 1, 0);
    tw.to(2, 1, 0);
    m.sync(100);
    h.fade({ subject: 1, over: 0 });
    m.sync(200);
    const cols = { u: new Float64Array([42, 42]) };
    m.pull([1, 2], cols);
    expect(cols.u[0]).toBe(0);
    expect(h.weightOf(1)).toBe(0);
    expect(cols.u[1]).toBeCloseTo(0.2, 9);
  });

  it('a voice seeked to an elapsed time reads where the shared voice would', () => {
    const m = mix<number, U>(kit<U>({ u: sum() }));
    m.sync(0);
    const tw = tween<number, U>('u', { from: 0, to: 1, ms: 1000, ease: linear });
    const h = m.cue({ patch: tw, subjects: [3] });
    tw.to(3, 1, 0);
    m.sync(100);
    h.seek(600);
    m.sync(100);
    const cols = { u: new Float64Array(1) };
    m.pull([3], cols);
    expect(cols.u[0]).toBeCloseTo(0.6, 9);
  });

  it('rate 0 holds a voice still', () => {
    const m = mix<number, U>(kit<U>({ u: sum() }));
    m.sync(0);
    const tw = tween<number, U>('u', { from: 0, to: 1, ms: 1000, ease: linear });
    const h = m.cue({ patch: tw });
    tw.to(1, 1, 0);
    m.sync(300);
    h.rate = 0;
    m.sync(900);
    const cols = { u: new Float64Array(1) };
    m.pull([1], cols);
    expect(cols.u[0]).toBeCloseTo(0.3, 9);
  });

  it('a spring carries position and velocity through to() and push(), once a frame has met it', () => {
    const m = mix<number, P>(kit<P>({ p: vec(2, sum()) }));
    m.sync(0);
    const sp = spring<number, P, number[]>('p', { from: [0, 0], to: [10, 0], stiffness: 170, damping: 26, mass: 1 });
    m.cue({ patch: sp });
    sp.to(1, [10, 0], 0);
    m.sync(100);
    expect(sp.read(1)).toBeUndefined();
    m.pull([1], { p: new Float64Array(2) });
    const before = sp.read(1)!;
    sp.to(1, [0, 10]);
    const after = sp.read(1)!;
    expect(after.value).toEqual(before.value);
    expect(after.velocity).toEqual(before.velocity);
    sp.push(1, [5, 5]);
    expect(sp.read(1)!.velocity).toEqual([5, 5]);
  });
});
