import { createContext, useCallback, useContext, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { UNSAFE_PortalProvider, useUNSAFE_PortalContext } from 'react-aria';
import { nearestPortalHost } from '@weasel-js/gestures';

export { nearestPortalHost };

interface Assigned {
  container: Element | null;
  contained: boolean;
}

/** `undefined` distinguishes "no provider" from a provider saying `null`. */
const OverlayPortalContext = createContext<Assigned | undefined>(undefined);

/** Props for {@link OverlayPortalProvider}. */
export interface OverlayPortalProviderProps {
  /** Where overlays in this subtree portal. `null` means `document.body`. */
  container: Element | null;
  /**
   * The container stands in for the viewport: a modal below dims, traps focus in, and makes inert only what the
   * container holds, and leaves the page's scrolling alone. For a box that shows one piece of a larger page, as a
   * workshop shows a story. The container must be positioned and must not scroll, or the modal rides its content.
   */
  contained?: boolean;
  children: ReactNode;
}

/**
 * Sets the portal container for every weasel overlay rendered below it,
 * overriding the nearest-themed-ancestor default. An individual overlay's
 * own `portalContainer` prop still wins.
 */
export function OverlayPortalProvider({ container, contained = false, children }: OverlayPortalProviderProps) {
  const value = useMemo(() => ({ container, contained }), [container, contained]);
  return <OverlayPortalContext.Provider value={value}>{children}</OverlayPortalContext.Provider>;
}

/**
 * The container an overlay has been *told* to use: its own `portalContainer`
 * prop, else the nearest {@link OverlayPortalProvider}. `undefined` when
 * neither said, which leaves the choice to the overlay.
 */
export function useAssignedPortalContainer(explicit?: Element | null): Element | null | undefined {
  const fromProvider = useContext(OverlayPortalContext);
  return explicit !== undefined ? explicit : fromProvider?.container;
}

/** The container a modal treats as its viewport: the nearest provider's, when it is `contained` and no
 *  `portalContainer` of the overlay's own overrides it; otherwise null. */
export function useContainedRoot(explicit?: Element | null): Element | null {
  const fromProvider = useContext(OverlayPortalContext);
  return explicit === undefined && fromProvider?.contained ? fromProvider.container : null;
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

/** The portal key of a React Aria overlay's props. */
interface PortalTargeted {
  UNSTABLE_portalContainer?: Element;
}

/** Where React Aria will portal an overlay with these props: their own target, else its portal provider's. */
export function useReactAriaPortalTarget(props?: PortalTargeted): Element | null {
  const { getContainer } = useUNSAFE_PortalContext();
  return props?.UNSTABLE_portalContainer ?? getContainer?.() ?? null;
}

/** A React Aria overlay's props with their portal target replaced by `target`, or as given when it is null. */
export function withPortalTarget<T extends PortalTargeted>(props: T, target: Element | null): T {
  return target ? { ...props, UNSTABLE_portalContainer: target } : props;
}

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
  const choosing = assigned === undefined;
  // Once per anchor rather than per render: every Tooltip renders this hook, open or not.
  const nearest = useMemo(() => (choosing ? nearestPortalHost(anchorEl) : null), [choosing, anchorEl]);
  const container = (choosing ? nearest : assigned) ?? undefined;
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
