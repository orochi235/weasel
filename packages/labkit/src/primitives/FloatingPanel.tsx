import { useFloatingPlacement } from '@weasel-js/ui/floating';
import { type ReactNode, useRef } from 'react';
import { type Corner, DEFAULT_ANCHOR, DEFAULT_INSET, type FloatingPlacement } from 'windease';
import { usePersistedState } from '../state/usePersistedState';

/** Props for `<FloatingPanel>`. */
export interface FloatingPanelProps {
  children: ReactNode;
  /** Corner it rests in before it has ever been dragged. Default `'bottom-left'`. */
  anchor?: Corner;
  /** Corners that may capture it. Default: all four. */
  snapCorners?: readonly Corner[];
  /** Pixels in from a corner when snapped. Default 12. */
  inset?: number;
  /** Name to remember its position under, through `usePersistedState` — so it
   *  is remembered only inside a lab or a `<Persistence>`. Omit to forget on
   *  reload. */
  persist?: string;
  className?: string;
}

/**
 * A draggable box that floats over its offset parent and snaps to its corners.
 *
 * Placement and dragging are `useFloatingPlacement`'s, from `@weasel-js/ui`; this component adds the element and
 * remembers where it was left through `usePersistedState`.
 */
export function FloatingPanel({
  children,
  anchor = DEFAULT_ANCHOR,
  snapCorners,
  inset = DEFAULT_INSET,
  persist,
  className,
}: FloatingPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = usePersistedState<FloatingPlacement>(persist, () => ({
    x: 0,
    y: 0,
    anchor,
  }));
  const { style, startDrag, dragging, placed } = useFloatingPlacement({
    panelRef: ref,
    placement: place,
    onPlacementChange: setPlace,
    snapCorners,
    inset,
  });

  return (
    <div
      className={className ? `lk-floating-panel ${className}` : 'lk-floating-panel'}
      data-dragging={dragging ? 'true' : undefined}
      data-placed={placed ? 'true' : undefined}
      onPointerDown={startDrag}
      ref={ref}
      style={style}
    >
      {children}
    </div>
  );
}
