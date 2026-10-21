/**
 * The hover half of the pointer channel: a `hover` event for each move of the
 * pointer, marked `held` while a button is down, and the cursor shown for what
 * a press there would do.
 */
import { createCursorSink, resolveCursorTier, type CursorSink, type CursorSpec, type PaintedCursorState } from '@weasel-js/cursor';
import type { EventModifiers, HoverWhere } from '@weasel-js/gestures';
import { actionCursor } from '../../actions/action';
import type { DispatchCore } from '../dispatchCore';
import type { ResolveOnlyResult } from '../dispatcherApi';
import type { InputEvent } from '../matcher';
import { underPointer, type UnderPointer } from '../underPointer';
import { anyBinding } from '../walk';

type Hover = EventModifiers & { clientX: number; clientY: number };

const whereOf = ({ affordance, bodyTarget, bodyKind }: UnderPointer): HoverWhere => ({
  ...(affordance !== undefined ? { affordance } : {}),
  ...(bodyTarget !== undefined ? { bodyTarget } : {}),
  ...(bodyKind !== undefined ? { bodyKind } : {}),
});

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
  clear(): void;
}

/**
 * Idle, the cursor is the first of: an affordance hit's `cursor`; the
 * `Action.cursor` of the action a drag from here would route to; that of the
 * action a click here would route to; no override. Mid-gesture it is the
 * in-flight action's `activeCursor`.
 */
export function hoverCursorInput(
  core: DispatchCore,
  paintedCursor: () => PaintedCursorState | undefined,
  /** Pointers down on the canvas with any button, `heldPointers`' count. */
  pointersHeld: () => number,
  /** The surface's own sink, which also holds its tool cursor. Without one
   *  the override is written to the canvas and removed when it clears. */
  cursorSink: () => CursorSink | undefined = () => undefined,
): HoverCursorInput {
  const { canvas, routeAt, toWorld, target, dispatch, dispatcherNow, ctxNow } = core;
  const ownSink = createCursorSink({ element: () => canvas, painted: paintedCursor });
  const override = {
    apply: (spec: CursorSpec | null): void =>
      (cursorSink() ?? ownSink).setOverride(spec === null ? null : resolveCursorTier(spec)),
    clear: (): void => (cursorSink() ?? ownSink).setOverride(null),
  };
  let last: Hover | null = null;
  /** What the last move found under the pointer, so its hover and its cursor hit-test once. */
  let facts: { at: Hover; where: UnderPointer } | null = null;
  /** Whether a binding hears a held pointer's moves, asked once a press, so a
   *  drag nothing listens to is not hit-tested on every move. */
  let heldHeard: boolean | null = null;
  const hears = (): boolean => {
    if (pointersHeld() === 0) {
      heldHeard = null;
      return true;
    }
    heldHeard ??= anyBinding(ctxNow(), (s) => s.kind === 'hover' && s.held !== undefined);
    return heldHeard;
  };

  const resolve = (): void => {
    if (!canvas || !last) return;
    if (pointersHeld() > 0 || dispatcherNow().inFlight().size > 0) {
      override.apply(dispatcherNow().inFlightCursor());
      return;
    }
    const h = last;
    // Only idle: mid-gesture the branch above returned, so a pinned pointer
    // is never unpinned by a hover refresh.
    routeAt(null, h.clientX, h.clientY);
    const w = toWorld(h.clientX, h.clientY);
    const where = facts?.at === h ? facts.where : underPointer(target(), h, w);
    if (where.affordance?.cursor) {
      override.apply(where.affordance.cursor);
      return;
    }
    const ctx = ctxNow();
    const d = dispatcherNow();
    const press: InputEvent = { kind: 'pointerdown', x: w.x, y: w.y, clientX: h.clientX, clientY: h.clientY, ...where };
    if (ctx.trace?.recording()) ctx.trace.setLive(() => d.explain(press, ctx));
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

  const hoverAt = (at: Hover): void => {
    const w = toWorld(at.clientX, at.clientY);
    const where = underPointer(target(), at, w);
    const from = facts ? { from: whereOf(facts.where) } : {};
    const held = pointersHeld() > 0 ? { held: true } : {};
    facts = { at, where };
    dispatch({ kind: 'hover', x: w.x, y: w.y, clientX: at.clientX, clientY: at.clientY, ...where, ...from, ...held });
  };

  return {
    moved(e) {
      last = hoverOf(e);
      if (hears()) hoverAt(last);
      refresh();
    },
    released(e) {
      heldHeard = null;
      last = hoverOf(e);
      refreshSoon();
    },
    onLeave() {
      if (facts) {
        const { at, where } = facts;
        const w = toWorld(at.clientX, at.clientY);
        dispatch({ kind: 'hover', off: true, x: w.x, y: w.y, clientX: at.clientX, clientY: at.clientY, ...where, from: whereOf(where) });
      }
      facts = null;
      last = null;
      ctxNow().trace?.setLive(null);
      paintedCursor()?.clearPointer();
      override.clear();
    },
    onKey(e) {
      if (!last) return;
      const prev = last;
      last = { ...last, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey };
      const changed = prev.altKey !== last.altKey || prev.ctrlKey !== last.ctrlKey
        || prev.metaKey !== last.metaKey || prev.shiftKey !== last.shiftKey;
      // A modifier changing over a resting pointer is a hover with new modifiers.
      if (changed && hears()) hoverAt(last);
      refreshSoon();
    },
    clear: override.clear,
  };
}
