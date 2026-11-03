import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { exportPage, type ExportImage } from '../ditherDemoExport';
import {
  INITIAL_NODES, MODULE, outputGrid, snapMarks,
  type DitherLayer, type DitherNodeData,
} from '../ditherDemoScene';

const bars = INITIAL_NODES.filter((n) => n.data.mark === 'bar');
const left = Math.min(...bars.map((n) => n.pose.x));
const middle = bars[0]!.pose.y + bars[0]!.pose.height / 2;
const modules = bars.map((n) => Math.round(n.pose.width / MODULE));

/** The ink runs' lengths along the row through the bars' middle, from just left of them. */
function barRuns(image: ExportImage, pitch: number): number[] {
  const row = Math.floor(middle / pitch);
  const runs: number[] = [];
  let run = 0;
  for (let x = Math.floor((left - 4) / pitch); x < image.width; x++) {
    if (image.data[(row * image.width + x) * 4]! < 128) run++;
    else if (run > 0) { runs.push(run); run = 0; }
  }
  if (run > 0) runs.push(run);
  return runs;
}

const scene = createScene<DitherNodeData, DitherLayer, RectPose>({
  systemLayers: [{ id: 'art' }, { id: 'marks' }],
  initial: INITIAL_NODES,
});

describe('the dither export with marks snapped', () => {
  for (const dpi of [180, 300]) {
    it(`prints every bar its modules times one dot count at ${dpi} dpi`, async () => {
      const grid = outputGrid(dpi);
      const perModule = Math.max(1, Math.round(MODULE / grid.pitch));
      const image = await exportPage(scene, {
        grid, method: 'threshold', threshold: 128, crisp: 'layer', poses: snapMarks(INITIAL_NODES, grid),
      });
      expect(barRuns(image, grid.pitch)).toEqual(modules.map((m) => m * perModule));
    });
  }

  it('prints one-module bars at unequal widths when they are drawn as they are', async () => {
    const grid = outputGrid(180);
    const image = await exportPage(scene, { grid, method: 'threshold', threshold: 128, crisp: 'layer' });
    const runs = barRuns(image, grid.pitch);
    expect(runs).toHaveLength(modules.length);
    expect(new Set(runs.filter((_, i) => modules[i] === 1)).size).toBeGreaterThan(1);
  });
});
