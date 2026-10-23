import { useEffect, useRef, useState, type FocusEvent as ReactFocusEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { keysHeld, modifiersOf, openPointerSession, type PointerSession } from '@weasel-js/core';
import { isApplePlatform } from '@weasel-js/gestures';
import { clamp, type RunSpot, type TrackRun } from '@weasel-js/geom';
import { useLatest, usePrefersReducedMotion, useVisibleRaf } from '@weasel-js/react';
import { boxPoint } from './boxPoint';
import type { RunItemsOf, RunKeyOf } from './useItemLengths';

/** Px a press must travel along the run before it is a scroll rather than a press on an item. */
export const SCROLL_SLOP = 4;

/** Px one line of a line-mode wheel moves the run. */
const LINE = 16;

/** Ms over which a glide closes all but 1/e of the way to its target. */
export const GLIDE_MS = 60;

/** Px from its target at which a glide lands on it. */
const LAND = 0.25;

/** Capture at the press would retarget the release and kill the click on whatever item was pressed. */
const NO_CAPTURE = { capture: false } as const;

/** What {@link useRunScroll} reads: the run's root, its run, how long its items lie end to end, and where each falls now. */
export interface RunScrollArgs {
  root: RefObject<HTMLElement | null>;
  /** Which of the root's children lie on the run, in run order: those it reads a key off. */
  keyOf: RunKeyOf;
  /** Where under the root the items are found. Default: its own children. */
  itemsOf?: RunItemsOf;
  /** The band drawn across the root's box while the run scrolls, which pointers are measured through; else the root. */
  frame?: RefObject<SVGSVGElement | null>;
  run: TrackRun;
  total: number;
  spots: () => readonly RunSpot[];
  lengths: readonly number[];
}

/** A curved run's offset along itself, and the handlers its root takes so a press, drag or focus moves it. */
export interface RunScroll {
  offset: number;
  onPointerDownCapture: (e: ReactPointerEvent) => void;
  onFocusCapture: (e: ReactFocusEvent) => void;
}

/**
 * The offset a curved run's items are laid back by along its run when they run past its end: moved by the wheel,
 * by a drag along the run once it travels {@link SCROLL_SLOP} px (a press with Cmd, or Ctrl off Apple platforms, is left
 * to a reorder), and by focus reaching an item past either end.
 * A run whose items fit keeps offset 0 and ignores all three. The wheel and focus glide to where they send the run
 * over about {@link GLIDE_MS} ms, so items slide rather than jump; a drag follows the pointer, and a reader who
 * prefers reduced motion gets every move at once.
 */
export function useRunScroll({ root, keyOf, itemsOf, frame, run, total, spots, lengths }: RunScrollArgs): RunScroll {
  const max = Math.max(0, total - run.length);
  const [shown, setShown] = useState(0);
  const offset = clamp(shown, 0, max);
  const latest = useLatest({ max, run, spots, lengths, keyOf, itemsOf });
  const still = usePrefersReducedMotion();
  // Where the handlers last sent the run, ahead of the render it asks for, so two wheel events in one frame both count.
  const moved = useRef(0);
  // Where the run is drawn mid-glide, and the frame time the glide last stepped from.
  const drawn = useRef(0);
  const last = useRef<number | null>(null);
  const session = useRef<PointerSession | null>(null);

  const show = (at: number): void => {
    drawn.current = at;
    setShown(at);
  };
  const glide = useVisibleRaf((time, loop) => {
    const target = clamp(moved.current, 0, latest.current.max);
    const dt = last.current === null ? 16 : time - last.current;
    last.current = time;
    const next = drawn.current + (target - drawn.current) * (1 - Math.exp(-dt / GLIDE_MS));
    if (Math.abs(target - next) <= LAND) {
      last.current = null;
      show(target);
      return;
    }
    show(next);
    loop.request();
  }, { target: root, onResume: () => { last.current = null; } });

  const now = (): number => clamp(moved.current, 0, latest.current.max);
  const scrollTo = (next: number, how: 'glide' | 'jump' = 'glide'): boolean => {
    const to = clamp(next, 0, latest.current.max);
    if (to === now()) return false;
    moved.current = to;
    if (how === 'jump' || still) {
      glide.cancel();
      last.current = null;
      show(to);
    } else glide.request();
    return true;
  };
  const wheel = useLatest((e: WheelEvent): void => {
    const delta = (e.deltaY || e.deltaX) * (e.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE : 1);
    if (scrollTo(now() + delta)) e.preventDefault();
  });

  const active = max > 0;
  useEffect(() => {
    const el = root.current;
    if (!active || el === null) return;
    const onWheel = (e: WheelEvent): void => wheel.current(e);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [root, active, wheel]);

  useEffect(() => () => session.current?.cancel(), []);

  const onPointerDownCapture = (e: ReactPointerEvent): void => {
    const el = root.current;
    if (latest.current.max <= 0 || el === null || e.button !== 0 || keysHeld(['mod'], modifiersOf(e), isApplePlatform()) || !el.contains(e.target as Node)) return;
    session.current?.cancel();
    const across = frame?.current ?? el;
    const s0 = positionAt(across, latest.current.run, e);
    const from = now();
    let scrolling = false;
    const onMove = (ev: PointerEvent): void => {
      const travel = positionAt(across, latest.current.run, ev) - s0;
      if (!scrolling && Math.abs(travel) > SCROLL_SLOP) {
        scrolling = true;
        // Once it is a drag the root takes the pointer, so the release lands off the item and its press cancels.
        try {
          el.setPointerCapture?.(ev.pointerId);
        } catch {
          /* a pointer already gone: nothing to retarget */
        }
      }
      if (scrolling) scrollTo(from - travel, 'jump');
    };
    const onEnd = (): void => {
      session.current = null;
      if (scrolling) swallowClick(el.ownerDocument);
    };
    const onCancel = (): void => {
      session.current = null;
    };
    session.current = openPointerSession(el, e, { onMove, onEnd, onCancel }, NO_CAPTURE);
  };

  const onFocusCapture = (e: ReactFocusEvent): void => {
    const el = root.current;
    const { max: most, run: along, spots: where, lengths: sizes, keyOf: keyed, itemsOf: found } = latest.current;
    if (most <= 0 || el === null) return;
    const index = runIndex(el, keyed, e.target as Node, found);
    const spot = index < 0 ? undefined : where()[index];
    if (spot === undefined) return;
    const half = (sizes[index] ?? 0) / 2;
    // The spots are where the run is drawn, which mid-glide lags where it is going.
    const center = spot.center + drawn.current - now();
    const lo = center - half;
    const hi = center + half;
    if (lo < 0) scrollTo(now() + lo);
    else if (hi > along.length) scrollTo(now() + hi - along.length);
  };

  return { offset, onPointerDownCapture, onFocusCapture };
}

/**
 * How far along `run` the pointer is, in px, `run`'s coordinates being the box `frame` fills: past either end, carried
 * on along the end's tangent, so a drag that leaves the run keeps scrolling it.
 */
export function positionAt(frame: Element, run: TrackRun, e: { clientX: number; clientY: number }): number {
  const p = boxPoint(frame, e.clientX, e.clientY);
  const { f } = run.nearest(p);
  const beyond = (g: 0 | 1): number => {
    const { point, tangent } = run.at(g);
    return (p.x - point.x) * tangent.x + (p.y - point.y) * tangent.y;
  };
  if (f <= 0) return Math.min(0, beyond(0));
  if (f >= 1) return run.length + Math.max(0, beyond(1));
  return f * run.length;
}

/** Where along the run the item holding `target` falls: its index among `root`'s items `keyOf` reads a key off, or -1. */
function runIndex(root: HTMLElement, keyOf: RunKeyOf, target: Node, itemsOf?: RunItemsOf): number {
  const items = Array.from(itemsOf ? itemsOf(root) : root.children).filter((child) => keyOf(child) !== null);
  return items.findIndex((item) => item.contains(target));
}

/** Swallow the click a drag's release is about to raise; a release that raises none lets go before the next task. */
function swallowClick(doc: Document): void {
  const swallow = (e: Event): void => {
    e.stopPropagation();
    e.preventDefault();
  };
  doc.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => doc.removeEventListener('click', swallow, { capture: true }), 0);
}
