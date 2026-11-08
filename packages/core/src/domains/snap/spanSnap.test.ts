import { describe, expect, it } from 'vitest';
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
