import { startThresholdDrag, type ThresholdDragHandle } from '@weasel-js/core';
import { useKitSetting, useLatest } from '@weasel-js/react';
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type Corner,
  DEFAULT_INSET,
  FLOATING_DRAG_PREFIX,
  type FloatingPlacement,
  floatingStrategy,
} from 'windease';

/** The strategy holds a map keyed by item id; a floating box is always a lone item. */
const ITEM_ID = 'panel';

/** What {@link useFloatingPlacement} reads. */
export interface FloatingPlacementOptions {
  /** The floating box itself. */
  panelRef: RefObject<HTMLElement | null>;
  /** The box it floats over. Default: the panel's offset parent, else its parent. */
  containerRef?: RefObject<HTMLElement | null>;
  /** Where it rests. Controlled: a drag reports its result through `onPlacementChange` and moves nothing itself. */
  placement: FloatingPlacement;
  /** Called once per drag, on release, with where the drag left it. */
  onPlacementChange: (next: FloatingPlacement) => void;
  /** Corners that may capture it. Default: all four. */
  snapCorners?: readonly Corner[];
  /** Pixels in from a corner when snapped. Default windease's `DEFAULT_INSET`. */
  inset?: number;
}

/** What {@link useFloatingPlacement} returns. */
export interface FloatingPlacementResult {
  /** Absolute position for the panel element. */
  style: CSSProperties;
  /** The panel's `onPointerDown`. */
  startDrag: (e: ReactPointerEvent) => void;
  /** True between the drag crossing its threshold and its release or cancel. */
  dragging: boolean;
  /** False until both boxes are measured; an unmeasured panel has no position yet. */
  placed: boolean;
}

/**
 * The panel's footprint is its border box — `contentRect` excludes padding and
 * border, which would place a panel that then overflows its corner by exactly
 * that much.
 */
function borderBoxOf(entry: ResizeObserverEntry): { w: number; h: number } {
  const box = entry.borderBoxSize?.[0];
  if (box) return { w: box.inlineSize, h: box.blockSize };
  return { w: entry.contentRect.width, h: entry.contentRect.height };
}

/** A pointerdown on one of these is the child's, not a drag. */
function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('input, button, a, select, textarea, [data-no-drag]') !== null;
}

/**
 * Places a box over its container and lets a drag move it, snapping to the container's corners.
 *
 * Drives windease's `floatingStrategy` as a pure function rather than mounting a windease container: one item and
 * no zone tree, so the node model would be all cost. The drag is threshold-gated and captures the pointer only once
 * it is a drag, so a press on a non-native control inside the box still clicks it. The box follows the pointer
 * while dragging; the release reports the result once, and Escape puts it back. Persists nothing.
 */
export function useFloatingPlacement({
  panelRef,
  containerRef,
  placement,
  onPlacementChange,
  snapCorners,
  inset = DEFAULT_INSET,
}: FloatingPlacementOptions): FloatingPlacementResult {
  const strategy = useMemo(() => floatingStrategy(), []);
  const options = useMemo(() => ({ inset }), [inset]);
  const dragPx = useKitSetting('gestures.dragPx');

  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [live, setLive] = useState<FloatingPlacement | null>(null);

  const item = useMemo(
    () => ({
      id: ITEM_ID,
      meta: { floating: true, ...(snapCorners ? { snapCorners: [...snapCorners] } : {}) },
      natural: size,
    }),
    [size, snapCorners],
  );

  useEffect(() => {
    const el = panelRef.current;
    const parent = containerRef?.current ?? el?.offsetParent ?? el?.parentElement;
    if (!el || !parent) return;
    // Sizes come off the entry, not the DOM: jsdom reports 0 for every
    // clientWidth/offsetWidth, and an unmeasured item is withheld from layout.
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === parent) {
          setContainer({ w: entry.contentRect.width, h: entry.contentRect.height });
        } else {
          setSize(borderBoxOf(entry));
        }
      }
    });
    observer.observe(parent);
    observer.observe(el);
    return () => observer.disconnect();
  }, [panelRef, containerRef]);

  const rect = strategy
    .layout({
      items: [item],
      container,
      state: { at: { [ITEM_ID]: live ?? placement }, inner: undefined },
      options,
    })
    .placements.get(ITEM_ID);

  // A drag outlives the render that started it, so the reducer's inputs are
  // read here and not from that render's closure — a container resized
  // mid-drag would otherwise place the panel against its old box.
  const latest = useLatest({ container, options, item, placement, onPlacementChange, dragPx });
  const drag = useRef<ThresholdDragHandle | null>(null);

  useEffect(() => () => drag.current?.cancel(), []);

  const startDrag = (e: ReactPointerEvent): void => {
    if (isInteractive(e.target)) return;
    // The canvas stack underneath owns pan/zoom on the same pointer events.
    e.stopPropagation();
    let last = { x: e.clientX, y: e.clientY };
    let at = latest.current.placement;
    let moved = false;
    const end = (): void => {
      drag.current = null;
      setLive(null);
    };
    drag.current = startThresholdDrag(e, {
      threshold: latest.current.dragPx,
      captureAt: 'threshold',
      onActivate: () => setLive(at),
      onMove: (ev) => {
        const dx = ev.clientX - last.x;
        const dy = ev.clientY - last.y;
        if (dx === 0 && dy === 0) return;
        last = { x: ev.clientX, y: ev.clientY };
        const { container: box, options: opts, item: only } = latest.current;
        at =
          strategy.reduce?.(
            { at: { [ITEM_ID]: at }, inner: undefined },
            { affordanceId: `${FLOATING_DRAG_PREFIX}${ITEM_ID}`, kind: 'drag', payload: { dx, dy } },
            { container: box, options: opts, items: [only] },
          ).at[ITEM_ID] ?? at;
        moved = true;
        setLive(at);
      },
      onCommit: () => {
        end();
        if (moved) latest.current.onPlacementChange(at);
      },
      onCancel: end,
    });
  };

  return {
    style: { position: 'absolute', left: `${rect?.x ?? 0}px`, top: `${rect?.y ?? 0}px` },
    startDrag,
    dragging: live !== null,
    placed: rect !== undefined,
  };
}
