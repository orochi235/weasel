import type { InstrumentList } from '../instrument/types';

/**
 * The tool the lab's slot holds, once its default is applied: a lab with any
 * annotating instrument starts in `select`, so a first click on a picture
 * selects rather than draws.
 */
export function resolveLabTool(slot: string | null, instruments: InstrumentList): string | null {
  if (slot !== null) return slot;
  return instruments.some((i) => i.annotations != null) ? 'select' : null;
}
