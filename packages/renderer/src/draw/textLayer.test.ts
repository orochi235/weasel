import { describe, it, expect, vi } from 'vitest';
import type { TextDrawCommand } from '../DrawCommand';
import type { GpuDevice } from '../gpu/types';
import type { DrawContext } from './drawContext';

vi.mock('@weasel-js/text', async (real) => ({
  ...(await real<typeof import('@weasel-js/text')>()),
  cachedPaintRuns: (laid: { family: string; decorate: boolean }) => ({
    decorations: laid.decorate ? [{}] : [],
    groups: [{
      source: 'atlas', family: laid.family, weight: 400, style: 'normal', page: 0,
      fill: { paint: { kind: 'solid', color: '#000' } },
      quadData: new Float32Array([0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0]),
      synthetic: { bold: false, italic: false },
    }],
  }),
}));
vi.mock('@weasel-js/font', async (real) => ({
  ...(await real<typeof import('@weasel-js/font')>()),
  ensureFontTexture: () => true,
  glyphFieldScale: () => [1, 1],
  hasFontOutlines: () => false,
  textureCacheKey: (family: string) => `atlas:${family}`,
}));
vi.mock('../textLayout', () => ({
  laidOutText: (text: TextDrawCommand) => ({ laid: text.runs[0], dx: 0, dy: 0 }),
}));

const { TextLayers } = await import('./textLayer');

function countingGpu() {
  const live = new Set<object>();
  const gpu = {
    createBuffer: () => { const b = {}; live.add(b); return b; },
    deleteBuffer: (b: object) => live.delete(b),
    createGeometry: () => { const g = {}; live.add(g); return g; },
    deleteGeometry: (g: object) => live.delete(g),
  } as unknown as GpuDevice;
  return { gpu, live };
}

const text = (family: string, decorate = false) => ({
  kind: 'text', x: 0, y: 0, runs: [{ fontFamily: family, family, decorate }],
}) as unknown as TextDrawCommand;

describe('a text layer that falls back', () => {
  it('frees a span it uploaded before finding what its instances cannot carry', () => {
    const { gpu, live } = countingGpu();
    const layers = new TextLayers(gpu);
    // More faces than one span has atlas slots, so a span uploads before the last text.
    const texts = [...Array.from({ length: 20 }, (_, i) => text(`f${i}`)), text('last', true)];
    const layer = layers.layerFor({} as DrawContext, texts);
    expect(layer.fallback).toBe(true);
    expect(layer.spans).toHaveLength(0);
    layers.dispose();
    expect(live.size).toBe(0);
  });
});
