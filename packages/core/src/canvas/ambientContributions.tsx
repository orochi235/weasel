/**
 * Ambient contributions supplied from above a canvas: every `<SceneCanvas>`
 * below an {@link AmbientContributionsProvider} installs its entries beside its
 * own `ambient` prop.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SurfaceContribution } from './surfaceContribution';

const NONE: readonly SurfaceContribution[] = [];

const AmbientContributionsContext = createContext<readonly SurfaceContribution[]>(NONE);

/** Props for {@link AmbientContributionsProvider}. */
export interface AmbientContributionsProviderProps {
  /** Installed on every `<SceneCanvas>` below. Pass a stable array: a new one reinstalls them. */
  contributions: readonly SurfaceContribution[];
  children?: ReactNode;
}

/**
 * Installs `contributions` on every `<SceneCanvas>` below it, ahead of the canvas's own `ambient` entries, so a menu
 * both define lists the provided sections first. An `ambient` entry with the same id replaces a provided one. Nested
 * providers accumulate, and an inner provider's entry replaces an outer one of the same id. Like `ambient`, ignored by
 * a canvas whose `tools` prop is a takeover.
 */
export function AmbientContributionsProvider({ contributions, children }: AmbientContributionsProviderProps) {
  const outer = useContext(AmbientContributionsContext);
  const value = useMemo(() => withOverrides(outer, contributions), [outer, contributions]);
  return <AmbientContributionsContext.Provider value={value}>{children}</AmbientContributionsContext.Provider>;
}

/** What the enclosing providers supply that `ambient` has no entry of the same id for, then `ambient`. */
export function useWithProvidedAmbient(
  ambient: readonly SurfaceContribution[] | undefined,
): readonly SurfaceContribution[] | undefined {
  const provided = useContext(AmbientContributionsContext);
  return useMemo(() => {
    if (!provided.length) return ambient;
    if (!ambient?.length) return provided;
    const ids = new Set(ambient.map((e) => e.id));
    return [...provided.filter((e) => !ids.has(e.id)), ...ambient];
  }, [ambient, provided]);
}

/** `base`, less the entries `own` has an id for, then `own`. */
function withOverrides(
  base: readonly SurfaceContribution[],
  own: readonly SurfaceContribution[],
): readonly SurfaceContribution[] {
  if (!base.length) return own;
  if (!own.length) return base;
  const ids = new Set(own.map((e) => e.id));
  return [...base.filter((e) => !ids.has(e.id)), ...own];
}
