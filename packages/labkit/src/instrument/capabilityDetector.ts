import type { Instrument } from './types';

export interface CapabilityFlags {
  hasCanvas: boolean;
  hasLayers: boolean;
  hasDragDrop: boolean;
  hasUndo: boolean;
}

export function detectCapabilities(instrument: Instrument<unknown, unknown>): CapabilityFlags {
  return {
    hasCanvas: instrument.canvas != null,
    hasLayers: instrument.layers != null,
    hasDragDrop: instrument.dragDrop != null,
    hasUndo: instrument.undo != null,
  };
}
