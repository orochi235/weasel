/**
 * The hover half of the pointer channel: a `hover` event for each move of the
 * pointer, marked `held` while a button is down, and the cursor shown for what
 * a press there would do.
 */
import { createCursorSink, resolveCursor, type CursorSink, type CursorSpec, type PaintedCursorState } from '@weasel-js/cursor';
import { actionCursor } from '../../actions/action';
import type { DispatchCore } from '../dispatchCore';
import type { Dispatcher, ResolveOnlyResult } from '../dispatcherApi';
import type { InputEvent } from '../matcher';
import { underPointer } from '../underPointer';
import { anyBinding } from '../walk';
import { hoverReports, type Hover } from './hoverFacts';

const hoverOf = (e: Hover): Hover => ({
  clientX: e.clientX, clientY: e.clientY,
  altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
});

export interface HoverCursorInput {
  /** A pointer moved, and its move has been dispatched. */
  moved(e: PointerEvent): void;
  /** A pointer was released: re-resolve where it let go. */
  released(e: PointerEvent): void;
  onLeave(): void;
  /** A modifier or hotkey changed, which re-routes the predicted drag with no pointer movement. */
  onKey(e: KeyboardEvent): void;
  /** A dispatcher changed: a gesture in flight may show another cursor with no input to carry it, as a
   *  dwell elapsing under a held pointer does. */
  changed(): void;
  /** Withdraw everything shown for the pointer: the cursor, its painted position, and the trace's live prediction. */
  clear(): void;
}

/** Where the hover cursor writes: the surface's own sink, else one on `canvas`. */
function cursorOverride(
  canvas: HTMLElement | null,
  paintedCursor: () => PaintedCursorState | undefined,
  cursorSink: () => CursorSink | undefined,
): { apply(spec: CursorSpec | null): void; clear(): void } {
  const ownSink = createCursorSink({ element: () => canvas, painted: paintedCursor });
  let wrote: CursorSink | null = null;
  // The surface's sink can arrive after the first write, which must not stay on the sink it left.
  const sink = (): CursorSink => {
    const next = cursorSink() ?? ownSink;
    if (wrote !== null && wrote !== next) wrote.setOverride(null);
    wrote = next;
    return next;
  };
  return {
    apply: (spec) => sink().setOverride(spec === null ? null : resolveCursor(spec)),
    clear: () => sink().setOverride(null),
  };
}

/**
 * Idle, the cursor is the first of: an affordance hit's `cursor`; the
 * `Action.cursor` of the action a drag from here would route to; that of the
 * action a click here would route to; no override. Mid-gesture it is the
 * in-flight action's `activeCursor`.
 */
/**
 * Whether a binding hears a hover now: always with no pointer held, and with one held only when a
 * binding hears held moves, asked once a press so a drag nothing listens to is not hit-tested on every move.
 */
function hoverHeard(pointersHeld: () => number, ctxNow: DispatchCore['ctxNow']): { hears: () => boolean; forget: () => void } {
  let heldHeard: boolean | null = null;
  return {
    hears: () => {
      if (pointersHeld() === 0) {
        heldHeard = null;
        return true;
      }
      heldHeard ??= anyBinding(ctxNow(), (s) => s.kind === 'hover' && s.held !== undefined);
      return heldHeard;
    },
    forget: () => { heldHeard = null; },
  };
}

/** `at`, routed to the view under it when no pointer is held: the route may still be a released drag's. A held pointer keeps the view it is pinned to. */
function routeIdle(core: Pick<DispatchCore, 'routeAt'>, pointersHeld: () => number, at: Hover): Hover {
  if (pointersHeld() === 0) core.routeAt(null, at.clientX, at.clientY);
  return at;
}

export interface HoverCursorSources {
  paintedCursor: () => PaintedCursorState | undefined;
  /** Pointers down on the canvas with any button, `heldPointers`' count. */
  pointersHeld: () => number;
  /** Every live dispatcher on the surface: a gesture in flight on any of them owns the cursor. */
  dispatchers: () => readonly Dispatcher[];
  /** The surface's own sink, which also holds its tool cursor. Without one
   *  the override is written to the canvas and removed when it clears. */
  cursorSink?: () => CursorSink | undefined;
}

/** The dispatcher a gesture is in flight on, the routed view's first. */
function flyingOn(core: Pick<DispatchCore, 'dispatcherNow'>, dispatchers: () => readonly Dispatcher[]): Dispatcher | null {
  const routed = core.dispatcherNow();
  if (routed.inFlight().size > 0) return routed;
  return dispatchers().find((d) => d.inFlight().size > 0) ?? null;
}

export function hoverCursorInput(core: DispatchCore, src: HoverCursorSources): HoverCursorInput {
  const { paintedCursor, pointersHeld } = src;
  const { canvas, routeAt, toWorld, target, dispatcherNow, ctxNow } = core;
  const override = cursorOverride(canvas, paintedCursor, src.cursorSink ?? (() => undefined));
  let last: Hover | null = null;
  /** Whether a gesture was in flight at the last notify. */
  let flying = false;
  /** Whether the pointer left the canvas: what a held one does outside shows nothing until it is back. */
  let left = false;
  /** What the last move found under the pointer, so its hover and its cursor hit-test once. */
  const reports = hoverReports(core, pointersHeld);
  const heard = hoverHeard(pointersHeld, ctxNow);

  const resolve = (): void => {
    if (!canvas || !last) return;
    const on = flyingOn(core, src.dispatchers);
    if (pointersHeld() > 0 || on) {
      ctxNow().trace?.setLive(null);
      override.apply((on ?? dispatcherNow()).inFlightCursor());
      return;
    }
    const h = last;
    // Only idle: mid-gesture the branch above returned, so a pinned pointer
    // is never unpinned by a hover refresh.
    routeAt(null, h.clientX, h.clientY);
    const w = toWorld(h.clientX, h.clientY);
    const where = reports.whereAt(h) ?? underPointer(target(), h, w);
    const ctx = ctxNow();
    const d = dispatcherNow();
    const press: InputEvent = { kind: 'pointerdown', x: w.x, y: w.y, clientX: h.clientX, clientY: h.clientY, ...where };
    if (ctx.trace?.recording()) ctx.trace.setLive(() => d.explain(press, ctx));
    if (where.affordance?.cursor) {
      override.apply(where.affordance.cursor);
      return;
    }
    const click: InputEvent = { kind: 'click', x: w.x, y: w.y, pressX: w.x, pressY: w.y, ...where };
    const cursorOf = (r: ResolveOnlyResult | null) => (r ? actionCursor(r.action, r.params) : undefined);
    const cursor = cursorOf(d.resolveOnly(press, ctx)) ?? cursorOf(dispatcherNow().resolveOnly(click, ctx));
    override.apply(cursor ?? null);
  };

  const refresh = (): void => {
    resolve();
    // After the cursor is resolved, not before: on the move that first selects
    // a painted cursor, a position written ahead of the decision is discarded.
    // Guarded on `active()`, so a CSS cursor costs no layout read per move.
    const painted = paintedCursor();
    if (!painted?.active() || !canvas || !last) return;
    const local = core.toCanvasLocal(last.clientX, last.clientY);
    painted.setPointer(local.x, local.y);
  };
  // A tick later, so state the event changed (hotkey stack, active tool,
  // selection) has committed before the prediction reruns.
  const refreshSoon = (): void => {
    setTimeout(() => { if (!core.disposed()) refresh(); }, 0);
  };

  const clear = (): void => {
    if (last) {
      ctxNow().trace?.setLive(null);
      paintedCursor()?.clearPointer();
    }
    reports.forget();
    last = null;
    override.clear();
  };

  /** Whether the pointer is off the canvas it left, so nothing is shown for it. */
  const away = (): boolean => {
    if (left && canvas && !core.pointerOver()) return true;
    left = false;
    return false;
  };

  return {
    moved(e) {
      if (away()) return;
      last = hoverOf(e);
      if (heard.hears()) reports.hover(last);
      else reports.unheard();
      refresh();
    },
    released(e) {
      heard.forget();
      if (away()) return;
      last = hoverOf(e);
      reports.released(last);
      refreshSoon();
    },
    onLeave() {
      reports.leave(last);
      clear();
      left = true;
    },
    onKey(e) {
      if (!last) return;
      const prev = last;
      last = { ...last, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey };
      const changed = prev.altKey !== last.altKey || prev.ctrlKey !== last.ctrlKey
        || prev.metaKey !== last.metaKey || prev.shiftKey !== last.shiftKey;
      // A modifier changing over a resting pointer is a hover with new modifiers.
      if (changed && heard.hears()) reports.hover(routeIdle(core, pointersHeld, last));
      refreshSoon();
    },
    changed() {
      const was = flying;
      const on = flyingOn(core, src.dispatchers);
      flying = on !== null;
      if (!canvas || !last) return;
      if (on) override.apply(on.inFlightCursor());
      // The last gesture ended with no release or keyup over the pointer to resolve the idle cursor.
      else if (was) refreshSoon();
    },
    clear,
  };
}
