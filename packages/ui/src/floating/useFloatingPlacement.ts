import { startThresholdDrag, type ThresholdDragHandle } from '@weasel-js/core';
import { useKitSetting, useLatest } from '@weasel-js/react';
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type Corner, DEFAULT_INSET, type FloatingPlacement } from 'windease';
import { dragPlacement, floatingItem, ITEM_ID, STRATEGY } from './dragPlacement';

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

/** The box a container lays its children out in, as an observer's `contentRect` gives it. */
function contentBoxOf(el: Element): { w: number; h: number } {
  const css = getComputedStyle(el);
  const px = (v: string) => Number.parseFloat(v) || 0;
  return {
    w: el.clientWidth - px(css.paddingLeft) - px(css.paddingRight),
    h: el.clientHeight - px(css.paddingTop) - px(css.paddingBottom),
  };
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
 * while dragging; the release reports the result once, and the box stays where it was dropped until `placement`
 * changes or the next press. That hold compares `placement` by identity, so a host passes a stable object, not one
 * built afresh each render. Each move places the box from where it was pressed by the pointer's whole travel, so a
 * corner it passed or an edge it was held against does not offset it from the pointer. Only the primary button drags.
 * Escape puts it back. Persists nothing.
 */
export function useFloatingPlacement({
  panelRef,
  containerRef,
  placement,
  onPlacementChange,
  snapCorners,
  inset = DEFAULT_INSET,
}: FloatingPlacementOptions): FloatingPlacementResult {
  const options = useMemo(() => ({ inset }), [inset]);
  const dragPx = useKitSetting('gestures.dragPx');

  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Where a drag has the box, and the placement it started from. After the release it holds until `placement` moves
  // off that one, so a host that commits a tick later never shows the box back where it was.
  const [live, setLive] = useState<{ at: FloatingPlacement; over: FloatingPlacement; dragging: boolean } | null>(null);
  const shown = live && (live.dragging || live.over === placement) ? live.at : placement;

  const item = useMemo(() => floatingItem(size, snapCorners), [size, snapCorners]);

  useLayoutEffect(() => {
    const el = panelRef.current;
    const parent = containerRef?.current ?? el?.offsetParent ?? el?.parentElement;
    if (!el || !parent) return;
    // Measured before the first paint, since the observer's first report lands a frame later and the box has no place
    // until then. jsdom reports 0 for every DOM size, so there only the observer's entries count.
    const panel = { w: el.offsetWidth, h: el.offsetHeight };
    const room = contentBoxOf(parent);
    if (panel.w > 0 && room.w > 0) {
      setSize(panel);
      setContainer(room);
    }
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

  const rect = STRATEGY
    .layout({
      items: [item],
      container,
      state: { at: { [ITEM_ID]: shown }, inner: undefined },
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
    if (e.button !== 0 || isInteractive(e.target)) return;
    // The canvas stack underneath owns pan/zoom on the same pointer events.
    e.stopPropagation();
    setLive(null);
    const press = { x: e.clientX, y: e.clientY };
    let last = press;
    const over = latest.current.placement;
    let at = over;
    let moved = false;
    const end = (): void => {
      drag.current = null;
      setLive(null);
    };
    drag.current = startThresholdDrag(e, {
      threshold: latest.current.dragPx,
      captureAt: 'threshold',
      onActivate: () => setLive({ at, over, dragging: true }),
      onMove: (ev) => {
        if (ev.clientX === last.x && ev.clientY === last.y) return;
        last = { x: ev.clientX, y: ev.clientY };
        at = dragPlacement(over, ev.clientX - press.x, ev.clientY - press.y, latest.current);
        moved = true;
        setLive({ at, over, dragging: true });
      },
      onCommit: () => {
        drag.current = null;
        if (!moved) return setLive(null);
        setLive({ at, over, dragging: false });
        latest.current.onPlacementChange(at);
      },
      onCancel: end,
    });
  };

  return {
    style: { position: 'absolute', left: `${rect?.x ?? 0}px`, top: `${rect?.y ?? 0}px` },
    startDrag,
    dragging: live?.dragging ?? false,
    placed: rect !== undefined,
  };
}
