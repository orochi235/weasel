/** An SVG export writes one revision of the document: an edit made while a paint kind loads is written whole. */
import { afterEach, describe, expect, it } from 'vitest';
import { registerPaintKindLoader, type Paint } from '@weasel-js/core';
import { GREEN, plainScene, RED } from '@weasel-js/core/testing/plainScene';
import { exportRegionSvg } from './regionSvg';

const drops: (() => void)[] = [];
afterEach(() => drops.splice(0).forEach((d) => d()));

/** A paint kind whose load waits for `release()`. */
function heldKind(id: string) {
  let release = () => {};
  const loaded = new Promise<void>((r) => { release = r; });
  drops.push(registerPaintKindLoader(id, async () => {
    await loaded;
    return { id, label: id, seed: () => ({ kind: id }) as unknown as Paint, colorOf: () => undefined };
  }));
  return { release };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const solid = (color: string) => ({ paint: { kind: 'solid', color } });

describe('exportRegionSvg across an edit', () => {
  it('writes the revision the edit made, with what the edit introduced', async () => {
    const { scene, pages } = plainScene();
    const kind = heldKind('test:held');
    scene.add({ id: 'h', kind: 'mark', layer: 'main', parent: null, pose: { x: 150, y: 10, width: 20, height: 20 }, data: { shape: 'rect', fill: { paint: { kind: 'test:held' } } } } as never);
    const svg = exportRegionSvg(scene, pages[0]!);
    await tick();
    scene.update('r' as never, { data: { shape: 'rect', fill: solid(GREEN) } });
    scene.remove('e' as never);
    scene.add({ id: 'q', kind: 'mark', layer: 'main', parent: null, pose: { x: 10, y: 70, width: 20, height: 20 }, data: { shape: 'rect', fill: solid('#0000ff') } } as never);
    kind.release();
    const doc = new DOMParser().parseFromString(await svg, 'image/svg+xml');
    const fills = [...doc.querySelectorAll('path, rect, ellipse')].map((p) => p.getAttribute('fill'));
    expect(fills).toContain(GREEN);
    expect(fills).toContain('#0000ff');
    expect(fills).not.toContain(RED);
    expect(doc.querySelector('ellipse')).toBeNull();
  });

  it('reads a page placed by a function of the document as the revision it writes', async () => {
    const { scene } = plainScene();
    const kind = heldKind('test:held2');
    scene.add({ id: 'h', kind: 'mark', layer: 'main', parent: null, pose: { x: 150, y: 10, width: 20, height: 20 }, data: { shape: 'rect', fill: { paint: { kind: 'test:held2' } } } } as never);
    // From r's left edge across the page, so the held kind is in it.
    const svg = exportRegionSvg(scene, (doc) => ({ x: doc.get('r' as never)!.pose.x, y: 0, width: 200, height: 100 }));
    await tick();
    scene.setPose('r' as never, { x: 5, y: 6, width: 7, height: 8 });
    kind.release();
    const doc = new DOMParser().parseFromString(await svg, 'image/svg+xml');
    expect(doc.documentElement.getAttribute('viewBox')).toBe('5 0 200 100');
  });
});
