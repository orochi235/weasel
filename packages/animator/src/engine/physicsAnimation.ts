import { SPRING_PRESETS } from '@weasel-js/geom';
import type { AnimationKind, PhysicsHandle, PhysicsOptions } from '../types';
import { axesOf, type Axes } from './axes';
import type { AnimationContext } from './context';

export function resolveSpringConstants(o: { preset?: string; stiffness?: number; damping?: number; mass?: number }) {
  const preset = o.preset ? SPRING_PRESETS[o.preset as keyof typeof SPRING_PRESETS] : null;
  return {
    stiffness: o.stiffness ?? preset?.stiffness ?? 170,
    damping: o.damping ?? preset?.damping ?? 26,
    mass: o.mass ?? preset?.mass ?? 1,
  };
}

/** The length of `v`, or of `v` less `from`, across its axes. */
function lengthOf(v: readonly number[], from?: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    const d = from ? v[i]! - from[i]! : v[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** `from`'s axes, refused for a value blits can't move as numbers. */
function requireAxes<T>(from: T, kind: AnimationKind): Axes<T> {
  const axes = axesOf(from);
  if (!axes) {
    throw new Error(`${kind}: \`from\` is not a number, an array of numbers, or a plain object of numeric fields, which are the values it moves`);
  }
  return axes;
}

/** A spring or a coast that hands each frame's value to the caller's `onTick`. */
export function startPhysics<T>(
  ctx: AnimationContext,
  o: PhysicsOptions<T>,
  kind: AnimationKind,
): PhysicsHandle<T> {
  const { codec } = ctx;
  const { stiffness, damping, mass } = resolveSpringConstants(o);
  // Past these, no step of the motion is a number for long: it never rests, and ticks NaN.
  if (!(mass > 0 && damping >= 0 && stiffness >= 0) || !Number.isFinite(mass + damping + stiffness)) {
    throw new Error(`${kind}: mass is positive, and damping and stiffness 0 or more, each finite`);
  }
  const axes = requireAxes(o.from, kind);
  const checkShape = (v: T, what: string): number[] => {
    if (axesOf(v)?.shape !== axes.shape) throw new Error(`${kind}: ${what} is not the same shape as \`from\``);
    return axes.to(v);
  };
  const restThreshold = o.restThreshold ?? 0.01;
  let target: { value: T; axes: number[] } | null = o.to == null ? null : { value: o.to, axes: checkShape(o.to, '`to`') };
  let velocity = o.velocity == null ? new Array<number>(axes.count).fill(0) : checkShape(o.velocity, '`velocity`');
  let started = false;

  const id = ctx.nextId();
  ctx.seedClock();
  // Started ahead of `register`, whose `start` listeners may already cancel it.
  const reader = codec.spring({
    id, axes: axes.count, from: axes.to(o.from), to: target && target.axes, velocity: velocity.slice(),
    stiffness, damping, mass,
  });

  /** Ends it. As for a tween: canceled from its own onTick, it never completes. */
  const end = (): true => {
    codec.stop(id);
    if (ctx.has(id)) {
      ctx.reportEnd(id);
      o.onDone?.();
    }
    return true;
  };
  const baseHandle = ctx.register({
    id,
    kind,
    cancelKey: o.cancelKey,
    label: o.label,
    tick(nowMs, rate) {
      if (ctx.tripwire()) { codec.stop(id); return true; }
      // Played backward, it ends where it started, as a tween does.
      if (rate < 0 && (nowMs <= 0 || codec.rewound(id))) {
        o.onTick(axes.from(reader.motion().value));
        return end();
      }
      // A coast that starts below the threshold ends on its first frame rather than ticking once.
      if (!started) {
        started = true;
        if (target == null && lengthOf(velocity) < restThreshold) return end();
      }
      const m = reader.motion();
      velocity = m.velocity;
      o.onTick(axes.from(m.value));
      if (!(lengthOf(m.velocity) < restThreshold)) return false;
      if (target == null) return end();
      if (!(lengthOf(m.value, target.axes) < restThreshold)) return false;
      o.onTick(target.value);
      return end();
    },
  });

  return {
    ...baseHandle,
    setTarget: (newTo: T | null) => {
      target = newTo == null ? null : { value: newTo, axes: checkShape(newTo, 'setTarget') };
      if (codec.has(id)) codec.retarget(id, target && target.axes);
    },
    setVelocity: (v: T) => {
      velocity = checkShape(v, 'setVelocity');
      if (codec.has(id)) codec.push(id, velocity);
    },
  };
}
