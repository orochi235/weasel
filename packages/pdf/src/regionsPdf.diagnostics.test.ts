/** What a PDF export reports drawing without, through core's common `onDiagnostic`, and its strict refusal. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExportIncompleteError, exportRegions, type ExportDiagnostic } from '@weasel-js/core';
import { plainScene } from '@weasel-js/core/testing/plainScene';
import { __setImageLoaderForTests, _resetImageCacheForTests } from '@weasel-js/renderer/test-seams';
import { exportRegionsPdf, registerPdfExport } from './regionsPdf';

const drops: (() => void)[] = [];
beforeEach(() => {
  _resetImageCacheForTests();
  __setImageLoaderForTests(async () => { throw new Error('404'); });
});
afterEach(() => {
  drops.splice(0).forEach((d) => d());
  _resetImageCacheForTests();
});

function withLostPicture() {
  const { scene, pages } = plainScene();
  scene.add({ id: 'i', kind: 'mark', layer: 'main', parent: null, pose: { x: 300, y: 10, width: 20, height: 20 }, data: { image: { src: '/gone.png' } } } as never);
  return { scene, pages };
}

describe('exportRegionsPdf diagnostics', () => {
  it('names a picture on a later page that failed to load, and still writes every page', async () => {
    const { scene, pages } = withLostPicture();
    const heard: ExportDiagnostic[] = [];
    const blob = await exportRegionsPdf(scene, pages, { compress: false, onDiagnostic: (d) => heard.push(d) });
    expect(blob.type).toBe('application/pdf');
    expect(heard).toEqual([expect.objectContaining({ kind: 'image', subject: '/gone.png' })]);
  });

  it('reports nothing for pages it writes whole', async () => {
    const { scene, pages } = plainScene();
    const heard: ExportDiagnostic[] = [];
    await exportRegionsPdf(scene, pages, { compress: false, onDiagnostic: (d) => heard.push(d) });
    expect(heard).toEqual([]);
  });

  it('writes nothing under strict, through the pdf format too', async () => {
    const { scene, pages } = withLostPicture();
    await expect(exportRegionsPdf(scene, pages, { compress: false, strict: true })).rejects.toBeInstanceOf(ExportIncompleteError);
    drops.push(registerPdfExport());
    await expect(exportRegions(scene, pages, 'pdf', { compress: false, strict: true })).rejects.toThrow(/\/gone\.png/);
  });
});
