import type { Op } from '@weasel-js/core';
import { LayerList, type LayerListItem, moveLayers } from '@weasel-js/ui/components/LayerList';
import { type ReactElement, useState } from 'react';
import { TRIAL_LAYERS_OP } from './trialEditOp';

/** A trial's layer order and visibility. `order` is `null` until the first reorder. */
export interface TrialLayerState {
  visibility: Record<string, boolean>;
  order: readonly string[] | null;
}

export interface TrialLayerListProps {
  items: LayerListItem[];
  /** Records the trial for undo before a change, when its instrument snapshots on the event, with
   *  `op` as the entry that steps the change. */
  snapshot: (event: string, op: Op) => void;
  /** The layer state as it stands, and the change to it the list makes. */
  layers: TrialLayerState;
  setLayers: (next: TrialLayerState) => void;
}

/** A trial's layer list: a reorder or a visibility toggle snapshots, then writes the trial's layer state. The
 *  snapshot's entry steps the layer state itself, which the trial's state and settings do not hold. */
export function TrialLayerList({
  items,
  snapshot,
  layers,
  setLayers,
}: TrialLayerListProps): ReactElement {
  const change = (event: string, next: TrialLayerState): void => {
    snapshot(event, layerStateOp(layers, next, setLayers));
    setLayers(next);
  };
  return (
    <LayerList
      items={items}
      onReorder={(move) =>
        change('layers.reorder', { ...layers, order: moveLayers(items, move).map((l) => l.id) })
      }
      onVisibilityChange={(changes) =>
        change('layers.toggle', { ...layers, visibility: { ...layers.visibility, ...changes } })
      }
    />
  );
}

/** An undo entry from layer state `before` to `after`. */
function layerStateOp(
  before: TrialLayerState,
  after: TrialLayerState,
  write: (next: TrialLayerState) => void,
): Op {
  const forward: Op = {
    name: TRIAL_LAYERS_OP,
    label: 'layers',
    apply: () => write(after),
    invert: () => ({
      name: TRIAL_LAYERS_OP,
      label: 'layers',
      apply: () => write(before),
      invert: () => forward,
    }),
  };
  return forward;
}

/** A trial's layer order and visibility, and the setter that replaces them. */
export function useTrialLayerState() {
  const [layers, setLayers] = useState<TrialLayerState>({ visibility: {}, order: null });
  return { layers, setLayers };
}
