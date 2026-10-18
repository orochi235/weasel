import { describe, expect, it } from 'vitest';
import { createScene, type Bounds, type Scene, type SnapSource } from '@weasel-js/core';
import { alignmentSnapSource } from './alignment';
import { gridSnapSource } from './grid';
import { spacingSnapSource } from './spacing';
import { moveBy } from './testing/session';

/** The resolver's default pool: the most candidates per probe it keeps. */
const POOL_SIZE = 24;

/** `source`, tallying what each frame offers each probe. */
function counted(source: SnapSource, tally: Map<string, number>): SnapSource {
  return {
    ...source,
    *collect(q) {
      for (const c of source.collect(q)) {
        tally.set(c.probe, (tally.get(c.probe) ?? 0) + 1);
        yield c;
      }
    },
  };
}

describe('snap sources over a crowded row', () => {
  const scene = createScene<object, 'default', Bounds>({ systemLayers: [{ id: 'default', visible: true, locked: false }] });
  for (let i = 0; i < 2000; i++) scene.add({ kind: 'leaf', layer: 'default', pose: { x: i * 20, y: 0, width: 10, height: 10 }, data: {} });
  const box: Bounds = { x: 20012, y: 0, width: 6, height: 10 };
  const moving = scene.add({ kind: 'leaf', layer: 'default', pose: box, data: {} });

  // The fastest of several passes: load on the machine only adds time, so
  // the minimum is the pass least disturbed by it.
  it('offers each probe no more than the resolver pools, and answers 100 frames in 200ms', () => {
    let worst = 0;
    const tally = new Map<string, number>();
    let fastest = Infinity;
    for (let pass = 0; pass < 5; pass++) {
      // Fresh sources each pass, so every pass pays for building their caches.
      const sources = [gridSnapSource({ spacing: 10 }), alignmentSnapSource(), spacingSnapSource()].map((s) => counted(s, tally));
      const start = performance.now();
      const m = moveBy({ sources, ids: [moving], scene: scene as unknown as Scene<unknown, string, unknown> });
      for (let i = 0; i < 100; i++) {
        tally.clear();
        m.by(i * 0.37, -i * 0.41);
        worst = Math.max(worst, ...tally.values());
      }
      fastest = Math.min(fastest, performance.now() - start);
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(POOL_SIZE);
    expect(fastest).toBeLessThan(200);
  });
});
