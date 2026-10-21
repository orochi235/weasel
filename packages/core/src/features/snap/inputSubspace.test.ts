import { describe, it, expect } from 'vitest';
import { flatDim, type Flat } from '@weasel-js/geom/nd';
import type { SnapBegin, SnapMods } from 'interactions/actions/snapDep';
import { inputFlat } from './inputSubspace';
import { resizeSubject } from './resizeBox';

const ON: SnapMods = { suspend: false, constrain: true };
const OFF: SnapMods = { suspend: false, constrain: false };
const press = { x: 0, y: 0 };
const req = (r: Partial<SnapBegin>): SnapBegin => ({ gesture: 'point', press, ...r });

/** The line's unit direction, sign normalized so x (else y) is positive. */
function dirOf(f: Flat): [number, number] {
  expect(flatDim(f)).toBe(1);
  let [x, y] = f.dirs[0];
  const n = Math.hypot(x, y);
  [x, y] = [x / n, y / n];
  return x < -1e-9 || (Math.abs(x) <= 1e-9 && y < 0) ? [-x, -y] : [x, y];
}

function expectDir(f: Flat, deg: number) {
  const [x, y] = dirOf(f);
  expect(x).toBeCloseTo(Math.cos((deg * Math.PI) / 180), 9);
  expect(y).toBeCloseTo(Math.sin((deg * Math.PI) / 180), 9);
}

describe('inputFlat', () => {
  it('is the whole plane for a free gesture', () => {
    expect(flatDim(inputFlat(req({}), ON, { x: 3, y: 4 }))).toBe(2);
  });

  it('is the whole plane while constrain is not held', () => {
    expect(flatDim(inputFlat(req({ constrain: 'axis' }), OFF, { x: 3, y: 4 }))).toBe(2);
  });

  it('is the line at the nearest step angle from the origin', () => {
    const f = inputFlat(req({ origin: { x: -5, y: 0 }, constrain: { step: Math.PI / 12 } }), ON, { x: 5, y: 2.6 });
    expectDir(f, 15);
    // The line runs through the origin, which is -5 from the press.
    expect(f.at).toEqual([-5, 0]);
  });

  it('locks an axis lock to horizontal, vertical or 45°, whichever δ0 is nearest', () => {
    expectDir(inputFlat(req({ constrain: 'axis' }), ON, { x: 10, y: 3 }), 0);
    expectDir(inputFlat(req({ constrain: 'axis' }), ON, { x: 3, y: 10 }), 90);
    expectDir(inputFlat(req({ constrain: 'axis' }), ON, { x: 10, y: 9 }), 45);
  });

  it('is the diagonal through the fixed corner for an aspect lock', () => {
    const handle = { x: 'min', y: 'min' } as const;
    const box = resizeSubject({ bounds: { x: 0, y: 0, width: 100, height: 50 } }, handle);
    const f = inputFlat(req({ gesture: 'resize', constrain: 'aspect', handle }), ON, { x: 9, y: 1 }, box);
    const [x, y] = dirOf(f);
    expect(y / x).toBeCloseTo(0.5, 9);
    expect(f.at).toEqual([0, 0]);
  });

  it('is the handle axis for an edge handle, held or not', () => {
    const edgeX = req({ gesture: 'resize', handle: { x: 'min', y: 'free' } });
    expectDir(inputFlat(edgeX, OFF, { x: 3, y: 4 }), 0);
    const edgeY = req({ gesture: 'resize', handle: { x: 'free', y: 'max' }, constrain: 'aspect' });
    expectDir(inputFlat(edgeY, ON, { x: 3, y: 4 }), 90);
  });

  it('runs an edge handle and an aspect lock along the box\'s own frame', () => {
    const turn = Math.PI / 6;
    const toWorld = (p: { x: number; y: number }) =>
      ({ x: p.x * Math.cos(turn) - p.y * Math.sin(turn), y: p.x * Math.sin(turn) + p.y * Math.cos(turn) });
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const edge = { x: 'min', y: 'free' } as const;
    expectDir(inputFlat(req({ gesture: 'resize', handle: edge }), OFF, { x: 3, y: 4 }, resizeSubject({ bounds, toWorld }, edge)), 30);
    const corner = { x: 'min', y: 'min' } as const;
    const aspect = req({ gesture: 'resize', handle: corner, constrain: 'aspect' });
    expectDir(inputFlat(aspect, ON, { x: 3, y: 4 }, resizeSubject({ bounds, toWorld }, corner)), 75);
  });
});
