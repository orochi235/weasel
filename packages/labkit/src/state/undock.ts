/** A sidebar section torn out of its trial, and where it went. */
export interface UndockedPanel {
  trialId: string;
  sectionId: string;
  as: 'tile' | 'floating';
}

/** Undocked panels, keyed by {@link panelKey}. */
export type UndockedPanels = Record<string, UndockedPanel>;

export function panelKey(trialId: string, sectionId: string): string {
  return `${trialId}::${sectionId}`;
}

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
