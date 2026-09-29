import { useCallback, useSyncExternalStore } from 'react';
import {
  getPaintKind, listGradientKinds, listPaintKinds, paintKindRegistry, type PaintKindEntry,
} from './paintKinds';

/** Every registered paint kind, as {@link listPaintKinds} returns it,
 *  re-rendering the caller whenever a kind is registered or removed. */
export function usePaintKinds(): readonly PaintKindEntry[] {
  return useSyncExternalStore(paintKindRegistry.subscribe, listPaintKinds, listPaintKinds);
}

/** Every registered gradient kind, as {@link listGradientKinds} returns it,
 *  re-rendering the caller whenever a kind is registered or removed. */
export function useGradientKinds(): readonly PaintKindEntry[] {
  return useSyncExternalStore(paintKindRegistry.subscribe, listGradientKinds, listGradientKinds);
}

/**
 * The entry for `kind`, as {@link getPaintKind} returns it — `undefined` until
 * it is registered, and the new entry once it is. A kind with a loader starts
 * loading on the first read.
 */
export function usePaintKind(kind: string | undefined): PaintKindEntry | undefined {
  const read = useCallback(() => getPaintKind(kind), [kind]);
  return useSyncExternalStore(paintKindRegistry.subscribe, read, read);
}
