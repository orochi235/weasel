import { describe, it, expect, vi } from 'vitest';
import { PathBuilder, pathToAnchors, worldCoords, type PolygonPath } from '@weasel-js/geom';
import { setup } from './testing/penHarness';

// The real layer, recorded: the pen keeps its state to itself, and the one
// place it hands that object out is to the preview layer that paints from it.
vi.mock('domains/paths/penPreviewLayer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('domains/paths/penPreviewLayer')>();
  return { ...actual, createPenPreviewLayer: vi.fn(actual.createPenPreviewLayer) };
});

const FAR = 262_144;

describe('usePenTool far from the origin', () => {
  it('commits a path measured from an origin beside it, keeping the fractions it was drawn with', () => {
    const p = setup();
    p.click(FAR + 0.3, 0); p.click(FAR + 100.3, 0); p.click(FAR + 100.3, 100);
    p.enter();
    const path = p.adapter.added[0].path;
    expect(path.origin).toBeDefined();
    // Without an origin, float32 rounds FAR + 0.3 to FAR + 0.3125.
    expect(worldCoords(path)[0]).toBeCloseTo(FAR + 0.3, 4);
    expect(worldCoords(path)[4]).toBeCloseTo(FAR + 100.3, 4);
  });

  it('commits a path near 0 without one', () => {
    const p = setup();
    p.click(0, 0); p.click(100, 0); p.click(100, 100);
    p.enter();
    expect(p.adapter.added[0].path.origin).toBeUndefined();
  });

  it('continues a far path from the origin it already has', () => {
    const start = new PathBuilder().setOrigin(FAR, 0).moveTo(FAR + 0.3, 0).lineTo(FAR + 100.3, 0).build();
    const p = setup({ paths: { n1: start } });
    p.click(FAR + 100.3, 1);
    p.click(FAR + 200.3, 0);
    p.enter();
    const next = p.scene.n1 as PolygonPath;
    expect(next.origin).toEqual({ x: FAR, y: 0 });
    expect(pathToAnchors(next).anchors[0].map((a) => a.x - FAR)).toEqual(
      [0.3, 100.3, 200.3].map((x) => expect.closeTo(x, 4)),
    );
  });
});
