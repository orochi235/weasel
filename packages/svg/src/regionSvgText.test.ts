import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addOnPages, boundsOfPath, createPageRun, createScene, pathFromD, placedPagesOf, type RectPose,
} from '@weasel-js/core';
import { registerFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontOutlinesForTests, _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { exportRegionSvg } from './regionSvg';

const BARS: OutlineFace = {
  unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.6, kernOf: () => 0, glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};

const BOX = { x: 20, y: 20, width: 120, height: 60 };

function headline() {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const data = {
    text: 'HEADLINE', style: { fontFamily: 'bars', fontSize: 100 },
    fill: { paint: { kind: 'solid', color: '#000' } }, fit: 'shrink',
  };
  scene.untracked(() => scene.batch('Load', () => {
    createPageRun(scene, [{ id: 'p1', width: 200, height: 100 }]);
    addOnPages(scene, [{ id: 't', kind: 'mark', layer: 'main', pose: BOX, data }] as never);
  }));
  return { scene, page: placedPagesOf(scene)[0]! };
}

beforeEach(() => {
  registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => BARS });
});
afterEach(() => {
  _resetFontOutlinesForTests();
  _resetFontRegistryForTests();
  _resetLayoutCacheForTests();
});

describe("exportRegionSvg's text modes", () => {
  it('writes live text by default', async () => {
    const { scene, page } = headline();
    expect(await exportRegionSvg(scene, page)).toContain('<text');
  });

  it("writes a shrink-to-fit headline as outlines inside its box with text: 'outline'", async () => {
    const { scene, page } = headline();
    const warnings: string[] = [];
    const svg = await exportRegionSvg(scene, page, { text: 'outline', onWarn: (m) => warnings.push(m) });
    expect(warnings).toEqual([]);
    expect(svg).not.toContain('<text');
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const ds = [...doc.querySelectorAll('path')].map((p) => p.getAttribute('d')!).filter(Boolean);
    expect(ds.length).toBeGreaterThan(0);
    const b = boundsOfPath(pathFromD(ds.join(' ')));
    expect(b.x).toBeGreaterThanOrEqual(BOX.x - 1e-6);
    expect(b.x + b.width).toBeLessThanOrEqual(BOX.x + BOX.width + 1e-6);
    expect(b.y + b.height).toBeLessThanOrEqual(BOX.y + BOX.height + 1e-6);
  });
});
