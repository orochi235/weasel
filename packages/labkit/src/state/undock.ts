import type { StateCreator } from 'zustand/vanilla';

/** A sidebar section torn out of its trial, and where it went. */
export interface UndockedPanel {
  trialId: string;
  sectionId: string;
  as: 'tile' | 'floating';
}

/** Undocked panels, keyed by {@link panelKey}. */
export type UndockedPanels = Record<string, UndockedPanel>;

/** The `UndockedPanels` key for one trial's section. */
export function panelKey(trialId: string, sectionId: string): string {
  return `${trialId}::${sectionId}`;
}

/** `panels` with the section marked undocked `as` a tile or a floating panel,
 *  replacing any earlier entry for it. Returns a new record. */
export function undockPanel(
  panels: UndockedPanels,
  trialId: string,
  sectionId: string,
  as: UndockedPanel['as'] = 'tile',
): UndockedPanels {
  return { ...panels, [panelKey(trialId, sectionId)]: { trialId, sectionId, as } };
}

/** Dock one section back, or — with no `sectionId` — every panel the trial
 *  owns, which is what closing a trial wants. */
export function dockPanel(
  panels: UndockedPanels,
  trialId: string,
  sectionId?: string,
): UndockedPanels {
  const out: UndockedPanels = {};
  for (const [key, panel] of Object.entries(panels)) {
    if (panel.trialId === trialId && (sectionId === undefined || panel.sectionId === sectionId)) {
      continue;
    }
    out[key] = panel;
  }
  return out;
}

interface HoldsPanels {
  trials: readonly { id: string }[];
  undockedPanels: UndockedPanels;
}

/** Store middleware: any write that drops a trial from `trials` docks that
 *  trial's panels in the same write, whichever caller made it. */
export function dockingDepartedTrials<S extends HoldsPanels>(
  init: StateCreator<S>,
): StateCreator<S> {
  return (set, get, api) => {
    const docking = ((partial: S | Partial<S> | ((state: S) => S | Partial<S>), replace?: false) =>
      set((s) => {
        const next = typeof partial === 'function' ? partial(s) : partial;
        if (!next.trials || next.trials === s.trials) return next;
        const staying = new Set(next.trials.map((t) => t.id));
        const gone = s.trials.filter((t) => !staying.has(t.id));
        if (gone.length === 0) return next;
        let panels = next.undockedPanels ?? s.undockedPanels;
        for (const t of gone) panels = dockPanel(panels, t.id);
        return { ...next, undockedPanels: panels };
      }, replace)) as typeof set;
    api.setState = docking;
    return init(docking, get, api);
  };
}
