import { createContext, useCallback, useContext, useState, type ReactElement, type ReactNode } from 'react';
import { UNSAFE_PortalProvider } from 'react-aria';
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

/** React Aria props minus the portal key a weasel overlay owns: set, it
 *  would override the container {@link useOverlayPortal} provides. */
export type WithoutPortalTarget<T> = Omit<T, 'UNSTABLE_portalContainer'>;

/**
 * Resolves where an overlay should portal, and the anchor that answers it.
 *
 * Render `anchor` at the component's own position in the tree — outside the
 * portal — and pass the React Aria overlay through `provide`, which puts it
 * under React Aria's portal provider. Render the overlay only once `ready` is
 * true: the first render has no anchor to measure "nearest themed ancestor"
 * from, and an overlay rendered then would portal into the body and move on
 * the next render, after React Aria has made everything outside it `inert` —
 * itself included. `ready` turns true on that next render, still before paint.
 */
export function useOverlayPortal(explicit?: Element | null): {
  anchor: ReactElement;
  /** Wraps the React Aria overlay so it portals into `container`. */
  provide: (overlay: ReactNode) => ReactNode;
  /** The resolved portal container, for code that portals by itself rather than through React Aria. */
  container: Element | undefined;
  ready: boolean;
} {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const assigned = useAssignedPortalContainer(explicit);
  const container = (assigned !== undefined ? assigned : nearestPortalHost(anchorEl)) ?? undefined;
  const getContainer = useCallback(() => (container as HTMLElement | undefined) ?? null, [container]);
  // `null` clears an enclosing provider, so an explicit body beats an outer overlay's container.
  const providerTarget = container ? getContainer : assigned === null ? null : undefined;
  const provide = useCallback(
    (overlay: ReactNode) =>
      providerTarget === undefined ? overlay : (
        <UNSAFE_PortalProvider getContainer={providerTarget}>{overlay}</UNSAFE_PortalProvider>
      ),
    [providerTarget],
  );

  return {
    anchor: <span hidden ref={setAnchorEl} />,
    provide,
    container,
    ready: assigned !== undefined || anchorEl !== null,
  };
}
