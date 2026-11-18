import { type ReactNode, useMemo } from 'react';
import type { TrialContribution } from '../chrome/types';

/** The sidebar sections the trial runtime adds, which depend on runtime state the instrument cannot reach: the
 *  drag palette and the layer list, each while it is not null. */
export function useRuntimeSections(palette: ReactNode, layerList: ReactNode): TrialContribution[] {
  return useMemo<TrialContribution[]>(() => {
    const out: TrialContribution[] = [];
    if (palette) {
      out.push({
        id: 'dragdrop-palette',
        region: 'sidebar',
        item: { title: 'Parts', body: palette },
      });
    }
    if (layerList) {
      out.push({
        id: 'layer-list',
        region: 'sidebar',
        item: { title: 'Layers', body: layerList },
      });
    }
    return out;
  }, [palette, layerList]);
}
