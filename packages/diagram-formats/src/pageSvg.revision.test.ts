/** A page export placed by `pageRegionOf` reads the page's bounds from the revision it draws. */
import { afterEach, describe, expect, it } from 'vitest';
import { registerPaintKindLoader } from '@weasel-js/paint-kinds';
import { addOnPages, movePage, removePage, type Paint } from '@weasel-js/core';
import { pageRegionOf, pageRegionsOf } from '@weasel-js/export';
import { plainScene } from '@weasel-js/export/testing/plainScene';
import { exportPageSvg, exportPagesPdf } from './pageSvg';

const drops: (() => void)[] = [];
afterEach(() => drops.splice(0).forEach((d) => d()));

/** Page 2 of the plain scene holding a rect filled in a paint kind whose load waits for `release()`. */
function heldOnPageTwo(kind: string) {
  let release = () => {};
  const loaded = new Promise<void>((r) => { release = r; });
  drops.push(registerPaintKindLoader(kind, async () => {
    await loaded;
    return { id: kind, label: kind, seed: () => ({ kind }) as unknown as Paint, colorOf: () => undefined };
  }));
  const { scene, pages } = plainScene();
  addOnPages(scene, [{
    id: 'h', kind: 'mark', layer: 'main', pose: { x: 300, y: 70, width: 20, height: 20 }, data: { shape: 'rect', fill: { paint: { kind } } },
  }] as never);
  return { scene, pages, release };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('page exports across a page move', () => {
  it('writes the page where the document has moved it while the export loaded', async () => {
    const { scene, pages, release } = heldOnPageTwo('test:held-page');
    expect(pages[1]!.x).toBe(240);
    const svg = exportPageSvg(scene, pageRegionOf(pages[1]!), { background: null });
    await tick();
    movePage(scene, 'p2', 0);
    release();
    const doc = new DOMParser().parseFromString(await svg, 'image/svg+xml');
    expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 200 100');
  });

  it('fails a PDF of pages one of which the document lost while the export loaded', async () => {
    const { scene, pages, release } = heldOnPageTwo('test:held-pages');
    const pdf = exportPagesPdf(scene, pageRegionsOf(pages), { background: null, compress: false });
    await tick();
    removePage(scene, 'p2');
    release();
    await expect(pdf).rejects.toThrow(/no page "p2"/);
  });
});
