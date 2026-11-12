import { afterEach, describe, expect, it, vi } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { registerFont } from '@weasel-js/font';
import { withDiagramRegistry } from './edge';
import { installFaceRemeasure } from './faceRemeasure';
import { diagramScene, type DiagramData } from './fromData';
import { rendererMeasure } from './rendererMeasure';

/** Two glyphs, wide enough that a body sized without them is visibly too small. */
const FACE = {
  info: { face: 'Lazy', size: 32 },
  common: { lineHeight: 38, base: 29, scaleW: 512, scaleH: 512 },
  chars: [
    { id: 65, x: 0, y: 0, width: 22, height: 28, xoffset: 1, yoffset: 4, xadvance: 40, page: 0 },
    { id: 66, x: 24, y: 0, width: 20, height: 28, xoffset: 2, yoffset: 4, xadvance: 40, page: 0 },
  ],
  kernings: [],
};

/** Serves the face's files, holding the metrics back until `land` is called. */
function heldFace(): { land: () => void } {
  let land!: () => void;
  const held = new Promise<void>((r) => { land = r; });
  const realFetch = global.fetch;
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.endsWith('.json')) return held.then(() => ({ ok: true, json: () => Promise.resolve(FACE) }));
    if (url.endsWith('.png')) return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['PNG'])) });
    return realFetch(url);
  }));
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 512, height: 512, close: () => {} })));
  return { land };
}

afterEach(() => vi.unstubAllGlobals());

const DATA: DiagramData = { nodes: [{ id: 'n', at: { x: 0, y: 0 }, rows: [{ kind: 'label', text: 'ABABABAB' }] }], edges: [] };
const OPTS = { layout: 'none' as const, font: { fontFamily: 'LazyRemeasure', fontSize: 32 }, measure: rendererMeasure };
const widthOf = (pose: unknown): number => (pose as RectPose).width;

describe('a body committed while its face is pending', () => {
  it('is sized for the face once the face loads', async () => {
    const { land } = heldFace();
    const landed = registerFont('LazyRemeasure', {}, '/lazy.json', '/lazy.png', { lazy: true });
    const specs = diagramScene(DATA, OPTS);
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), initial: specs as never });
    const off = installFaceRemeasure(scene, { measure: rendererMeasure });
    const pending = widthOf(scene.get('n' as never)!.pose);

    land();
    await landed;
    await Promise.resolve();

    const fitted = widthOf(diagramScene(DATA, OPTS).find((s) => s.id === ('n' as never))!.pose);
    expect(fitted).toBeGreaterThan(pending);
    expect(widthOf(scene.get('n' as never)!.pose)).toBe(fitted);
    const row = scene.childrenOf('n' as never).map((id) => scene.get(id)!).find((c) => (c.data as { bodyRow?: number }).bodyRow === 0)!;
    expect(widthOf(row.pose)).toBe(fitted - 16);
    expect(scene.canUndo()).toBe(false);
    off();
  });
});
