import { useStore } from 'zustand/react';
import type { Instrument, InstrumentList } from '../instrument/types';
import type { LabStore } from '../state/store';
import type { TrialRecord } from '../state/types';
import { resolveLabTool } from '../tools/labTool';
import { useTrialToolSlot } from './useTrialToolSlot';

/** The tool trial `record` holds: its own slot when its instrument declares tools, the lab's otherwise. `labTool`
 *  is the lab's, which annotation tools always read. */
export function useTrialTool(
  store: LabStore,
  instrument: Instrument,
  instruments: InstrumentList,
  record: TrialRecord,
): { labTool: string | null; slot: ReturnType<typeof useTrialToolSlot> } {
  const labToolId = useStore(store, (s) => s.activeToolId);
  const setLabTool = useStore(store, (s) => s.setLabTool);
  const setTrialTool = useStore(store, (s) => s.setTrialTool);

  // A trial gets its own slot when its instrument declares tools; otherwise it
  // reads the lab's. Which slot a change writes follows from the same thing.
  // Annotation tools always read the lab's: a tool is what the hand holds, so
  // picking one arms it in every trial, the way artboards share a tool. They
  // were once per trial, back when one trial compared several pictures.
  const declaresTools = instrument.tools != null;
  const labTool = resolveLabTool(labToolId, instruments);
  const resolvedToolId = declaresTools
    ? (record.activeToolId ?? instrument.tools?.initial ?? instrument.tools?.tools[0]?.id ?? null)
    : labTool;
  const slot = useTrialToolSlot(resolvedToolId, (id) =>
    declaresTools ? setTrialTool(record.id, id) : setLabTool(id),
  );
  return { labTool, slot };
}
