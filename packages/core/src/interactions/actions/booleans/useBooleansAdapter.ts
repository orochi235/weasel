/**
 * `useBooleansAdapter` — publishes a `BooleansAdapter` to the surrounding
 * `<DepRegistryProvider>` (typically inside `<SceneCanvas>`).
 *
 * The Pathfinder action descriptors (`pathfinderUnionAction`, etc., registered
 * by `useStandardActions`) read this dep both in their `enabled` predicate
 * (via `deps.booleansAdapter` — actually they read selection; the adapter is
 * read by the invoker) and in their immediate invoker. Consumers construct an
 * adapter that bridges to their scene's data shape and call this hook to make
 * the kit's Pathfinder strip operational.
 *
 * No-op when no `<DepRegistryProvider>` is in scope — mirrors the silent-
 * no-op contract of `useDepSource`.
 */
import { useDepSource } from '../depRegistry';
import type { BooleansAdapter } from './booleans';

/** Publish a Boolean-ops adapter so the built-in Pathfinder actions can run.
 *  Silently does nothing outside a `<DepRegistryProvider>`. */
export function useBooleansAdapter(adapter: BooleansAdapter): void {
  useDepSource('booleansAdapter', () => adapter);
}
