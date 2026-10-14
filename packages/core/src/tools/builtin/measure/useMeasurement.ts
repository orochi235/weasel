import { useSyncExternalStore } from 'react';
import type { Measurement, MeasurementStore } from './measurement';

/** The measurement in `store`, re-rendering whenever it changes. */
export function useMeasurement(store: MeasurementStore): Measurement | null {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
