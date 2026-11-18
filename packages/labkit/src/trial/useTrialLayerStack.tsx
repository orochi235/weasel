import { type ReactNode, useMemo } from 'react';
import type { TrialClock } from '../clock/trialClock';
import type { OverAccess } from '../config/over';
import type { Instrument } from '../instrument/types';
import { TrialLayerList, useTrialLayerState } from './TrialLayerList';
import { useTrialLayers } from './useTrialLayers';

/** What a trial's layers are drawn from. */
export interface TrialLayerStackSources {
  instrument: Instrument;
  state: unknown;
  config: unknown;
  over: OverAccess | undefined;
  clock: TrialClock | undefined;
  /** The trial's snapshot-if-needed, which a change in the list takes first. */
  snapshot: (event: string) => void;
}

/** A trial's layers: the order and visibility it keeps for them, the ones its canvas draws, and the list that
 *  reorders and toggles them, or null for an instrument that lists none. */
export function useTrialLayerStack({
  instrument,
  state,
  config,
  over,
  clock,
  snapshot,
}: TrialLayerStackSources) {
  const { layerVisibility, layerOrder, setOrder, setShown } = useTrialLayerState();
  const { visibleLayers, canvasLayers, layerDescriptors, layerItems } = useTrialLayers({
    instrument,
    state,
    config,
    over,
    layerVisibility,
    layerOrder,
    clock,
  });
  const list: ReactNode = useMemo(
    () =>
      instrument.layers && layerDescriptors.length > 0 ? (
        <TrialLayerList
          items={layerItems}
          snapshot={snapshot}
          setOrder={setOrder}
          setVisibility={setShown}
        />
      ) : null,
    [instrument.layers, layerDescriptors, layerItems, snapshot, setOrder, setShown],
  );
  return { visibleLayers, canvasLayers, list };
}
