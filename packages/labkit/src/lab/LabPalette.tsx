import { useContext } from 'react';
import { useStore } from 'zustand/react';
import { PaletteRegion } from '../chrome/regions/PaletteRegion';
import type { TrialChromeContext, TrialContribution } from '../chrome/types';
import { LabStoreContext } from '../state/context';
import type { TrialTool } from '../tools/types';

/** Props for `<LabPalette>`. */
export interface LabPaletteProps {
  tools: readonly TrialTool[];
}

/** The lab's tool strip. Writes the lab's tool slot, which every trial whose
 *  instrument declares no tools of its own resolves to. */
export function LabPalette({ tools }: LabPaletteProps) {
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] LabPalette requires <LabStoreProvider>');
  const activeToolId = useStore(storeCtx.store, (s) => s.activeToolId);
  const setLabTool = useStore(storeCtx.store, (s) => s.setLabTool);

  const contributions: TrialContribution[] = tools.map((t) => ({
    id: t.id,
    region: 'palette',
    group: t.group,
    item: { icon: t.icon, label: t.label, shortcut: t.shortcut },
  }));

  const ctx = {
    activeToolId,
    setActiveTool: setLabTool,
  } as unknown as TrialChromeContext;

  return <PaletteRegion contributions={contributions} ctx={ctx} />;
}
