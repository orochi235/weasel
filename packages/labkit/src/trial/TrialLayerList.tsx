import type { Op } from '@weasel-js/core';
import { LayerList, type LayerListItem, moveLayers } from '@weasel-js/ui/components/LayerList';
import { type ReactElement, useCallback, useState } from 'react';

/** A trial's layer order and visibility. `order` is `null` until the first reorder. */
export interface TrialLayers {
  visibility: Record<string, boolean>;
  order: string[] | null;
}

export interface TrialLayerListProps {
  items: LayerListItem[];
  /** Records the trial for undo before a change, when its instrument snapshots on the event, with `op` as the
   *  step that undoes it. */
  snapshot: (event: string, op: Op) => void;
  layers: TrialLayers;
  setLayers: (next: TrialLayers) => void;
}

/** An undo step from `before` to `after` in a trial's layers. Unnamed, so a saved history leaves it out, as a
 *  reload leaves out the layer state it steps. */
function layersOp(before: TrialLayers, after: TrialLayers, write: (next: TrialLayers) => void): Op {
  const forward: Op = {
    label: 'layers',
    apply: () => write(after),
    invert: () => ({ label: 'layers', apply: () => write(before), invert: () => forward }),
  };
  return forward;
}

/** A trial's layer list: a reorder or a visibility toggle snapshots a step over the layers, then writes them. */
export function TrialLayerList({
  items,
  snapshot,
  layers,
  setLayers,
}: TrialLayerListProps): ReactElement {
  const change = (event: string, next: TrialLayers) => {
    snapshot(event, layersOp(layers, next, setLayers));
    setLayers(next);
  };
  return (
    <LayerList
      items={items}
      onReorder={(move) =>
        change('layers.reorder', {
          ...layers,
          order: moveLayers(items, move).map((l) => l.id),
        })
      }
      onVisibilityChange={(changes) =>
        change('layers.toggle', {
          ...layers,
          visibility: { ...layers.visibility, ...changes },
        })
      }
    />
  );
}

/** A trial's layer order and visibility, and the write that replaces them. */
export function useTrialLayerState() {
  const [layers, set] = useState<TrialLayers>({ visibility: {}, order: null });
  const setLayers = useCallback((next: TrialLayers) => set(next), []);
  return { layers, setLayers };
}
