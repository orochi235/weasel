/**
 * What `outline.mask` adds to building the selection overlay, on one node
 * under a few hundred overlapping nodes painted after it. Run as one vitest test:
 * `npx vitest run --config tests/perf/vitest.scene-bench.config.ts --reporter=default packages/editing/src/chrome/outlineMask.bench.ts`.
 * Interleaves rounds of each case, printing one JSON line per round; set
 * `OUTLINE_MASK_BENCH_OUT` to also append them to that file.
 *
 * - `off cold` / `on cold`: a fresh layer's first draw, the outline's edge and the mask built.
 * - `off warm` / `on warm`: a redraw with nothing changed.
 * - `on edit`: a redraw after an edit elsewhere in the scene moves its version.
 */
import { appendFileSync } from 'node:fs';
import { cpus, hostname, loadavg } from 'node:os';
import { expect, it } from 'vitest';
import { createScene, asNodeId, type RectPose } from '@weasel-js/core/engine';
import { createSelectionOverlayLayer } from './overlay';

const GRID = 20;
const STEP = 25;
const SIDE = 40;
const ROUNDS = 15;
const DIMS = { width: 800, height: 800, dpr: 1 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function sceneOf(shape: 'rect' | 'ellipse') {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const fill = { paint: { kind: 'solid', color: '#f00' } };
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'main', data: { shape, fill }, pose: { x: 100, y: 100, width: 300, height: 300 } } as never);
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      scene.add({
        id: asNodeId(`n${i}-${j}`), kind: 'mark', layer: 'main', data: { shape, fill },
        pose: { x: i * STEP, y: j * STEP, width: SIDE, height: SIDE },
      } as never);
    }
  }
  scene.add({ id: asNodeId('far'), kind: 'mark', layer: 'main', data: { shape, fill }, pose: { x: 2000, y: 2000, width: 10, height: 10 } } as never);
  return scene;
}

function layerFor(scene: ReturnType<typeof sceneOf>, mask: boolean) {
  return createSelectionOverlayLayer<RectPose>({
    getSelection: () => [asNodeId('a')],
    getPose: (id) => scene.get(asNodeId(id))!.pose,
    scene,
    handles: false,
    outline: { width: 2, follow: 'shape', mask },
  });
}

const time = (f: () => void): number => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

it('times the overlay with outline.mask off and on', () => {
  const out = process.env.OUTLINE_MASK_BENCH_OUT;
  const machine = { host: hostname(), cpus: cpus().length, cpu: cpus()[0]?.model, load: loadavg() };
  const total = ROUNDS * 2;
  let n = 0;
  for (const shape of ['rect', 'ellipse'] as const) {
    const scene = sceneOf(shape);
    for (let r = 0; r < ROUNDS; r++) {
      const off = layerFor(scene, false);
      const on = layerFor(scene, true);
      const ms = {
        'off cold': time(() => off.draw(undefined, VIEW, DIMS)),
        'off warm': time(() => off.draw(undefined, VIEW, DIMS)),
        'on cold': time(() => on.draw(undefined, VIEW, DIMS)),
        'on warm': time(() => on.draw(undefined, VIEW, DIMS)),
        'on edit': (scene.setPose(asNodeId('far'), { x: 2001 + r, y: 2000, width: 10, height: 10 }),
          time(() => on.draw(undefined, VIEW, DIMS))),
      };
      const cmds = on.draw(undefined, VIEW, DIMS);
      expect(cmds.some((c) => c.kind === 'group' && c.clip)).toBe(true);
      const line = JSON.stringify({
        date: new Date().toISOString(), machine, shape, occluders: GRID * GRID, round: r, ms,
      });
      process.stdout.write(`${++n}/${total} ${line}\n`);
      if (out) appendFileSync(out, `${line}\n`);
    }
  }
}, 600_000);
