import type { Instrument } from './types';

/** Which optional capabilities an instrument declared — what the workspace
 *  consults to decide which chrome to show. */
export interface CapabilityFlags {
  hasCanvas: boolean;
  hasLayers: boolean;
  hasDragDrop: boolean;
  hasUndo: boolean;
}

/** Read an instrument's declared capabilities off its definition. */
export function detectCapabilities(instrument: Instrument<unknown, unknown>): CapabilityFlags {
  return {
    hasCanvas: instrument.canvas != null,
    hasLayers: instrument.layers != null,
    hasDragDrop: instrument.dragDrop != null,
    hasUndo: instrument.undo != null,
  };
}
