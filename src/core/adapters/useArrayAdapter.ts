import { useRef } from 'react';
import { arrayAdapter, type ArrayAdapter, type ArrayAdapterConfig } from './arrayAdapter';

/** Options for `useArrayAdapter` — same shape as `ArrayAdapterConfig` minus the
 *  `ref` field, which the hook manages internally from `items`. */
export type UseArrayAdapterOptions<TObject extends { id: string }, TPose> =
  Omit<ArrayAdapterConfig<TObject, TPose>, 'ref' | 'setItems'> & {
    items: TObject[];
    setItems: ArrayAdapterConfig<TObject, TPose>['setItems'];
  };

/** Hook wrapper around `arrayAdapter` that owns the live items ref. Eliminates
 *  the `useRef + ref.current = items` boilerplate every flat-list scene needs.
 *  Returns a fresh adapter each render — matches how consumers built it inline
 *  before, and the gesture hooks already capture the adapter via internal refs. */
export function useArrayAdapter<TObject extends { id: string }, TPose>(
  options: UseArrayAdapterOptions<TObject, TPose>,
): ArrayAdapter<TObject, TPose> {
  const { items, ...rest } = options;
  const ref = useRef(items);
  ref.current = items;
  return arrayAdapter<TObject, TPose>({ ref, ...rest });
}
