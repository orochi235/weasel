import { describe, expect, it } from 'vitest';
import type { SnapBegin, SnapMods } from 'interactions/actions/snapDep';
import { createSnapOutcomeStore } from './outcomeStore';
import { rotationSnapSource } from './rotationSource';
import { createSession2d } from './session2d';
import type { SnapSource } from './types';

const FREE: SnapMods = { suspend: false, constrain: false };
const SHIFT: SnapMods = { suspend: false, constrain: true };
const DEG = Math.PI / 180;

/** One angle target, for any angle gesture. */
const at = (angle: number): SnapSource => ({
  id: `at-${angle}`, roles: [], gestures: ['rotate', 'handle'], collect: () => [],
  *angles() { yield { angle }; },
});

function session(req: Partial<SnapBegin>, sources: readonly SnapSource[]) {
  return createSession2d({
    req: { gesture: 'rotate', press: { x: 100, y: 0 }, pivot: { x: 0, y: 0 }, ...req },
    sources,
    probes: [],
    view: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
    reachPx: 8,
    store: createSnapOutcomeStore(),
  });
}

describe('SnapSession.angle', () => {
  it('reaches 8px of arc at the press radius', () => {
    // 8px at a 100px radius is about 4.6°.
    expect(session({}, [at(0)]).angle(4 * DEG, FREE).theta).toBeCloseTo(0, 9);
    expect(session({}, [at(0)]).angle(5 * DEG, FREE).theta).toBeCloseTo(5 * DEG, 9);
  });

  it('reaches no more than a twelfth of a turn from a press near the pivot', () => {
    const s = session({ press: { x: 2, y: 0 } }, [at(0)]);
    expect(s.angle(25 * DEG, FREE).theta).toBeCloseTo(0, 9);
    expect(s.angle(40 * DEG, FREE).theta).toBeCloseTo(40 * DEG, 9);
  });

  it('takes its reach as an angle when the gesture names one', () => {
    const s = session({ gesture: 'handle', reachRad: 6 * DEG }, [at(0)]);
    expect(s.angle(5 * DEG, FREE).theta).toBeCloseTo(0, 9);
    expect(s.angle(7 * DEG, FREE).theta).toBeCloseTo(7 * DEG, 9);
  });

  it('gives a handle drag no rotation targets', () => {
    const s = session({ gesture: 'handle', reachRad: 6 * DEG }, [rotationSnapSource()]);
    expect(s.angle(89 * DEG, FREE).theta).toBeCloseTo(89 * DEG, 9);
  });

  it('steps by a step that does not divide a turn', () => {
    const s = session({ constrain: { step: 0.7 } }, []);
    expect(s.angle(6.4, SHIFT).theta).toBeCloseTo(6.3, 9);
    expect(s.angle(-0.3, SHIFT).theta).toBeCloseTo(0, 9);
  });
});
