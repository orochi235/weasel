import { createContext, useContext, useLayoutEffect } from 'react';

/** What a `<Lightbox>` offers the content inside it. */
export interface LightboxApi {
  /** Whether the content is showing in the lightbox right now. */
  expanded: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/** The context value: the public API plus the registration the
 *  default affordance steps aside for. */
export interface LightboxContextValue extends LightboxApi {
  claimControl: () => () => void;
}

export const LightboxContext = createContext<LightboxContextValue | null>(null);

/** The nearest `<Lightbox>`, or `null` outside one. Reading it changes
 *  nothing; see `useLightboxControl` to replace the default expand button. */
export function useLightbox(): LightboxApi | null {
  return useContext(LightboxContext);
}

/**
 * The nearest `<Lightbox>`, for a component that draws its own expand
 * control: while a caller is mounted, the lightbox hides its default corner
 * button so the tile does not offer two. `<Trial>` uses this to put the
 * control in its title bar.
 */
export function useLightboxControl(): LightboxApi | null {
  const ctx = useContext(LightboxContext);
  const claim = ctx?.claimControl;
  // Layout effect, so the corner button is gone before the first paint.
  useLayoutEffect(() => claim?.(), [claim]);
  return ctx;
}
