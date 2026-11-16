/**
 * What an export reports drawing without, through the one `onDiagnostic` every format takes, and
 * how `strict` refuses to write a file that would lack it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DrawCommand } from '@weasel-js/renderer';
import { registerProgram } from '@weasel-js/renderer';
import { __setImageLoaderForTests, _resetImageCacheForTests, _resetProgramRegistryForTests } from '@weasel-js/renderer/test-seams';
import { FIXTURE_FONT, registerFont } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { registerNodeShape, type NodeShapeEntry, type RectPose, type RenderDiagnostic } from '@weasel-js/core';
import { plainScene } from './testing/plainScene';
import { exportRegions } from './exportFormats';
import { exportReporter, ExportIncompleteError } from './exportDiagnostics';
import { capturePngRegion, exportRegionPng } from './regionPng';

const drops: (() => void)[] = [];
beforeEach(() => {
  _resetImageCacheForTests();
  _resetFontRegistryForTests();
  _resetProgramRegistryForTests();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/broken')) throw new Error('offline');
    return { ok: true, json: async () => FIXTURE_FONT, blob: async () => new Blob(['PNG']) };
  }));
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4, height: 4, close() {} })));
});
afterEach(() => {
  drops.splice(0).forEach((d) => d());
  vi.unstubAllGlobals();
  _resetImageCacheForTests();
  _resetFontRegistryForTests();
  _resetProgramRegistryForTests();
});

/** A painter drawing what `draws` says for every node whose data is `{ lossy: true }`. */
function lossyPainter(draws: (pose: RectPose) => DrawCommand[]): void {
  const painter: NodeShapeEntry<unknown, RectPose> = {
    id: 'test:lossy',
    matches: (node) => (node.data as { lossy?: boolean } | undefined)?.lossy === true,
    paint: (_node, pose) => draws(pose),
  };
  drops.push(registerNodeShape(painter, { priority: 'high' }));
}

function lossyScene() {
  const { scene, pages } = plainScene();
  scene.add({ id: 'x', kind: 'mark', layer: 'main', parent: null, pose: { x: 150, y: 10, width: 20, height: 20 }, data: { lossy: true } } as never);
  return { scene, page: pages[0]! };
}

const heardIn = async (scene: ReturnType<typeof lossyScene>['scene'], page: ReturnType<typeof lossyScene>['page']) => {
  const heard: RenderDiagnostic[] = [];
  await capturePngRegion(scene, page, { scale: 1 }, exportReporter({ onDiagnostic: (d) => heard.push(d) }).report);
  return heard;
};

describe('raster export diagnostics', () => {
  it('names a picture that failed to load, once', async () => {
    __setImageLoaderForTests(async () => { throw new Error('404'); });
    const { scene, page } = lossyScene();
    scene.add({ id: 'i', kind: 'mark', layer: 'main', parent: null, pose: { x: 10, y: 70, width: 20, height: 20 }, data: { image: { src: '/gone.png' } } } as never);
    scene.add({ id: 'k', kind: 'mark', layer: 'main', parent: null, pose: { x: 40, y: 70, width: 20, height: 20 }, data: { image: { src: '/gone.png' } } } as never);
    lossyPainter(() => []);
    expect(await heardIn(scene, page)).toEqual([expect.objectContaining({ kind: 'image', subject: '/gone.png' })]);
  });

  it('names a face that failed to load, a paint kind nothing registered, and a program with no GLSL', async () => {
    registerFont('lost', {}, '/broken.json', '/broken.png', { lazy: true }).catch(() => {});
    const wgslOnly = registerProgram('test:wgsl-only', { wgsl: { frag: 'fn fragment(in: Varyings) -> vec4f { return vec4f(1.0); }' } });
    const { scene, page } = lossyScene();
    lossyPainter((pose) => [
      { kind: 'text', x: pose.x, y: pose.y, style: {} as never, runs: [{ text: 'Hi', fontFamily: 'lost', fontSize: 12, fontWeight: 400, fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#000' } } }] as never },
      { kind: 'path', path: { kind: 'rect', x: pose.x, y: pose.y, width: 5, height: 5 }, fill: { paint: { kind: 'test:nothing' } as never } },
      { kind: 'shader', program: wgslOnly, uniforms: {}, bounds: { x: 0, y: 0, w: 5, h: 5 } },
    ]);
    const heard = await heardIn(scene, page);
    expect(heard.map((d) => [d.kind, d.subject])).toEqual(expect.arrayContaining([
      ['font', 'lost'], ['paint-kind', 'test:nothing'], ['shader', 'test:wgsl-only'],
    ]));
    expect(heard).toHaveLength(3);
    for (const d of heard) expect(d.message).toContain(d.subject);
  });

  it('reports nothing for a complete export', async () => {
    const { scene, pages } = plainScene();
    const heard: RenderDiagnostic[] = [];
    await capturePngRegion(scene, pages[0]!, { scale: 1 }, (d) => heard.push(d));
    expect(heard).toEqual([]);
  });

  it('writes nothing under strict, and rejects with every diagnostic, through the png format too', async () => {
    __setImageLoaderForTests(async () => { throw new Error('404'); });
    const { scene, page } = lossyScene();
    lossyPainter(() => []);
    scene.add({ id: 'i', kind: 'mark', layer: 'main', parent: null, pose: { x: 10, y: 70, width: 20, height: 20 }, data: { image: { src: '/gone.png' } } } as never);
    const heard: RenderDiagnostic[] = [];
    const strict = exportRegionPng(scene, page, { scale: 1, strict: true, onDiagnostic: (d) => heard.push(d) });
    await expect(strict).rejects.toBeInstanceOf(ExportIncompleteError);
    await strict.catch((err: ExportIncompleteError) => expect(err.diagnostics).toEqual(heard));
    expect(heard).toHaveLength(1);
    await expect(exportRegions(scene, [page], 'png', { strict: true })).rejects.toThrow(/\/gone\.png/);
  });
});

describe('exportReporter', () => {
  it('hands each diagnostic on once, and throws on settle only when strict and something was heard', () => {
    const d: RenderDiagnostic = { kind: 'font', subject: 'serif', message: 'the font serif did not load' };
    const heard: RenderDiagnostic[] = [];
    const lenient = exportReporter({ onDiagnostic: (x) => heard.push(x) });
    lenient.report(d);
    lenient.report({ ...d });
    expect(heard).toEqual([d]);
    expect(() => lenient.settle()).not.toThrow();
    const strict = exportReporter({ strict: true });
    expect(() => strict.settle()).not.toThrow();
    strict.report(d);
    expect(() => strict.settle()).toThrow(ExportIncompleteError);
  });
});
