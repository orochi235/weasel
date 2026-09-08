import { createContext, useContext, useState, type ReactElement, type ReactNode } from 'react';

/**
 * Elements an overlay may portal into: anything a theme has been stamped on
 * (`applyTheme` / `<ThemeProvider>` write both attributes), plus anything
 * opting in with `data-wzl-portal-host`. The opt-in exists for a styling root
 * that sits *below* the themed element — labkit's `.lk-root` carries element
 * defaults the themed wrapper does not.
 */
const HOST_SELECTOR = '[data-wzl-portal-host],[data-wzl-theme],[data-wzl-mode]';

/**
 * The nearest element `from` sits inside that can host a portalled overlay,
 * or `null` when there is none and the body is the only answer.
 */
export function nearestPortalHost(from: Element | null | undefined): HTMLElement | null {
  return (from?.closest(HOST_SELECTOR) as HTMLElement | null) ?? null;
}

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

/**
 * Resolves where an overlay should portal, and the anchor that answers it.
 *
 * The result goes to React Aria as `UNSTABLE_portalContainer`. Its documented
 * replacement, `UNSAFE_PortalProvider`, is not re-exported by
 * react-aria-components 1.18, and reaching past it to `react-aria` for the
 * provider risks a second copy of that package whose context the overlays
 * never read — a failure that shows up as an unthemed overlay, not an error.
 *
 * Render `anchor` at the component's own position in the tree — outside the
 * portal — and hand `portalContainer` to the React Aria overlay. The anchor
 * is what "nearest themed ancestor" is measured from; the first render has
 * none yet, so an overlay that mounts already open lands in its host on the
 * following render, before paint.
 */
export function useOverlayPortal(explicit?: Element | null): {
  anchor: ReactElement;
  portalContainer: Element | undefined;
} {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const fromProvider = useContext(OverlayPortalContext);

  const resolved =
    explicit !== undefined
      ? explicit
      : fromProvider !== undefined
        ? fromProvider
        : nearestPortalHost(anchorEl);

  return {
    anchor: <span hidden ref={setAnchorEl} />,
    portalContainer: resolved ?? undefined,
  };
}
