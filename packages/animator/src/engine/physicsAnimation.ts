import { SPRING_PRESETS } from '@weasel-js/geom';
import type { AnimationKind, PhysicsHandle, PhysicsOptions } from '../types';
import { axesOf } from './axes';
import type { SpringReader } from './codec';
import type { AnimationContext } from './context';
import { stepSpring } from './integrator';

export function resolveSpringConstants(o: { preset?: string; stiffness?: number; damping?: number; mass?: number }) {
  const preset = o.preset ? SPRING_PRESETS[o.preset as keyof typeof SPRING_PRESETS] : null;
  return {
    stiffness: o.stiffness ?? preset?.stiffness ?? 170,
    damping: o.damping ?? preset?.damping ?? 26,
    mass: o.mass ?? preset?.mass ?? 1,
  };
}

/** A spring or a coast that hands each frame's value to the caller's `onTick`. */
export function startPhysics<T>(
  ctx: AnimationContext,
  o: PhysicsOptions<T>,
  kind: AnimationKind,
): PhysicsHandle<T> {
  const { codec } = ctx;
  const id = ctx.nextId();
  const isNumeric = typeof o.from === 'number';
  if (!isNumeric && (!o.add || !o.subtract || !o.scale || !o.magnitude)) {
    throw new Error('physics: add/subtract/scale/magnitude are required for non-numeric T');
  }
  const add = o.add ?? ((a: T, b: T) => ((a as unknown as number) + (b as unknown as number)) as unknown as T);
  const subtract = o.subtract ?? ((a: T, b: T) => ((a as unknown as number) - (b as unknown as number)) as unknown as T);
  const scale = o.scale ?? ((v: T, k: number) => ((v as unknown as number) * k) as unknown as T);
  const magnitude = o.magnitude ?? ((v: T) => Math.abs(v as unknown as number));
  const { stiffness: kBase, damping, mass } = resolveSpringConstants(o);
  const restThreshold = o.restThreshold ?? 0.01;

  let target: T | null = o.to ?? null;
  let value = o.from;
  // Default to zero velocity: assumes scale(_, 0) returns the zero vector of T. Pass an explicit velocity for unusual T where this isn't true.
  let velocity: T = o.velocity ?? scale(o.from, 0);
  let lastTime: number | null = null;

  // blits' closed forms need positive damping and mass, and a spring with a target needs
  // stiffness; decay's handle never takes a target.
  const solvable = damping > 0 && mass > 0 && (kBase > 0 || kind === 'decay');
  const fromAxes = solvable ? axesOf(o.from) : null;
  const sameShape = (v: T | null | undefined): boolean => v == null || axesOf(v)?.shape === fromAxes!.shape;
  const axes = fromAxes && sameShape(o.to) && sameShape(o.velocity) ? fromAxes : null;
  let reader: SpringReader | null = null;
  if (axes) {
    ctx.seedClock();
    // Started ahead of `register`, whose `start` listeners may already cancel it.
    reader = codec.spring({
      id, axes: axes.count,
      from: axes.to(o.from),
      to: o.to == null ? null : axes.to(o.to),
      velocity: o.velocity == null ? new Array<number>(axes.count).fill(0) : axes.to(o.velocity),
      stiffness: kBase, damping, mass,
    });
  }

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
      if (rate < 0 && (nowMs <= 0 || (axes && codec.rewound(id)))) {
        o.onTick(axes ? axes.from(reader!.motion().value) : o.from);
        return end();
      }
      if (lastTime == null) {
        lastTime = nowMs;
        // Already-at-rest short-circuit: decay-mode (target == null)
        // with starting velocity below threshold should complete
        // immediately rather than emit a tick and wait a frame.
        if (target == null && magnitude(velocity) < restThreshold) return end();
        // The codec's voice has run since registration, so only Euler starts its clock here.
        if (!axes) {
          o.onTick(value);
          return false;
        }
      }
      if (axes) {
        const m = reader!.motion();
        value = axes.from(m.value);
        velocity = axes.from(m.velocity);
      } else {
        // Semi-implicit Euler, for a T blits cannot move as axes, or constants its closed forms can't solve.
        const dt = Math.max(-0.064, Math.min(0.064, (nowMs - lastTime) / 1000));
        const next = stepSpring({ add, subtract, scale }, value, velocity, target, kBase, damping, mass, dt);
        value = next.value;
        velocity = next.velocity;
      }
      lastTime = nowMs;
      o.onTick(value);
      const velRested = magnitude(velocity) < restThreshold;
      const posRested = target == null
        ? true
        : magnitude(subtract(value, target)) < restThreshold;
      if (!velRested || !posRested) return false;
      if (target != null) o.onTick(target);
      return end();
    },
  });

  const checkShape = (v: T, what: string): void => {
    if (!sameShape(v)) throw new Error(`physics: ${what} is not the same shape as \`from\``);
  };
  return {
    ...baseHandle,
    setTarget: (newTo: T | null) => {
      if (axes && newTo != null) checkShape(newTo, 'setTarget');
      target = newTo;
      if (axes && codec.has(id)) codec.retarget(id, newTo == null ? null : axes.to(newTo));
    },
    setVelocity: (v: T) => {
      if (axes) checkShape(v, 'setVelocity');
      velocity = v;
      if (axes && codec.has(id)) codec.push(id, axes.to(v));
    },
  };
}
