import { describe, it, expect, vi } from 'vitest';
import type { View } from '@weasel-js/geom';
import type { SnapBegin, SnapMods } from 'interactions/actions/snapDep';
import { createSnapOutcomeStore } from './outcomeStore';
import { createSession2d, DEFAULT_SNAP_PX } from './session2d';
import type { SnapMark, SnapProbeAt, SnapSource } from './types';

type Point = { x: number; y: number };

const FREE: SnapMods = { suspend: false, constrain: false };
const STEP = 10;

/** Lines every `STEP` on both axes through each pointer probe's cell. */
const grid: SnapSource = {
  id: 'grid', tier: 'fallback', reachPx: Infinity, roles: ['pointer'],
  *collect(q) {
    for (const p of q.probes) {
      const x = Math.round(p.at.x / STEP) * STEP;
      const y = Math.round(p.at.y / STEP) * STEP;
      yield { probe: p.id, locus: { at: { x, y: 0 }, dirs: [{ x: 0, y: 1 }] } };
      yield { probe: p.id, locus: { at: { x: 0, y }, dirs: [{ x: 1, y: 0 }] } };
    }
  },
};

const TARGET = { x: 53, y: 47 };
const MARK: SnapMark = { kind: 'point', at: TARGET, glyph: 'anchor' };
const pointSource: SnapSource = {
  id: 'point', roles: ['pointer'],
  *collect(q) {
    for (const p of q.probes) yield { probe: p.id, locus: { at: TARGET, dirs: [] }, mark: MARK };
  },
};

function session(opts: {
  req?: Partial<SnapBegin>; sources?: readonly SnapSource[]; probes?: readonly SnapProbeAt[]; view?: View;
} = {}) {
  const store = createSnapOutcomeStore();
  const req: SnapBegin = { gesture: 'point', press: { x: 0, y: 0 }, ...opts.req };
  const s = createSession2d({
    req,
    sources: opts.sources ?? [grid, pointSource],
    probes: opts.probes ?? [{ id: 'pointer', at: req.press, role: 'pointer' }],
    view: () => opts.view ?? { x: 0, y: 0, scale: { x: 1, y: 1 } },
    reachPx: DEFAULT_SNAP_PX,
    store,
  });
  return { s, store };
}

const near = (a: Point, b: Point) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
};

describe('createSession2d', () => {
  it('reaches 8px by default', () => {
    expect(DEFAULT_SNAP_PX).toBe(8);
  });

  it('lands on the point source in reach, and on the grid otherwise', () => {
    const { s, store } = session();
    const hit = s.at({ x: 51, y: 49 }, FREE);
    near(hit.point, TARGET);
    expect(hit.held).toBe(true);
    expect(hit.marks).toEqual([MARK]);
    expect(store.get()).toEqual([MARK]);

    const miss = s.at({ x: 71, y: 72 }, FREE);
    near(miss.point, { x: 70, y: 70 });
    expect(miss.held).toBe(true);
    expect(miss.marks).toEqual([]);
    expect(store.get()).toEqual([]);
  });

  it('measures reach on screen, through the view', () => {
    // 3 world units at scale 4 is 12px, past the 8px reach.
    const { s } = session({ view: { x: 0, y: 0, scale: { x: 4, y: 4 } } });
    near(s.at({ x: 50, y: 47 }, FREE).point, { x: 50, y: 50 });
  });

  it('returns the raw point projected into H, with no marks, while suspended', () => {
    const { s, store } = session({ req: { constrain: 'axis' } });
    s.at({ x: 51, y: 49 }, FREE);
    const out = s.at({ x: 51, y: 49 }, { suspend: true, constrain: true });
    near(out.point, { x: 50, y: 50 });
    expect(out).toMatchObject({ held: false, marks: [] });
    expect(store.get()).toEqual([]);
  });

  it('clears the store on end', () => {
    const { s, store } = session();
    s.at({ x: 51, y: 49 }, FREE);
    expect(store.get()).toHaveLength(1);
    s.end();
    expect(store.get()).toEqual([]);
  });

  it('offers each source only the probes of its roles', () => {
    const seen: string[][] = [];
    const boxOnly: SnapSource = {
      id: 'box', roles: ['box'],
      collect(q) { seen.push(q.probes.map((p) => p.id)); return [{ probe: 'pointer', locus: { at: TARGET, dirs: [] } }]; },
    };
    const probes: SnapProbeAt[] = [
      { id: 'pointer', at: { x: 0, y: 0 }, role: 'pointer' },
      { id: 'box.min', at: { x: 0, y: 0 }, role: 'box' },
    ];
    const { s } = session({ req: { gesture: 'move' }, sources: [boxOnly], probes });
    const out = s.at({ x: 51, y: 49 }, FREE);
    expect(seen).toEqual([['box.min']]);
    // It answered for a probe it was not offered, which is dropped.
    expect(out.held).toBe(false);
    near(out.point, { x: 51, y: 49 });

    const pointOnly = vi.fn(() => []);
    session({ sources: [{ id: 'p', roles: ['box'], collect: pointOnly }] }).s.at({ x: 1, y: 1 }, FREE);
    expect(pointOnly).not.toHaveBeenCalled();
  });

  it('hands sources the probes where the unsnapped gesture puts them', () => {
    const at: Point[] = [];
    const spy: SnapSource = { id: 's', roles: ['pointer'], collect(q) { at.push(q.probes[0].at); return []; } };
    session({ req: { press: { x: 5, y: 5 } }, sources: [spy] }).s.at({ x: 12, y: 9 }, FREE);
    expect(at).toEqual([{ x: 12, y: 9 }]);
  });

  it('leaves rotate to sources that name it', () => {
    const collect = vi.fn(() => []);
    session({ req: { gesture: 'rotate' }, sources: [{ id: 's', roles: ['pointer'], collect }] }).s.at({ x: 1, y: 1 }, FREE);
    expect(collect).not.toHaveBeenCalled();
  });

  it('passes an angle through unchanged until angle snapping lands', () => {
    expect(session().s.angle(0.3, FREE)).toEqual({ theta: 0.3, marks: [] });
  });
});
