import { arrayAdapter, type ArrayAdapter, type ArrayAdapterConfig } from './arrayAdapter';

/** Options for `useArrayAdapter` — same shape as `ArrayAdapterConfig` minus the
 *  `ref` field, which the hook manages internally from `items`. */
export type UseArrayAdapterOptions<TNode extends { id: string }, TPose> =
  Omit<ArrayAdapterConfig<TNode, TPose>, 'ref' | 'setItems'> & {
    items: TNode[];
    setItems: ArrayAdapterConfig<TNode, TPose>['setItems'];
  };

/** Hook wrapper around `arrayAdapter` over this render's `items`. Eliminates
 *  the `useRef + ref.current = items` boilerplate every flat-list scene needs.
 *  Returns a fresh adapter each render, reading that render's items — so an
 *  adapter a render reads from sees its own items, and the gesture hooks, which
 *  hold the latest committed adapter, see the committed ones. */
export function useArrayAdapter<TNode extends { id: string }, TPose>(
  options: UseArrayAdapterOptions<TNode, TPose>,
): ArrayAdapter<TNode, TPose> {
  const { items, ...rest } = options;
  return arrayAdapter<TNode, TPose>({ ref: { current: items }, ...rest });
}
