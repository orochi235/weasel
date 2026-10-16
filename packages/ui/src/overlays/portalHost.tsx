import { createContext, useContext, useState, type ReactElement, type ReactNode } from 'react';
import { nearestPortalHost } from '@weasel-js/gestures';

export { nearestPortalHost };

/** `undefined` distinguishes "no provider" from a provider saying `null`. */
const OverlayPortalContext = createContext<Element | null | undefined>(undefined);

/** Props for {@link OverlayPortalProvider}. */
export interface OverlayPortalProviderProps {
  /** Where overlays in this subtree portal. `null` means `document.body`. */
  container: Element | null;
  children: ReactNode;
}

/**
 * Sets the portal container for every weasel overlay rendered below it,
 * overriding the nearest-themed-ancestor default. An individual overlay's
 * own `portalContainer` prop still wins.
 */
export function OverlayPortalProvider({ container, children }: OverlayPortalProviderProps) {
  return (
    <OverlayPortalContext.Provider value={container}>{children}</OverlayPortalContext.Provider>
  );
}

/**
 * The container an overlay has been *told* to use: its own `portalContainer`
 * prop, else the nearest {@link OverlayPortalProvider}. `undefined` when
 * neither said, which leaves the choice to the overlay.
 */
export function useAssignedPortalContainer(explicit?: Element | null): Element | null | undefined {
  const fromProvider = useContext(OverlayPortalContext);
  return explicit !== undefined ? explicit : fromProvider;
}

/** The `portalContainer` prop every weasel overlay accepts. */
export interface OverlayPortalProps {
  /**
   * Where the overlay's portal mounts. Defaults to the nearest ancestor of
   * the overlay's own position that carries a weasel theme, so the overlay
   * resolves the same `--wzl-*` tokens as the control it belongs to. Pass
   * `null` for `document.body`.
   */
  portalContainer?: Element | null;
}

/** React Aria props minus the portal key a weasel overlay owns. */
export type WithoutPortalTarget<T> = Omit<T, 'UNSTABLE_portalContainer'>;

/** Spread onto the React Aria overlay. The unstable key is spelled here and
 *  nowhere else in the package, so an upstream rename lands in one file. */
export interface OverlayPortalTarget {
  UNSTABLE_portalContainer: Element | undefined;
}

/**
 * Resolves where an overlay should portal, and the anchor that answers it.
 *
 * Render `anchor` at the component's own position in the tree — outside the
 * portal — and spread `portalProps` onto the React Aria overlay. Render the
 * overlay only once `ready` is true: the first render has no anchor to measure
 * "nearest themed ancestor" from, and an overlay rendered then would portal
 * into the body and move on the next render, after React Aria has made
 * everything outside it `inert` — itself included. `ready` turns true on that
 * next render, still before paint.
 *
 * The result goes to React Aria as `UNSTABLE_portalContainer`. Its documented
 * replacement, `UNSAFE_PortalProvider`, is not re-exported by
 * react-aria-components 1.18, and importing it from `react-aria` risks a second
 * copy of that package whose context the overlays never read — an unthemed
 * overlay, not an error.
 */
export function useOverlayPortal(explicit?: Element | null): {
  anchor: ReactElement;
  portalProps: OverlayPortalTarget;
  /** The resolved portal container, for code that portals by itself rather than through React Aria. */
  container: Element | undefined;
  ready: boolean;
} {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const assigned = useAssignedPortalContainer(explicit);
  const resolved = assigned !== undefined ? assigned : nearestPortalHost(anchorEl);

  return {
    anchor: <span hidden ref={setAnchorEl} />,
    portalProps: { UNSTABLE_portalContainer: resolved ?? undefined },
    container: resolved ?? undefined,
    ready: assigned !== undefined || anchorEl !== null,
  };
}
