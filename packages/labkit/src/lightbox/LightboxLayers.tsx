import { createContext, type ReactNode, useContext, useMemo } from 'react';

/** Elements a lightbox lifts with it, in top-layer order around itself. A
 *  null entry is skipped, so a ref that has not landed yet can be passed as
 *  it is. */
export interface LightboxLayerSet {
  below: readonly (HTMLElement | null)[];
  above: readonly (HTMLElement | null)[];
}

const NONE: LightboxLayerSet = { below: [], above: [] };

const LightboxLayersContext = createContext<LightboxLayerSet>(NONE);

/** Props for `<LightboxLayers>`. Keep the arrays stable across renders. */
export interface LightboxLayersProps extends Partial<LightboxLayerSet> {
  children: ReactNode;
}

/**
 * Declares layers that belong to every lightbox below it: something drawn
 * for the content from outside it, such as a shared buffer the tiles paint
 * into. An open lightbox lifts each `below` layer, then itself, then each
 * `above` layer into the top layer, each covering the window, so they keep
 * stacking as they did. A layer is measured against the window while lifted,
 * so whatever positions things inside it must re-measure — a labkit surface
 * whose container is one of the layers does.
 */
export function LightboxLayers({ below, above, children }: LightboxLayersProps) {
  const value = useMemo(
    () => ({ below: below ?? NONE.below, above: above ?? NONE.above }),
    [below, above],
  );
  return <LightboxLayersContext.Provider value={value}>{children}</LightboxLayersContext.Provider>;
}

/** The layers declared above, or none. */
export function useLightboxLayers(): LightboxLayerSet {
  return useContext(LightboxLayersContext);
}
