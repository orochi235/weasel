import type React from 'react';
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Corner,
  DEFAULT_ANCHOR,
  DEFAULT_INSET,
  FLOATING_DRAG_PREFIX,
  type FloatingPlacement,
  floatingStrategy,
} from 'windease';

/** The strategy holds a map keyed by item id; a panel is always a lone item. */
const ITEM_ID = 'panel';

/** Props for `<FloatingPanel>`. */
export interface FloatingPanelProps {
  children: ReactNode;
  /** Corner it rests in before it has ever been dragged. Default `'bottom-left'`. */
  anchor?: Corner;
  /** Corners that may capture it. Default: all four. */
  snapCorners?: readonly Corner[];
  /** Pixels in from a corner when snapped. Default 12. */
  inset?: number;
  /** localStorage key to remember its position under. Omit to forget on reload. */
  storageKey?: string;
  className?: string;
}

/** A pointerdown on one of these is the child's, not a drag. */
function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('input, button, a, select, textarea, [data-no-drag]') !== null;
}

function readStored(key: string | undefined): FloatingPlacement | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as FloatingPlacement) : null;
  } catch {
    return null;
  }
}

/**
 * A draggable box that floats over its offset parent and snaps to its corners.
 *
 * Drives windease's `floatingStrategy` as a pure function rather than mounting a
 * windease container: a lab overlay has one item and no zone tree, so the node
 * model would be all cost. Pointer handling is therefore this component's, and
 * windease's own affordance rendering never participates.
 */
export function FloatingPanel({
  children,
  anchor = DEFAULT_ANCHOR,
  snapCorners,
  inset = DEFAULT_INSET,
  storageKey,
  className,
}: FloatingPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const strategy = useMemo(() => floatingStrategy(), []);
  const options = useMemo(() => ({ defaultAnchor: anchor, inset }), [anchor, inset]);

  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [place, setPlace] = useState<FloatingPlacement>(
    () => readStored(storageKey) ?? { x: 0, y: 0, anchor },
  );

  const item = useMemo(
    () => ({
      id: ITEM_ID,
      meta: { floating: true, ...(snapCorners ? { snapCorners: [...snapCorners] } : {}) },
      natural: size,
    }),
    [size, snapCorners],
  );

  useEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent ?? el?.parentElement;
    if (!el || !parent) return;
    // Sizes come off the entry, not the DOM: jsdom reports 0 for every
    // clientWidth/offsetWidth, and an unmeasured item is withheld from layout.
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const next = { w: entry.contentRect.width, h: entry.contentRect.height };
        if (entry.target === parent) setContainer(next);
        else setSize(next);
      }
    });
    observer.observe(parent);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rect = strategy.layout({
    items: [item],
    container,
    state: { at: { [ITEM_ID]: place }, inner: undefined },
    options,
  }).placements.get(ITEM_ID);

  const dragging = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isInteractive(e.target)) return;
    // The canvas stack underneath owns pan/zoom on the same pointer events.
    e.stopPropagation();
    dragging.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const from = dragging.current;
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (dx === 0 && dy === 0) return;
    dragging.current = { x: e.clientX, y: e.clientY };
    setPlace(
      (prev) =>
        strategy.reduce?.(
          { at: { [ITEM_ID]: prev }, inner: undefined },
          {
            affordanceId: `${FLOATING_DRAG_PREFIX}${ITEM_ID}`,
            kind: 'drag',
            payload: { dx, dy },
          },
          { container, options, items: [item] },
        ).at[ITEM_ID] ?? prev,
    );
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      className={className ? `lk-floating-panel ${className}` : 'lk-floating-panel'}
      data-dragging={isDragging ? 'true' : undefined}
      data-placed={rect ? 'true' : undefined}
      onPointerCancel={endDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      ref={ref}
      style={
        {
          position: 'absolute',
          left: `${rect?.x ?? 0}px`,
          top: `${rect?.y ?? 0}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
