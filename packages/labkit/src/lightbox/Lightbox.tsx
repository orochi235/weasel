import { useLatest } from '@weasel-js/core';
import { CloseIcon, FullscreenIcon } from '@weasel-js/ui';
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSurfaceOptional } from '../surface/useSurfaceTile';
import { LightboxContext, type LightboxContextValue } from './LightboxContext';
import { useLightboxLayers } from './LightboxLayers';
import { inertOutside, liftStack, opensLightbox } from './modal';

/** Props for `<Lightbox>`. */
export interface LightboxProps {
  children: ReactNode;
  /** Names the expanded view for assistive tech. */
  label?: string;
  /** Turns the lightbox off: no expand button, no double-click, and an open
   *  one closes. The content stays mounted either way. */
  disabled?: boolean;
  /** Let a double-click on the content open it, and another close it. Off by
   *  default — the expand button is always there; a double-click is for
   *  content that has no other use for one, such as an image. */
  expandOnDoubleClick?: boolean;
  /** Controlled open state. Omit to let the lightbox keep its own. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Extra class on the outer element. */
  className?: string;
}

/** What the root becomes while open: a modal dialog, and the host overlays
 *  opened inside it portal into, so they stack above it. */
function dialogProps(label: string) {
  return {
    role: 'dialog',
    'aria-modal': true,
    'aria-label': label,
    'data-wzl-portal-host': '',
  } as const;
}

/**
 * Shows its content large, over a dimmed page, from the expand button in its
 * corner — or a double-click, where `expandOnDoubleClick` asks for one —
 * without remounting it. The same element is lifted into the browser's top
 * layer (`popover="manual"`), so a WebGL context or a scene inside keeps
 * running and sees only a bigger box: anything sizing itself from a
 * `ResizeObserver` follows on its own. The top layer also escapes an
 * ancestor's transform, clipping, and stacking.
 *
 * Layers declared by a `<LightboxLayers>` above are lifted around it, and a
 * labkit surface above is scoped to it while it is open, so pixels drawn for
 * the content from outside it come along.
 *
 * Escape, a click on the dimmed margin, the close button, or another
 * double-click where those open it closes it, and focus returns to wherever it
 * was. A double-click on a control, inside `[data-lk-lightbox-ignore]`, or one
 * a handler further in called `preventDefault()` on does not open it.
 */
export function Lightbox({
  children,
  label = 'Expanded view',
  disabled = false,
  expandOnDoubleClick = false,
  expanded: expandedProp,
  onExpandedChange,
  className,
}: LightboxProps) {
  const [own, setOwn] = useState(false);
  const expanded = !disabled && (expandedProp ?? own);
  const onChangeRef = useLatest(onExpandedChange);
  const expandedRef = useLatest(expanded);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [claims, setClaims] = useState(0);
  const layers = useLightboxLayers();
  const surface = useSurfaceOptional();

  const set = useCallback(
    (next: boolean) => {
      if (next === expandedRef.current) return;
      setOwn(next);
      onChangeRef.current?.(next);
    },
    [expandedRef, onChangeRef],
  );

  const ctx = useMemo<LightboxContextValue | null>(
    () =>
      disabled
        ? null
        : {
            expanded,
            open: () => set(true),
            close: () => set(false),
            toggle: () => set(!expandedRef.current),
            claimControl: () => {
              setClaims((n) => n + 1);
              return () => setClaims((n) => n - 1);
            },
          },
    [disabled, expanded, set, expandedRef],
  );

  // Lift, trap and focus before paint, so the first frame is already the
  // expanded one. The popover attribute is set here rather than rendered: a
  // closed popover is `display: none`, which would hide the tile.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!expanded || !el) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const stack = [...layers.below, el, ...layers.above].filter(
      (layer): layer is HTMLElement => layer !== null,
    );
    const unlift = liftStack(stack, el);
    const release = inertOutside(stack);
    // A shared buffer lifted with this one must stop painting every other tile
    // over it.
    surface?.scope(el);
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      surface?.scope(null);
      release();
      unlift();
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  }, [expanded, layers, surface]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      set(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded, set]);

  const onDoubleClick = (e: MouseEvent<HTMLDivElement>): void => {
    if (disabled || !expandOnDoubleClick || !opensLightbox(e, e.currentTarget)) return;
    e.preventDefault();
    set(!expanded);
  };

  // Only the margin around the frame is the root's own surface.
  const onClick = (e: MouseEvent<HTMLDivElement>): void => {
    if (expanded && e.target === e.currentTarget) set(false);
  };

  const classes = ['lk-lightbox'];
  if (expanded) classes.push('lk-lightbox--expanded');
  if (className) classes.push(className);

  let control: ReactNode = null;
  if (expanded) {
    control = (
      <button
        ref={closeRef}
        type="button"
        className="lk-lightbox__button lk-lightbox__close"
        aria-label="Close expanded view"
        title="Close (Esc)"
        onClick={() => set(false)}
      >
        <CloseIcon size={16} />
      </button>
    );
  } else if (!disabled && claims === 0) {
    control = (
      <button
        type="button"
        className="lk-lightbox__button lk-lightbox__open"
        aria-label="Expand"
        title="Expand"
        onClick={() => set(true)}
      >
        <FullscreenIcon size={16} />
      </button>
    );
  }

  return (
    <LightboxContext.Provider value={ctx}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the double-click is an opt-in shortcut; the expand and close buttons are the keyboard path */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the margin click mirrors Escape, which is handled on the document */}
      <div
        ref={rootRef}
        className={classes.join(' ')}
        {...(expanded ? dialogProps(label) : null)}
        onDoubleClick={onDoubleClick}
        onClick={onClick}
      >
        <div className="lk-lightbox__frame">{children}</div>
        {control}
      </div>
    </LightboxContext.Provider>
  );
}
