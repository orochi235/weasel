import { afterEach, describe, expect, it } from 'vitest';
import { exportFormats, exportRegions, registerNodeShape, type NodeShapeEntry, type RectPose } from '@weasel-js/core';
import { BLUE, GRAY, GREEN, RED, plainScene } from '@weasel-js/core/testing/plainScene';
import { exportRegionSvg, registerSvgExport } from './regionSvg';

async function exported(pageIndex: number, opts?: Parameters<typeof exportRegionSvg>[2]): Promise<Document> {
  const { scene, pages } = plainScene();
  const svg = await exportRegionSvg(scene, pages[pageIndex]!, opts);
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

const fills = (doc: Document): string[] =>
  [...doc.querySelectorAll('path, rect, ellipse')].map((p) => p.getAttribute('fill') ?? '');

const PURPLE = '#800080';
const STAR: NodeShapeEntry<unknown, RectPose> = {
  id: 'test:star',
  matches: (node) => (node.data as { star?: boolean } | undefined)?.star === true,
  paint: (_node, pose) => [{
    kind: 'path',
    path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width / 2, height: pose.height / 2 },
    fill: { paint: { kind: 'solid', color: PURPLE } },
  }],
};

let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); dispose = undefined; });

describe('exportRegionSvg', () => {
  it('views exactly the page, at the page size', async () => {
    const root = (await exported(1)).documentElement;
    expect(root.getAttribute('viewBox')).toBe('240 0 200 100');
    expect(root.getAttribute('width')).toBe('200');
    expect(root.getAttribute('height')).toBe('100');
  });

  it('draws what meets the page and leaves out what is off it', async () => {
    expect(fills(await exported(0))).toEqual(expect.arrayContaining([RED, GREEN]));
    expect(fills(await exported(0))).not.toContain(BLUE);
    expect(fills(await exported(1))).toContain(BLUE);
    expect(fills(await exported(1))).not.toContain(RED);
  });

  it('writes each node where the canvas draws it', async () => {
    const doc = await exported(1);
    const path = [...doc.querySelectorAll('path')].find((p) => p.getAttribute('fill') === BLUE)!;
    expect(path.getAttribute('d')).toMatch(/^M300 30/);
  });

  it('paints no background unless given one', async () => {
    expect(fills(await exported(0))).toHaveLength(2);
    expect(fills(await exported(0, { background: '#fafafa' }))[0]).toBe('#fafafa');
  });

  it('leaves out annotation layers', async () => {
    expect(fills(await exported(0))).not.toContain(GRAY);
  });

  it('draws a node a registered painter claims with that painter', async () => {
    const { scene, pages } = plainScene();
    scene.update('r' as never, { data: { star: true } });
    dispose = registerNodeShape(STAR);
    const doc = new DOMParser().parseFromString(await exportRegionSvg(scene, pages[0]!), 'image/svg+xml');
    expect(fills(doc)).toContain(PURPLE);
    expect(fills(doc)).not.toContain(RED);
  });

  it('asks the painters it is given before the registered ones', async () => {
    const { scene, pages } = plainScene();
    scene.update('r' as never, { data: { star: true } });
    const doc = new DOMParser().parseFromString(await exportRegionSvg(scene, pages[0]!, { painters: [STAR] }), 'image/svg+xml');
    expect(fills(doc)).toContain(PURPLE);
  });
});

describe('exportRegionSvg on a region that is not a page', () => {
  it('draws what meets the region, from both pages, and titles it with the region name', async () => {
    const { scene } = plainScene();
    const region = { x: 60, y: 0, width: 260, height: 100, name: 'Middle' };
    const doc = new DOMParser().parseFromString(await exportRegionSvg(scene, region), 'image/svg+xml');
    expect(doc.documentElement.getAttribute('viewBox')).toBe('60 0 260 100');
    expect(fills(doc)).toEqual(expect.arrayContaining([RED, GREEN, BLUE]));
    expect(doc.querySelector('title')?.textContent).toBe('Middle');
  });
});

describe('registerSvgExport', () => {
  it('registers the svg format, which writes one region as an SVG blob', async () => {
    dispose = registerSvgExport();
    expect(exportFormats().map((f) => f.id)).toContain('svg');
    const { scene, pages } = plainScene();
    const blob = await exportRegions(scene, [pages[1]!], 'svg', { background: '#fafafa' });
    expect(blob.type).toBe('image/svg+xml');
    const doc = new DOMParser().parseFromString(await blob.text(), 'image/svg+xml');
    expect(fills(doc)).toEqual(['#fafafa', BLUE]);
  });

  it('is gone once disposed', () => {
    registerSvgExport()();
    expect(exportFormats().map((f) => f.id)).not.toContain('svg');
  });
});
