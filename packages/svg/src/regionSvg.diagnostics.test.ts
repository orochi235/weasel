/** What an SVG export reports drawing without, through `@weasel-js/export`'s common `onDiagnostic`, and its strict refusal. */
import { afterEach, describe, expect, it } from 'vitest';
import { registerPaintKindLoader } from '@weasel-js/paint-kinds';
import { registerNodeShape, type NodeShapeEntry, type RectPose } from '@weasel-js/core';
import { ExportIncompleteError, exportRegions, type ExportDiagnostic } from '@weasel-js/export';
import { plainScene } from '@weasel-js/export/testing/plainScene';
import { exportRegionSvg, registerSvgExport } from './regionSvg';

const drops: (() => void)[] = [];
afterEach(() => drops.splice(0).forEach((d) => d()));

/** A scene whose node `x` is drawn by a painter emitting a shader command SVG cannot hold, and whose node `k` is filled in a kind whose load fails. */
function lossy() {
  const painter: NodeShapeEntry<unknown, RectPose> = {
    id: 'test:shader',
    matches: (node) => (node.data as { shaded?: boolean } | undefined)?.shaded === true,
    paint: () => [{ kind: 'shader', program: { id: 'test:glow' }, uniforms: {}, bounds: { x: 0, y: 0, width: 5, height: 5 } }],
  };
  drops.push(registerNodeShape(painter, { priority: 'high' }));
  drops.push(registerPaintKindLoader('test:offline', async () => { throw new Error('offline'); }));
  const { scene, pages } = plainScene();
  scene.add({ id: 'x', kind: 'mark', layer: 'main', parent: null, pose: { x: 150, y: 10, width: 20, height: 20 }, data: { shaded: true } } as never);
  scene.add({ id: 'k', kind: 'mark', layer: 'main', parent: null, pose: { x: 10, y: 70, width: 20, height: 20 }, data: { shape: 'rect', fill: { paint: { kind: 'test:offline' } } } } as never);
  return { scene, page: pages[0]! };
}

describe('exportRegionSvg diagnostics', () => {
  it('reports a paint kind that failed to load and a command SVG cannot hold, each once, and still writes the file', async () => {
    const { scene, page } = lossy();
    const heard: ExportDiagnostic[] = [];
    const svg = await exportRegionSvg(scene, page, { onDiagnostic: (d) => heard.push(d) });
    expect(svg).toContain('<svg');
    expect(heard).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'paint-kind', subject: 'test:offline' }),
      expect.objectContaining({ kind: 'unsupported', message: expect.stringContaining('shader') }),
    ]));
    expect(new Set(heard.map((d) => d.message)).size).toBe(heard.length);
  });

  it('reports nothing for a document it writes whole', async () => {
    const { scene, pages } = plainScene();
    const heard: ExportDiagnostic[] = [];
    await exportRegionSvg(scene, pages[0]!, { onDiagnostic: (d) => heard.push(d) });
    expect(heard).toEqual([]);
  });

  it('writes nothing under strict, through the svg format too', async () => {
    const { scene, page } = lossy();
    await expect(exportRegionSvg(scene, page, { strict: true })).rejects.toBeInstanceOf(ExportIncompleteError);
    drops.push(registerSvgExport());
    await expect(exportRegions(scene, [page], 'svg', { strict: true })).rejects.toThrow(/test:offline/);
  });
});
