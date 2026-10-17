import { describe, expect, it } from 'vitest';
import type { PolygonPath } from '../path';
import { PATH_Z } from '../commands';
import { pathFromD } from './pathFromD';
import { pathAwayFromAnchors } from './pathAwayFromAnchors';

const coords = (p: PolygonPath) => Array.from(p.coords);
const cmds = (p: PolygonPath) => Array.from(p.commands);

describe('pathAwayFromAnchors', () => {
  it('drops a moving anchor and the segments at it', () => {
    const r = pathAwayFromAnchors(pathFromD('M0 0 H10 H20 H30'), [1]);
    expect(coords(r.path)).toEqual([20, 0, 30, 0]);
    expect(r.anchors).toEqual([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }]);
  });

  it('opens a closed subpath at the moving anchor', () => {
    const r = pathAwayFromAnchors(pathFromD('M0 0 H10 V10 H0 Z'), [0]);
    expect(coords(r.path)).toEqual([10, 0, 10, 10, 0, 10]);
    expect(cmds(r.path)).not.toContain(PATH_Z);
  });

  it('leaves a subpath with no moving anchor whole', () => {
    const r = pathAwayFromAnchors(pathFromD('M0 0 H10 M0 20 H10'), [0]);
    expect(coords(r.path)).toEqual([0, 20, 10, 20]);
  });
});
