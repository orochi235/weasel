import { describe, expect, it } from 'vitest';
import { detectCapabilities } from './capabilityDetector';
import type { Instrument } from './types';

function baseInstrument(extras: Partial<Instrument>): Instrument {
  return {
    name: 'T',
    defaultConfig: () => ({}),
    initialState: () => ({}),
    render: () => null,
    ...extras,
  };
}

describe('detectCapabilities', () => {
  it('returns all false for a bare instrument', () => {
    expect(detectCapabilities(baseInstrument({}))).toEqual({
      hasCanvas: false,
      hasLayers: false,
      hasDragDrop: false,
      hasUndo: false,
    });
  });

  it('detects canvas only', () => {
    const inst = baseInstrument({ canvas: { layers: [] } });
    expect(detectCapabilities(inst)).toEqual({
      hasCanvas: true,
      hasLayers: false,
      hasDragDrop: false,
      hasUndo: false,
    });
  });

  it('detects layers only', () => {
    const inst = baseInstrument({ layers: { ids: ['a'] } });
    expect(detectCapabilities(inst).hasLayers).toBe(true);
  });

  it('detects dragDrop only', () => {
    const inst = baseInstrument({ dragDrop: {} });
    expect(detectCapabilities(inst).hasDragDrop).toBe(true);
  });

  it('detects undo only', () => {
    const inst = baseInstrument({ undo: {} });
    expect(detectCapabilities(inst).hasUndo).toBe(true);
  });

  it('detects all four capabilities', () => {
    const inst = baseInstrument({
      canvas: { layers: [] },
      layers: { ids: [] },
      dragDrop: {},
      undo: {},
    });
    expect(detectCapabilities(inst)).toEqual({
      hasCanvas: true,
      hasLayers: true,
      hasDragDrop: true,
      hasUndo: true,
    });
  });
});
