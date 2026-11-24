import { describe, it, expect } from 'vitest';
import { defaultDrawOne } from '../defaultDrawOne';
import { layersOverPresets, mergeLayersWithDefaults } from './mergeLayers';

describe('mergeLayersWithDefaults', () => {
  it('keeps the default painter and culling under a scene field given as undefined', () => {
    const merged = mergeLayersWithDefaults({ scene: { drawOne: undefined, paintBounds: undefined } });
    const scene = merged.scene as { drawOne?: unknown; paintBounds?: unknown };
    expect(scene.drawOne).toBe(defaultDrawOne);
    expect(scene.paintBounds).toBeTypeOf('function');
  });

  it('keeps the default handle size under a selection-overlay field given as undefined', () => {
    const merged = mergeLayersWithDefaults({ selectionOverlay: { handles: undefined } });
    const overlay = merged.selectionOverlay as { handles?: { size: number } };
    expect(overlay.handles?.size).toBeGreaterThan(0);
  });
});

describe('layersOverPresets', () => {
  const grid = { layer: {} };

  it("keeps a preset's layer under a slot given as undefined", () => {
    expect(layersOverPresets({ grid } as never, { grid: undefined }))
      .toEqual({ grid });
  });

  it("drops a preset's layer under a slot given as null", () => {
    expect(layersOverPresets({ grid } as never, { grid: null })).toEqual({ grid: null });
  });
});
