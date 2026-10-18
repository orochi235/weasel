import { stateOf, type Behind, type TargetState } from '../target';
import type { AnimationKind, PhysicsHandle, TargetPhysicsOptions } from '../types';
import type { AnimationContext, AnimationSeed } from './context';
import { absorb, axesFor, comeOut, commitOffset, goBehind, minus, norm, plus, takeUp, times, travel } from './offsets';
import { resolveSpringConstants } from './physicsAnimation';
import { earliestRest } from './springRest';
import { createSpringVoices, type SpringVoices, type SpringVoicesOptions } from './springVoices';

const any = (a: readonly number[]): boolean => a.some((x) => x !== 0);

/** The spring's constants, refused where blits' closed forms cannot solve them. */
function constantsFor(o: Parameters<typeof resolveSpringConstants>[0], kind: AnimationKind, toward: boolean) {
  const c = resolveSpringConstants(o);
  if (!(c.damping > 0) || !(c.mass > 0) || (toward && !(c.stiffness > 0))) {
    throw new Error(`${kind}: an animation on a target needs positive damping and mass, and stiffness to reach \`to\``);
  }
  return c;
}

type Along = readonly number[];

/** When a spring or a coast with no `onTick` can next be at rest. Until then its tick, which
 *  only asks whether it is, has nothing to do. */
function restWaits(
  ctx: AnimationContext,
  id: number,
  quiet: boolean,
  c: { stiffness: number; damping: number; mass: number },
  threshold: number,
) {
  // Nothing pulls a coast, so it is at rest once it is slow.
  const until = (value: Along, velocity: Along, coast: boolean): number =>
    earliestRest(value, velocity, coast ? 0 : c.stiffness, c.damping, c.mass, threshold);
  return {
    /** The `due` it registers with. */
    first: (value: Along, velocity: Along, coast: boolean): number | undefined =>
      (quiet ? until(value, velocity, coast) : undefined),
    /** Leaves it unticked until then. Answers false, as the tick of one still moving does. */
    again(value: Along, velocity: Along, coast: boolean): false {
      if (quiet) ctx.defer(id, until(value, velocity, coast));
      return false;
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

/**
 * A spring or a coast on a target. A spring commits its destination as it starts and its voices
 * are what is left to travel. A coast has no destination: its voice is how far it has gone, which
 * it commits when it stops.
 */
export function startOffsetPhysics<T>(
  ctx: AnimationContext,
  o: TargetPhysicsOptions<T>,
  kind: AnimationKind,
): PhysicsHandle<T> {
  const s = stateOf(o.target);
  const ax = s.axes;
  let dest = o.to == null ? null : axesFor(ax, o.to, 'to');
  const constants = constantsFor(o, kind, dest != null);
  const { stiffness } = constants;
  const given = o.from === undefined ? null : axesFor(ax, o.from, 'from');
  let velocity = o.velocity === undefined ? null : axesFor(ax, o.velocity, 'velocity');
  const restThreshold = o.restThreshold ?? 0.01;
  const zeros = (): number[] => new Array<number>(ax.count).fill(0);

  const id = ctx.nextId();
  const waits = restWaits(ctx, id, !o.onTick, constants, restThreshold);
  const interrupts = o.interrupt !== false;
  const seed = {
    id, kind, cancelKey: o.cancelKey, label: o.label, target: s, keepExisting: !interrupts,
  } as AnimationSeed;
  if (o.cancelKey != null && interrupts) {
    // Read ahead of the interrupt, which stops the voices whose velocity this is.
    velocity ??= ctx.velocityUnder(o.cancelKey, s as never);
    ctx.interrupt(o.cancelKey, seed);
  }
  const before = ax.to(s.get());
  const committed = dest ? takeUp(s) : before;
  const start = travel(ax, given ?? committed, dest ?? committed);
  /** The move the destination makes in the committed value; the rest of `start` rides on top. */
  const move = dest ? travel(ax, before, dest) : zeros();

  ctx.targets.attach(s as never);
  if (o.to != null) s.set(o.to);
  ctx.seedClock();
  const { voices, behind } = startVoices(
    ctx, s as never, { id, nextId: ctx.nextId, ...constants }, move, start, velocity ?? zeros(), dest == null,
  );

  let left = false;
  const leave = (commit: boolean): void => {
    if (left) return;
    left = true;
    const moved = voices.moved();
    const shown = comeOut(s, behind, moved);
    if (commit) commitOffset(s, voices.own().value, moved, shown);
    voices.stop();
    ctx.targets.detach(s as never);
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
  seed.due = waits.first(start, velocity ?? zeros(), dest == null);
  seed.onCancel = () => leave(true);
  seed.onRate = (_paused, _timeScale, rate) => voices.rate(rate);
  seed.velocity = () => voices.own().velocity;
  seed.tick = (nowMs, scale) => {
    if (ctx.tripwire()) { leave(true); return true; }
    const own = voices.own();
    if (scale < 0 && (nowMs <= 0 || voices.rewound())) {
      o.onTick?.(shows(own.value));
      return ctx.has(id) ? finish(true) : true;
    }
    // A coast too slow to move ends at once rather than emit a tick and wait a frame.
    if (!ticked && dest == null && norm(own.velocity) < restThreshold) return finish();
    ticked = true;
    o.onTick?.(shows(own.value));
    if (!ctx.has(id)) return true;
    if (norm(own.velocity) >= restThreshold || (dest && norm(own.value) >= restThreshold)) {
      return waits.again(own.value, own.velocity, dest == null);
    }
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
        waits.again(own.value, own.velocity, true);
        return;
      }
      const to = axesFor(ax, next, 'setTarget');
      if (!(stiffness > 0)) throw new Error(`${kind}: setTarget needs a positive stiffness`);
      // The committed value moves under the voices, which shift by as much the other way.
      const shift = travel(ax, ax.to(s.get()), to);
      s.set(next);
      if (dest == null) voices.rest(own.value, own.velocity, false);
      dest = to;
      voices.move(shift);
      waits.again(plus(own.value, shift), own.velocity, false);
      ctx.targets.showNow(s as never);
    },
    setVelocity(v) {
      if (left) return;
      const pushed = axesFor(ax, v, 'setVelocity');
      waits.again(voices.own().value, pushed, dest == null);
      voices.push(pushed);
    },
  };
}
