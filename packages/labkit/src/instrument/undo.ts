import type { Instrument, UndoCapability } from './types';

const DEFAULT_UNDO: UndoCapability = {};

/** The undo an instrument gets: what it declares, the defaults when it says
 *  nothing, and none when it declares `undo: false`. */
export function undoCapability(instrument: Instrument): UndoCapability | undefined {
  const declared = instrument.undo;
  if (declared === false) return undefined;
  return declared ?? DEFAULT_UNDO;
}
