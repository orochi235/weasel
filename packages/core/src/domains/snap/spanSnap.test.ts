import { describe, expect, it } from 'vitest';
import type { SnapDep } from 'interactions/actions/snapDep';
import { createSnapOutcomeStore } from './outcomeStore';
import { spanSnap } from './spanSnap';
import { sceneOfPaths, sessionDep } from './testing/sessionDep';
import type { SnapSource } from './types';

const FREE = { suspend: false, constrain: false };

/** A point target at (10, 10) for the pointer, marked while met. */
const dot: SnapSource = {
  id: 'dot', roles: ['pointer'],
  *collect(q) {
    for (const p of q.probes) {
      yield { probe: p.id, locus: { at: { x: 10, y: 10 }, dirs: [] }, mark: { kind: 'point', at: { x: 10, y: 10 }, glyph: 'anchor' } };
    }
  },
};

describe('spanSnap', () => {
  it('keeps the start\'s point mark drawn once the start has snapped to it', () => {
    const store = createSnapOutcomeStore();
    const span = spanSnap(sessionDep(sceneOfPaths([]), [dot], 1, store));
    const landed = span.start({ x: 12, y: 11 }, FREE);
    expect(landed.point).toEqual({ x: 10, y: 10 });
    expect(store.get()).toEqual([{ kind: 'point', at: { x: 10, y: 10 }, glyph: 'anchor' }]);
    expect(span.end({ x: 50, y: 50 }, FREE).point).toEqual({ x: 50, y: 50 });
    expect(store.get()).toEqual([]);
    span.start({ x: 11, y: 10 }, FREE);
    span.close();
    expect(store.get()).toEqual([]);
  });
});

describe('spanSnap.landingAt', () => {
  /** Rounds each point to the integer grid, reporting the point it rounded to as its landing. */
  const grid: SnapDep = {
    begin: () => ({
      at: (p) => {
        const point = { x: Math.round(p.x), y: Math.round(p.y) };
        return { point, held: true, marks: [], landing: { exact: point } };
      },
      angle: (theta) => ({ theta, marks: [] }),
      end: () => {},
    }),
  };

  it('answers the landing of the end a point is where it snapped to, and none for another point', () => {
    const span = spanSnap(grid);
    span.start({ x: 1.2, y: 2.1 }, FREE);
    span.end({ x: 4.8, y: 6.3 }, FREE);
    expect(span.landingAt({ x: 1, y: 2 })).toEqual({ exact: { x: 1, y: 2 } });
    expect(span.landingAt({ x: 5, y: 6 })).toEqual({ exact: { x: 5, y: 6 } });
    expect(span.landingAt({ x: 5, y: 7 })).toBeUndefined();
  });

  it('drops the start\'s landing once something else places the start', () => {
    const span = spanSnap(grid);
    span.start({ x: 1.2, y: 2.1 }, FREE);
    span.anchor({ x: 3, y: 3 });
    expect(span.landingAt({ x: 1, y: 2 })).toBeUndefined();
  });
});
