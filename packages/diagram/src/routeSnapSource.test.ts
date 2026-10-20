import { describe, expect, it } from 'vitest';
import type { SnapCollect, SnapMark, SourceCandidate } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { routeSnapSource } from './routeSnapSource';
import type { Port } from './types';

const port = (point: Vec2, normal: Vec2 | null): Port => ({ id: 'p', nodeId: 'n', point, normal });

/** The candidates `source` offers a pointer probe at `at`, with the raw move `delta0`. */
function collect(source: ReturnType<typeof routeSnapSource>, at: Vec2, delta0: Vec2 = { x: 0, y: 0 }): SourceCandidate[] {
  const q = {
    gesture: 'point',
    probes: [{ id: 'pointer', at, role: 'pointer' }],
    delta0,
    exclude: [],
    reachPx: source.reachPx!,
    reachWorld: (px: number) => px,
  } as SnapCollect;
  return [...source.collect(q)];
}

const loci = (cs: readonly SourceCandidate[]) => cs.map((c) => c.locus);

describe('routeSnapSource', () => {
  it('is a pointer target for point gestures, reaching as far as it is told', () => {
    const s = routeSnapSource({ id: 'diagram-route', stops: [], ports: [], reachPx: 6 });
    expect(s).toMatchObject({ id: 'diagram-route', tier: 'target', roles: ['pointer'], gestures: ['point'], reachPx: 6 });
  });

  it('offers a line through a stop on each axis within reach', () => {
    const s = routeSnapSource({ id: 'r', stops: [{ x: 100, y: 50 }], ports: [], reachPx: 6 });
    expect(loci(collect(s, { x: 104, y: 53 }))).toEqual([
      { at: { x: 100, y: 53 }, dirs: [{ x: 0, y: 1 }] },
      { at: { x: 104, y: 50 }, dirs: [{ x: 1, y: 0 }] },
    ]);
    expect(loci(collect(s, { x: 104, y: 60 }))).toEqual([{ at: { x: 100, y: 60 }, dirs: [{ x: 0, y: 1 }] }]);
  });

  it('lines a port up along its axis only, and on both when it faces nowhere', () => {
    const east = routeSnapSource({ id: 'r', stops: [], ports: [port({ x: 100, y: 50 }, { x: 1, y: 0 })], reachPx: 6 });
    expect(loci(collect(east, { x: 102, y: 52 }))).toEqual([{ at: { x: 102, y: 50 }, dirs: [{ x: 1, y: 0 }] }]);
    const south = routeSnapSource({ id: 'r', stops: [], ports: [port({ x: 100, y: 50 }, { x: 0, y: 1 })], reachPx: 6 });
    expect(loci(collect(south, { x: 102, y: 52 }))).toEqual([{ at: { x: 100, y: 52 }, dirs: [{ x: 0, y: 1 }] }]);
    const bare = routeSnapSource({ id: 'r', stops: [], ports: [port({ x: 100, y: 50 }, null)], reachPx: 6 });
    expect(collect(bare, { x: 102, y: 52 })).toHaveLength(2);
  });

  it('marks a line from the target to where the probe lands', () => {
    const s = routeSnapSource({ id: 'r', stops: [{ x: 100, y: 20 }], ports: [], reachPx: 6 });
    const [onX] = collect(s, { x: 104, y: 97 }, { x: -96, y: -3 });
    const mark = onX!.mark as (delta: Vec2) => SnapMark;
    expect(mark({ x: -100, y: -3 })).toEqual({ kind: 'line', from: { x: 100, y: 20 }, to: { x: 100, y: 97 } });
  });
});
