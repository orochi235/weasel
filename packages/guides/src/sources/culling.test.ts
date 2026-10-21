import { describe, expect, it } from 'vitest';
import { createScene, type Bounds, type Scene, type SnapSource } from '@weasel-js/core';
import { alignmentSnapSource } from './alignment';
import { gridSnapSource } from './grid';
import { spacingSnapSource } from './spacing';
import { moveBy } from './testing/session';

/** The resolver's default pool: the most candidates per probe it keeps. */
const POOL_SIZE = 24;

/** What a frame cost: candidates offered per probe, and target boxes measured. */
interface Tally { offered: Map<string, number>; measured: number }

/** `source`, tallying what each frame offers each probe and each box it measures. */
function counted(source: SnapSource, tally: Tally): SnapSource {
  return {
    ...source,
    *collect(q) {
      const drawnBox = q.drawnBox;
      const measuring = drawnBox ? { ...q, drawnBox: (id: string) => (tally.measured++, drawnBox(id)) } : q;
      for (const c of source.collect(measuring)) {
        tally.offered.set(c.probe, (tally.offered.get(c.probe) ?? 0) + 1);
        yield c;
      }
    },
  };
}

describe('snap sources over a crowded row', () => {
  const COUNT = 2000;
  const scene = createScene<object, 'default', Bounds>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
  for (let i = 0; i < COUNT; i++) scene.add({ kind: 'leaf', layer: 'default', pose: { x: i * 20, y: 0, width: 10, height: 10 }, data: {} });
  const box: Bounds = { x: 20012, y: 0, width: 6, height: 10 };
  const moving = scene.add({ kind: 'leaf', layer: 'default', pose: box, data: {} });

  // Measuring the row is the quadratic part; a frame that re-measured it
  // would make a drag cost the whole scene every pointer move.
  it('offers each probe no more than the resolver pools, and measures the row once per source, not per frame', () => {
    const tally: Tally = { offered: new Map(), measured: 0 };
    const sceneSources = [alignmentSnapSource(), spacingSnapSource()];
    const sources = [gridSnapSource({ spacing: 10 }), ...sceneSources].map((s) => counted(s, tally));
    const m = moveBy({ sources, ids: [moving], scene: scene as unknown as Scene<unknown, string, unknown> });
    let worst = 0;
    const measuredPerFrame: number[] = [];
    for (let i = 0; i < 100; i++) {
      tally.offered.clear();
      tally.measured = 0;
      m.by(i * 0.37, -i * 0.41);
      worst = Math.max(worst, ...tally.offered.values());
      measuredPerFrame.push(tally.measured);
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(POOL_SIZE);
    expect(measuredPerFrame[0]).toBe(sceneSources.length * COUNT);
    expect(Math.max(...measuredPerFrame.slice(1))).toBe(0);
  });
});
