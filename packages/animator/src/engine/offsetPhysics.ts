import { stateOf, type Behind, type TargetState } from '../target';
import type { AnimationKind, PhysicsHandle, TargetPhysicsOptions } from '../types';
import type { AnimationContext, AnimationSeed } from './context';
import { absorb, axesFor, comeOut, commitOffset, commitOver, leaveTarget, goBehind, minus, plus, setBeside, takeUp, times, travel } from './offsets';
import { resolveSpringConstants } from './physicsAnimation';
import { createSpringVoices, type SpringVoices, type SpringVoicesOptions } from './springVoices';

const any = (a: readonly number[]): boolean => a.some((x) => x !== 0);

/** The spring's constants, refused where blits' closed forms cannot solve them. */
export function constantsFor(o: Parameters<typeof resolveSpringConstants>[0], kind: AnimationKind, toward: boolean) {
  const c = resolveSpringConstants(o);
  if (!(c.damping > 0) || !(c.mass > 0) || (toward && !(c.stiffness > 0))) {
    throw new Error(`${kind}: an animation on a target needs positive damping and mass, and stiffness to reach \`to\``);
  }
  return c;
}

type Along = readonly number[];

/** When a spring or a coast can next have landed, from blits. Until then its tick reads no voice:
 *  one with no `onTick` is not ticked, and one with is only shows its value. */
function restWaits(
  ctx: AnimationContext, id: number, quiet: boolean, voices: () => SpringVoices, land: () => void,
) {
  /** On its own clock, the soonest it can have landed; 0 asks the next tick to read it. */
  let from = 0;
  return {
    /** Whether a tick at `nowMs` can tell nothing yet. Played backward, every tick reads. */
    early: (nowMs: number, scale: number): boolean => scale >= 0 && nowMs < from,
    /** Waits until it can have landed. Answers false, as the tick of one still moving does. */
    again(nowMs: number, scale: number): false {
      const left = voices().landsIn();
      if (quiet) ctx.defer(id, left);
      else from = scale > 0 ? nowMs + left : 0;
      return false;
    },
    /** A write has moved it. One with no `onTick` waits on once a frame has read the move, unticked
     *  meanwhile, and lands then if that frame landed it. */
    moved(): void {
      from = 0;
      if (!quiet) return;
      ctx.afterFrame(() => {
        if (!ctx.has(id)) return;
        if (voices().landed()) land();
        else ctx.defer(id, voices().landsIn());
      });
    },
  };
}

/** The voices a spring or a coast starts with: `move` behind the target's holds, all of its
 *  voice the move, and the rest of `start`, with `velocity`, on top. */
function startVoices(
  ctx: AnimationContext, s: TargetState, o: Omit<SpringVoicesOptions, 'behind'>,
  move: Along, start: Along, velocity: Along, coast: boolean,
): { voices: SpringVoices; behind: Behind } {
  const behind = goBehind(s, () => voices.moved(), () => voices.moved(), new Array<number>(move.length).fill(1));
  const voices = createSpringVoices(ctx.codec, s, { ...o, behind });
  if (any(move)) voices.move(move);
  const top = minus(start, move);
  if (!any(move) || any(top) || any(velocity)) voices.rest(top, velocity, coast);
  return { voices, behind };
}

/** A call whose interrupt ran already, by `id`, and the velocity it read ahead of it. */
export interface Interrupted {
  id: number;
  velocity: number[] | null;
}

/**
 * A spring or a coast on a target. A spring commits its destination as it starts and its voices
 * are what is left to travel. A coast has no destination: its voice is how far it has gone, which
 * it commits when it stops.
 */
export function startOffsetPhysics<T>(
  ctx: AnimationContext,
  o: TargetPhysicsOptions<T>,
  kind: AnimationKind, interrupted?: Interrupted,
): PhysicsHandle<T> {
  const s = stateOf(o.target);
  const ax = s.axes;
  let dest = o.to == null ? null : axesFor(ax, o.to, 'to');
  const constants = constantsFor(o, kind, dest != null);
  const given = o.from === undefined ? null : axesFor(ax, o.from, 'from');
  let velocity = o.velocity === undefined ? interrupted?.velocity ?? null : axesFor(ax, o.velocity, 'velocity');
  const restThreshold = o.restThreshold ?? 0.01;
  const zeros = (): number[] => new Array<number>(ax.count).fill(0);

  const id = interrupted?.id ?? ctx.nextId();
  const waits = restWaits(ctx, id, !o.onTick, () => voices, () => {
    finish();
    ctx.finish(id);
  });
  const interrupts = o.interrupt !== false;
  const seed = {
    id, kind, cancelKey: o.cancelKey, label: o.label, target: s, keepExisting: !interrupts,
  } as AnimationSeed;
  ctx.targets.check(s as never);
  if (!interrupted && o.cancelKey != null && interrupts) {
    // Read ahead of the interrupt, which stops the voices whose velocity this is.
    velocity ??= ctx.velocityUnder(o.cancelKey, s as never);
    ctx.interrupt(o.cancelKey, seed);
  }
  s.handoff?.release();
  const before = ax.to(s.get());
  const committed = takeUp(s);
  const start = travel(ax, given ?? committed, dest ?? committed);
  /** The move the destination makes in the committed value; the rest of `start` rides on top. */
  const move = dest ? travel(ax, before, dest) : zeros();

  ctx.targets.attach(s as never);
  if (o.to != null) commitOver(ctx, s as never, o.to);
  ctx.seedClock();
  const { voices, behind } = startVoices(
    ctx, s as never, { id, nextId: ctx.nextId, ...constants, threshold: restThreshold }, move, start, velocity ?? zeros(), dest == null,
  );

  let left = false;
  const leave = (commit: boolean): void => {
    if (left) return;
    left = true;
    const moved = voices.moved();
    const shown = comeOut(s, behind, moved);
    leaveTarget(ctx, s as never, commit ? () => commitOffset(s, voices.own().value, moved, shown) : null, () => voices.stop());
  };
  /** A coast commits where it stopped, and so does one played back to its start; a spring
   *  drops what is left under the threshold. */
  const finish = (commit = dest == null): true => {
    leave(commit);
    ctx.reportEnd(id);
    o.onDone?.();
    return true;
  };
  /** What it shows, for `onTick`. */
  const shows = (own: readonly number[]): T => ax.from(plus(dest ?? ax.to(s.get()), own));

  let ticked = false;
  if (!o.onTick) seed.due = 0;
  seed.onCancel = () => leave(true);
  seed.onRate = (_paused, _timeScale, rate) => voices.rate(rate);
  seed.velocity = () => voices.own().velocity;
  seed.tick = (nowMs, scale) => {
    if (ctx.tripwire()) { leave(true); return true; }
    if (scale < 0 && (nowMs <= 0 || voices.rewound())) {
      o.onTick?.(shows(voices.own().value));
      return ctx.has(id) ? finish(true) : true;
    }
    // A coast too slow to move ends at once rather than emit a tick and wait a frame.
    if (!ticked && dest == null && voices.landed()) return finish();
    ticked = true;
    if (o.onTick) o.onTick(shows(voices.own().value));
    if (!ctx.has(id)) return true;
    if (waits.early(nowMs, scale)) return false;
    if (!voices.landed()) return waits.again(nowMs, scale);
    if (dest) o.onTick?.(ax.from(dest));
    return ctx.has(id) ? finish() : true;
  };
  const base = ctx.register(seed);

  return {
    ...base,
    setTarget(next) {
      if (left) return;
      const own = voices.own();
      if (next == null) {
        if (dest == null) return;
        // The committed value stops where the spring had brought it; the coast carries the rest.
        const moved = voices.moved();
        absorb(s, behind.kept ? times(moved, behind.kept) : moved);
        dest = null;
        voices.rest(minus(own.value, moved), own.velocity, true);
        voices.settleMove();
        waits.moved();
        return;
      }
      const to = axesFor(ax, next, 'setTarget');
      if (!(constants.stiffness > 0)) throw new Error(`${kind}: setTarget needs a positive stiffness`);
      // The committed value, with what waited beside it, moves under the voices, which shift back.
      const shift = travel(ax, takeUp(s), to);
      s.set(next);
      if (s.beside) setBeside(s as never, null);
      if (dest == null) voices.rest(own.value, own.velocity, false);
      dest = to;
      voices.move(shift);
      waits.moved();
      ctx.targets.showNow(s as never);
    },
    setVelocity(v) {
      if (left) return;
      voices.push(axesFor(ax, v, 'setVelocity'));
      waits.moved();
    },
  };
}
