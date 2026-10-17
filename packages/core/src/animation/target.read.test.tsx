import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear, PATH_L, PATH_M, PATH_Z, type Path } from '@weasel-js/geom';
import { RECT_POSE_DESCRIPTOR } from '../core/geometry/poseDescriptor';
import { pathPoseDescriptor } from '../core/geometry/pathPoseDescriptor';
import { viewAxes } from '../core/viewport/useViewAnimation';
import { axesOf } from '@weasel-js/animator';
import { liveAxes } from './poseTarget';
import { skeletonAxes } from '@weasel-js/animator';
import { IDENTITY_JOINT } from '@weasel-js/animator';
import { createTarget, type TargetAxes } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';

type Pt = { x: number; y: number };

function setup() {
  const cbs: ((t: number) => void)[] = [];
  let now = 0;
  const { result } = renderHook(() => useAnimator({
    now: () => now,
    requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
  }));
  const frame = (t: number): void => act(() => { now = t; for (const cb of cbs.splice(0)) cb(t); });
  return { animator: result.current, frame };
}

/** A point target whose axes count the calls made on them. */
function counted(withFast: boolean) {
  const calls = { to: 0, from: 0, add: 0, write: 0 };
  let committed: Pt = { x: 30, y: 5 };
  const axes: TargetAxes<Pt> = {
    count: 2,
    to: (p) => { calls.to += 1; return [p.x, p.y]; },
    from: (a) => { calls.from += 1; return { x: a[0]!, y: a[1]! }; },
    ...(withFast ? {
      add: (p, d) => { calls.add += 1; return { x: p.x + d[0]!, y: p.y + d[1]! }; },
      write: (p, out, at) => { calls.write += 1; out[at] = p.x; out[at + 1] = p.y; },
    } : {}),
  };
  const target = createTarget<Pt>({ axes, get: () => committed, set: (v) => { committed = v; } });
  return { target, calls };
}

/** A tween from x = 30 to x = 10, halfway. */
function halfway(withFast: boolean) {
  const s = setup();
  const c = counted(withFast);
  act(() => { s.animator.tween({ target: c.target, to: { x: 10, y: 5 }, ms: 1000, easing: linear }); });
  s.frame(0);
  s.frame(500);
  return { ...s, ...c };
}

describe('reading a moving target', () => {
  it('builds the value through axes.add, with no array of axes between', () => {
    const { target, calls } = halfway(true);
    const before = { ...calls };
    expect(target.read()).toEqual({ x: 20, y: 5 });
    expect(calls.add).toBe(before.add + 1);
    expect(calls.to).toBe(before.to);
    expect(calls.from).toBe(before.from);
  });

  it('reads the same through axes with no add', () => {
    expect(halfway(false).target.read()).toEqual({ x: 20, y: 5 });
  });

  it('reads a value held on it, and sees the committed value change under a hold', () => {
    const { animator } = setup();
    const { target } = counted(true);
    act(() => { animator.hold({ target, value: { x: 70, y: 70 }, weight: 0.5 }); });
    expect(target.read()).toEqual({ x: 50, y: 37.5 });
  });
});

describe('target.readInto', () => {
  it('writes the value on screen as numbers, where it is told to', () => {
    const { target } = halfway(true);
    const out = new Float64Array(5).fill(-1);
    target.readInto(out, 2);
    expect(Array.from(out)).toEqual([-1, -1, 20, 5, -1]);
    expect(target.axisCount).toBe(2);
  });

  it('builds neither an array nor a value where the axes can write', () => {
    const { target, calls } = halfway(true);
    const before = { ...calls };
    target.readInto(new Float64Array(2));
    expect(calls).toEqual({ ...before, write: before.write + 1 });
  });

  it('writes the same through axes with no write, into a plain array too', () => {
    const { target } = halfway(false);
    const out: number[] = [0, 0];
    target.readInto(out);
    expect(out).toEqual([20, 5]);
  });

  it('writes the committed value of a target at rest', () => {
    const { target } = counted(true);
    const out = new Float64Array(2);
    target.readInto(out);
    expect(Array.from(out)).toEqual([30, 5]);
  });

  it('writes a held value', () => {
    const { animator } = setup();
    const { target } = counted(true);
    act(() => { animator.hold({ target, value: { x: 70, y: 70 }, weight: 0.5 }); });
    const out = new Float64Array(2);
    target.readInto(out);
    expect(Array.from(out)).toEqual([50, 37.5]);
  });
});

const poly: Path = {
  kind: 'polygon',
  commands: Uint8Array.of(PATH_M, PATH_L, PATH_L, PATH_Z),
  coords: Float32Array.of(0, 0, 4, 0, 0, 4),
  fillRule: 'nonzero',
};
const skeleton = {
  joints: [
    { name: 'hip', parent: null, bind: { ...IDENTITY_JOINT } },
    { name: 'knee', parent: 'hip', bind: { ...IDENTITY_JOINT, x: 10 } },
  ],
};
const rect = { x: 1, y: 2, width: 3, height: 4 };
const turned = { ...rect, rotation: 0.5, tag: 'kept' };

const CASES: [string, TargetAxes<never>, unknown][] = [
  ['a number', axesOf(7) as never, 7],
  ['an array of numbers', axesOf([1, 2, 3]) as never, [1, 2, 3]],
  ['an object of numbers', axesOf({ b: 2, a: 1 }) as never, { b: 2, a: 1 }],
  ['a rect pose', RECT_POSE_DESCRIPTOR.axes!(rect) as never, rect],
  ['a rotated rect pose with a field of its own', RECT_POSE_DESCRIPTOR.axes!(turned) as never, turned],
  ['a rect path', pathPoseDescriptor.axes!({ kind: 'rect', ...rect }) as never, { kind: 'rect', ...rect }],
  ['a polygon path', pathPoseDescriptor.axes!(poly) as never, poly],
  ['a view', viewAxes as never, { x: 1, y: 2, scale: { x: 3, y: 4 } }],
  ['a rig pose', skeletonAxes(skeleton) as never, { knee: { rotation: 1 } }],
  ['a live pose', liveAxes(RECT_POSE_DESCRIPTOR, () => turned) as never, turned],
];

describe.each(CASES)('the axes of %s', (_, axes, value) => {
  const ax = axes as unknown as TargetAxes<unknown>;
  const delta = Array.from({ length: ax.count }, (_x, i) => (i + 1) / 4);

  it('add answers what from answers for the axes plus a delta', () => {
    expect(ax.add).toBeDefined();
    const slow = ax.from(ax.to(value).map((n, i) => n + delta[i]!));
    expect(ax.add!(value, delta)).toEqual(slow);
  });

  it('write puts down what to answers, from where it is told', () => {
    expect(ax.write).toBeDefined();
    const out = new Float64Array(ax.count + 2).fill(-1);
    ax.write!(value, out, 1);
    expect(Array.from(out)).toEqual([-1, ...ax.to(value), -1]);
  });
});
