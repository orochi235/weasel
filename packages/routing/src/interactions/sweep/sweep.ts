/**
 * A sweep: one drag run across the items of a surface — a row of toggles, a
 * grid of cells — doing something to each item it reaches. It is an action
 * bound to `drag`, so the dispatcher settles it against every other binding:
 * a drag that names a target or a modifier outranks it, an action on another
 * tier outranks it on a tie, and an item running a drag of its own takes the
 * press before it opens. A press either sweeps or drags, never both.
 */
import type { GestureSpec } from '@weasel-js/gestures';
import { ActionDisabledReason, type Action } from '../actions/action';
import type { InvocationCtx } from '../actions/invoker';

/** One item a sweep reaches: its key, and the element `keyOf` named it from. */
export interface SweepItem<K> {
  key: K;
  element: Element;
}

/** The press a sweep would start from: the item pressed, and the gesture's context
 *  (modifiers, deps, the pointer) as the drag opens. */
export interface SweepPress<K> extends SweepItem<K> {
  ctx: InvocationCtx;
}

/** What one sweep does, from the press to the release. */
export interface SweepRun<K> {
  /**
   * The pointer reached `item`: first the pressed item, then each one after
   * it, in the order passed. Called whenever the item under the pointer
   * changes, so an item swept back over is entered again; an item a fast drag
   * crossed between two moves is entered too.
   */
  enter(item: SweepItem<K>): void;
  /** The sweep ended: released, or canceled (Escape, a lost pointer), when a
   *  run that changed something as it went puts it back. */
  end?(how: 'commit' | 'cancel'): void;
}

/** What {@link sweepAction} needs from the surface it sweeps. */
export interface SweepOptions<K> {
  /** Action id. Default `'sweep'`; a surface with two sweeps names them apart. */
  id?: string;
  label?: string;
  /** The element whose items are swept. Items outside it are never reached. */
  surface(): Element | null;
  /** The item `el` is, or `undefined` for an element that is not one (a disabled
   *  toggle, a gap). Asked of the element under the pointer and each ancestor up to the surface. */
  keyOf(el: Element): K | undefined;
  /**
   * Whether a press on `item` sweeps. Asked as the press is routed, so a
   * press it refuses falls through to the next binding that matches.
   * Default: every press on an item.
   */
  accepts?(item: SweepItem<K>, ctx: { deps?: InvocationCtx['deps'] }): boolean;
  /**
   * The input that sweeps. Default {@link SWEEP_BINDING}: a drag under any
   * modifiers, which any drag naming a modifier or a target outranks. A
   * surface that sweeps only with Alt held, or only for a pen, says so here.
   */
  binding?: NonNullable<Action['defaultBinding']>;
  /**
   * Start a sweep from `press`, or answer `null` to decline it as the drag
   * opens, when the modifiers, deps and pointer are all known: the drag is
   * then handed to the next binding that matches, as `accepts` would have.
   */
  begin(press: SweepPress<K>): SweepRun<K> | null;
}

/** A drag under any modifiers: the lowest-ranked drag binding there is. */
export const SWEEP_BINDING: GestureSpec = {
  kind: 'drag',
  mods: { alt: 'optional', ctrl: 'optional', meta: 'optional', shift: 'optional' },
};

/** Travel, in CSS pixels, between the points hit-tested along one move, so a
 *  fast drag reaches every item it crosses. Smaller than any item worth sweeping. */
const STEP_PX = 4;
/** The most points hit-tested along one move: a move longer than this many steps is a jump, tested more sparsely. */
const MAX_STEPS = 4096;

/** The item under client point (`x`, `y`) in `surface`, or `null`. */
function itemAt<K>(surface: Element, keyOf: SweepOptions<K>['keyOf'], x: number, y: number): SweepItem<K> | null {
  const doc = surface.ownerDocument;
  let el = typeof doc.elementFromPoint === 'function' ? doc.elementFromPoint(x, y) : null;
  if (!el || !surface.contains(el)) return null;
  for (; el && el !== surface; el = el.parentElement) {
    const key = keyOf(el);
    if (key !== undefined) return { key, element: el };
  }
  return null;
}

/**
 * An action that sweeps the items of `opts.surface()`, bound by default to
 * {@link SWEEP_BINDING} on the ambient tier: the lowest rank a drag binding can hold. Its
 * points are client pixels, so the surface's dispatcher leaves
 * `clientToWorld` unset; a surface whose items are controls sets
 * `controls: 'take'` on it.
 */
export function sweepAction<K>(opts: SweepOptions<K>): Action {
  const pressed = (at: { x: number; y: number } | undefined): SweepItem<K> | null => {
    const surface = opts.surface();
    return surface && at ? itemAt(surface, opts.keyOf, at.x, at.y) : null;
  };
  return {
    id: opts.id ?? 'sweep',
    label: opts.label ?? 'Sweep',
    defaultBinding: opts.binding ?? SWEEP_BINDING,
    enabled: (deps, at) => {
      const item = pressed(at);
      return item !== null && (opts.accepts?.(item, { deps }) ?? true) ? true : ActionDisabledReason.NotApplicable;
    },
    invoker: {
      timing: 'ongoing',
      start(ctx) {
        const first = pressed(ctx.drag?.start ?? ctx.world);
        const surface = opts.surface();
        if (!first || !surface) return {};
        // An empty handle hands the drag on to the next candidate.
        const run = opts.begin({ ...first, ctx });
        if (!run) return {};
        let current = first;
        let last = ctx.drag?.start ?? ctx.world;
        run.enter(first);
        const reach = (x: number, y: number): void => {
          const item = itemAt(surface, opts.keyOf, x, y);
          if (item && !Object.is(item.key, current.key)) {
            current = item;
            run.enter(item);
          }
        };
        const travel = (to: { x: number; y: number }): void => {
          // A point that is no number lands nowhere, and the next move travels from the last one that did.
          if (!Number.isFinite(to.x) || !Number.isFinite(to.y)) return;
          const dx = to.x - last.x;
          const dy = to.y - last.y;
          const length = Math.hypot(dx, dy);
          const steps = Number.isFinite(length) ? Math.min(MAX_STEPS, Math.max(1, Math.ceil(length / STEP_PX))) : 1;
          for (let i = 1; i < steps; i++) reach(last.x + (dx * i) / steps, last.y + (dy * i) / steps);
          reach(to.x, to.y);
          last = to;
        };
        travel(ctx.world);
        return {
          kind: 'sweep',
          onMove: (move) => { travel(move.world); },
          onEnd: (_end, how) => { run.end?.(how); },
        };
      },
    },
  };
}
