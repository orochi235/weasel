import { describe, expect, it } from 'vitest';
import { sceneOfPaths, sessionDep } from './sessionDep';
import type { SnapSource } from '../types';

const FREE = { suspend: false, constrain: false };
const dot: SnapSource = {
  id: 'dot', roles: ['pointer'],
  *collect(q) { for (const p of q.probes) yield { probe: p.id, locus: { at: { x: 10, y: 10 }, dirs: [] } }; },
};

describe('sessionDep', () => {
  it('leaves out the sources a request omits, and asks the ones it adds, as a canvas does', () => {
    const press = { x: 12, y: 11 };
    expect(sessionDep(sceneOfPaths([]), [dot]).begin({ gesture: 'point', press, omit: ['dot'] }).at(press, FREE).held).toBe(false);
    expect(sessionDep(sceneOfPaths([]), []).begin({ gesture: 'point', press, sources: [dot] }).at(press, FREE).held).toBe(true);
    expect(() => sessionDep(sceneOfPaths([]), [dot]).begin({ gesture: 'point', press, sources: [dot] })).toThrow(/share the id/);
  });
});
