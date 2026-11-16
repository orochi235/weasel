/**
 * An export reads one revision of the document: edits made while what it
 * draws loads restart the read, and what it then draws is all of the later
 * revision, loaded.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DrawCommand } from '@weasel-js/renderer';
import { __setImageLoaderForTests, _resetImageCacheForTests } from '@weasel-js/renderer/test-seams';
import { asNodeId, createScene, type DerivedDep, type RectPose } from '@weasel-js/core';
import type { Path } from '@weasel-js/geom';
import { plainScene, RED, GREEN } from './testing/plainScene';
import { captureExport, EXPORT_CAPTURE_ATTEMPTS, ExportRevisionError } from './captureExport';
import { capturePngRegion } from './regionPng';
import { pageRegion } from './exportPages';
import { selectionRegion } from './selectionRegion';

const bitmap = (src: string) => ({ width: 4, height: 4, src, close() {} }) as unknown as ImageBitmap;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Image loads that wait until `release(src)`, unless `src` is quick. */
function heldLoads(quick: (src: string) => boolean = () => false) {
  const waiting = new Map<string, () => void>();
  __setImageLoaderForTests((src: string) => new Promise<ImageBitmap>((resolve) => {
    if (quick(src)) resolve(bitmap(src));
    else waiting.set(src, () => resolve(bitmap(src)));
  }));
  return { release: (src: string) => waiting.get(src)?.() };
}

/** Every solid fill color and every drawn image's source, in paint order. */
function drawn(commands: readonly DrawCommand[], out: string[] = []): string[] {
  for (const c of commands) {
    if (c.kind === 'group') drawn(c.children, out);
    else if (c.kind === 'image') out.push(`image:${(c.image as unknown as { src: string }).src}`);
    else if (c.kind === 'path' && c.fill?.paint?.kind === 'solid') out.push(c.fill.paint.color);
  }
  return out;
}

const solid = (color: string) => ({ paint: { kind: 'solid', color } });

beforeEach(() => _resetImageCacheForTests());
afterEach(() => _resetImageCacheForTests());

describe('captureExport', () => {
  it('reads what was edited, deleted and introduced while a picture loaded, with the new picture loaded', async () => {
    const { scene, pages } = plainScene();
    const loads = heldLoads((src) => src === 'new');
    scene.add({ id: 'i', kind: 'mark', layer: 'main', parent: null, pose: { x: 150, y: 10, width: 20, height: 20 }, data: { image: { src: 'slow' } } } as never);
    const plan = capturePngRegion(scene, pageRegion(pages[0]!), { scale: 1 });
    await tick();
    scene.update(asNodeId('r'), { data: { shape: 'rect', fill: solid(GREEN) } });
    scene.remove(asNodeId('e'));
    scene.add({ id: 'j', kind: 'mark', layer: 'main', parent: null, pose: { x: 10, y: 70, width: 20, height: 20 }, data: { image: { src: 'new' } } } as never);
    loads.release('slow');
    const colors = drawn((await plan).commands);
    expect(colors).toEqual(expect.arrayContaining([GREEN, 'image:slow', 'image:new']));
    expect(colors).not.toContain(RED);
    expect(colors.filter((c) => c === GREEN)).toHaveLength(1);
  });

  it('reads bounds given as a function of the document from the revision it draws', async () => {
    const { scene } = plainScene();
    const loads = heldLoads();
    scene.add({ id: 'i', kind: 'mark', layer: 'main', parent: null, pose: { x: 150, y: 10, width: 20, height: 20 }, data: { image: { src: 'slow' } } } as never);
    const seen: { x: number; width: number }[] = [];
    const read = captureExport(scene, (doc) => [selectionRegion(doc, ['r'])!], {
      warm: async (_doc, [r]) => { seen.push(r!); await new Promise<void>((done) => { setTimeout(done, 0); }); },
      read: (_doc, [r]) => r!,
    });
    scene.setPose(asNodeId('r'), { x: 30, y: 20, width: 90, height: 40 });
    loads.release('slow');
    expect(await read).toMatchObject({ x: 30, width: 90 });
    expect(seen.map((r) => r.x)).toEqual([20, 30]);
  });

  it('reads a registry-backed derived path from the revision it draws', async () => {
    const follow = (_node: unknown, deps: readonly (DerivedDep<RectPose> | undefined)[]): Path | null => {
      const dep = deps[0];
      return dep ? { kind: 'rect', x: dep.pose.x, y: dep.pose.y + 50, width: 5, height: 5 } : null;
    };
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: { derivePath: { follow } } });
    const a = scene.add({ id: 'a', kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { shape: 'rect', fill: solid(RED) } } as never);
    scene.add({ id: 'l', kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: { fill: solid(GREEN) }, dependsOn: [a], derivePath: follow } as never);
    let moved = false;
    const plan = captureExport(scene, [{ x: 0, y: 0, width: 200, height: 100 }], {
      warm: async () => { await tick(); if (!moved) { moved = true; scene.setPose(a, { x: 40, y: 0, width: 10, height: 10 }); } },
      read: (doc) => (doc.get(asNodeId('l')) as unknown as { derivePath: typeof follow }).derivePath(null, [{ pose: doc.get(a)!.pose } as never]),
    });
    expect(await plan).toMatchObject({ x: 40, y: 50 });
  });

  it('gives up with an ExportRevisionError when every attempt sees the document change', async () => {
    const { scene, pages } = plainScene();
    let warms = 0;
    let x = 21;
    const read = captureExport(scene, [pageRegion(pages[0]!)], {
      warm: async () => { warms++; await tick(); scene.setPose(asNodeId('r'), { x: x++, y: 20, width: 60, height: 40 }); },
      read: () => 'read',
    });
    await expect(read).rejects.toBeInstanceOf(ExportRevisionError);
    expect(warms).toBe(EXPORT_CAPTURE_ATTEMPTS);
  });

  it('restarts for no change of selection or of what a gesture shows', async () => {
    const { scene, pages } = plainScene();
    let warms = 0;
    const read = captureExport(scene, [pageRegion(pages[0]!)], {
      warm: async () => {
        warms++;
        await tick();
        scene.setSelection([asNodeId('r')]);
        scene.overrides.set(asNodeId('r'), { pose: { x: 0, y: 0, width: 1, height: 1 } } as never);
      },
      read: () => 'read',
    });
    expect(await read).toBe('read');
    expect(warms).toBe(1);
  });

  it('hands the read copies of fixed regions, so a caller editing its own does not reach it', async () => {
    const { scene } = plainScene();
    const region = { x: 1, y: 2, width: 3, height: 4 };
    const read = captureExport(scene, [region], { warm: tick, read: (_doc, [r]) => r! });
    region.x = 99;
    expect(await read).toEqual({ x: 1, y: 2, width: 3, height: 4 });
  });
});
