import { labAnnotationTools } from '../annotations/toolMap';
import type { InstrumentList } from '../instrument/types';

/**
 * The tool the lab's slot holds, once its default is applied: a lab with any
 * annotating instrument starts in `pointer`, so a first click reaches the
 * instrument rather than the marks over it, or in the first annotation tool
 * its rail carries when `pointer` is not among them.
 */
export function resolveLabTool(slot: string | null, instruments: InstrumentList): string | null {
  if (slot !== null) return slot;
  const tools = labAnnotationTools(instruments);
  if (tools.some((t) => t.id === 'pointer')) return 'pointer';
  return tools[0]?.id ?? null;
}
