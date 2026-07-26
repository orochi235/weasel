import { useRef } from 'react';
import { arrayAdapter, type ArrayAdapter, type ArrayAdapterConfig } from './arrayAdapter';

/** Options for `useArrayAdapter` — same shape as `ArrayAdapterConfig` minus the
 *  `ref` field, which the hook manages internally from `items`. */
export type UseArrayAdapterOptions<TNode extends { id: string }, TPose> =
  Omit<ArrayAdapterConfig<TNode, TPose>, 'ref' | 'setItems'> & {
    items: TNode[];
    setItems: ArrayAdapterConfig<TNode, TPose>['setItems'];
  };

/** Hook wrapper around `arrayAdapter` that owns the live items ref. Eliminates
 *  the `useRef + ref.current = items` boilerplate every flat-list scene needs.
 *  Returns a fresh adapter each render — matches how consumers built it inline
 *  before, and the gesture hooks already capture the adapter via internal refs. */
export function useArrayAdapter<TNode extends { id: string }, TPose>(
  options: UseArrayAdapterOptions<TNode, TPose>,
): ArrayAdapter<TNode, TPose> {
  const { items, ...rest } = options;
  const ref = useRef(items);
  ref.current = items;
  return arrayAdapter<TNode, TPose>({ ref, ...rest });
}
