import { type Dispatch, type ReactElement, type SetStateAction, useState } from 'react';
import { LayerList, type LayerListItem, moveLayers } from '../passthrough/weasel-ui';

export interface TrialLayerListProps {
  items: LayerListItem[];
  /** Records the trial for undo before a change, when its instrument snapshots on the event. */
  snapshot: (event: string) => void;
  setOrder: Dispatch<SetStateAction<string[] | null>>;
  setVisibility: Dispatch<SetStateAction<Record<string, boolean>>>;
}

/** A trial's layer list: a reorder or a visibility toggle snapshots, then writes the trial's layer state. */
export function TrialLayerList({
  items,
  snapshot,
  setOrder,
  setVisibility,
}: TrialLayerListProps): ReactElement {
  return (
    <LayerList
      items={items}
      onReorder={(move) => {
        snapshot('layers.reorder');
        setOrder(moveLayers(items, move).map((l) => l.id));
      }}
      onVisibilityChange={(id, visible) => {
        snapshot('layers.toggle');
        setVisibility((prev) => ({ ...prev, [id]: visible }));
      }}
    />
  );
}

/** A trial's layer order and visibility. `layerOrder` is `null` until the first reorder. */
export function useTrialLayerState() {
  const [layerVisibility, setShown] = useState<Record<string, boolean>>({});
  const [layerOrder, setOrder] = useState<string[] | null>(null);
  return { layerVisibility, layerOrder, setOrder, setShown };
}
