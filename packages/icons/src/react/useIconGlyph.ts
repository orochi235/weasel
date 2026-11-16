import { useSyncExternalStore } from 'react';
import type { IconGlyph } from '../index';
import { useIconRegistry } from './IconRegistryProvider';

const NOOP = () => () => {};

/** The glyph `ref` names in the registry in scope, re-read when the registry changes. */
export function useIconGlyph(ref: string | undefined): IconGlyph | undefined {
  const registry = useIconRegistry();
  return useSyncExternalStore(
    registry ? registry.subscribe : NOOP,
    () => (registry && ref ? registry.get(ref) : undefined),
  );
}
