import { describe, expect, it } from 'vitest';
import { OUTPUT_GRID_KEY, createScene, type RectPose } from '@weasel-js/core';
import { exportPage, type ExportImage } from '../ditherDemoExport';
import {
  BARS, DOT_RULE, INITIAL_NODES, MODULE, outputGrid,
  type DitherLayer, type DitherNodeData,
} from '../ditherDemoScene';

const barcode = INITIAL_NODES.find((n) => n.data.mark === 'barcode')!;
const middle = barcode.pose.y + barcode.pose.height / 2;
const barModules = BARS.filter((_, i) => i % 2 === 0);

/** The ink runs' lengths along the row through the bars' middle, from just left of them. */
function barRuns(image: ExportImage, pitch: number): number[] {
  const row = Math.floor(middle / pitch);
  const runs: number[] = [];
  let run = 0;
  for (let x = Math.floor((barcode.pose.x - 4) / pitch); x < image.width; x++) {
    if (image.data[(row * image.width + x) * 4]! < 128) run++;
    else if (run > 0) { runs.push(run); run = 0; }
  }
  if (run > 0) runs.push(run);
  return runs;
}

const sceneOn = (dpi: number | null) => createScene<DitherNodeData, DitherLayer, RectPose>({
  systemLayers: [{ id: 'art' }, { id: 'marks' }],
  initial: INITIAL_NODES,
  ...(dpi === null ? {} : { quantize: DOT_RULE, doc: { [OUTPUT_GRID_KEY]: outputGrid(dpi) } }),
});

describe('the dither export of a document on the output grid', () => {
  for (const dpi of [180, 300]) {
    it(`prints every bar its modules times one dot count at ${dpi} dpi`, async () => {
      const grid = outputGrid(dpi);
      const perModule = Math.max(1, Math.round(MODULE / grid.pitch));
      const image = await exportPage(sceneOn(dpi), { grid, method: 'threshold', threshold: 128, crisp: 'layer' });
      expect(barRuns(image, grid.pitch)).toEqual(barModules.map((m) => m * perModule));
    });
  }

  it('prints one-module bars at unequal widths from the document as drawn', async () => {
    const grid = outputGrid(180);
    const image = await exportPage(sceneOn(null), { grid, method: 'threshold', threshold: 128, crisp: 'layer' });
    const runs = barRuns(image, grid.pitch);
    expect(runs).toHaveLength(barModules.length);
    expect(new Set(runs.filter((_, i) => barModules[i] === 1)).size).toBeGreaterThan(1);
  });
});
