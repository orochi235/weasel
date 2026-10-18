import type { Behind, TargetState } from '../target';
import type { Codec, Own } from './codec';
import { bump, bumpOn, minus, plus, runsOn, seat } from './offsets';

/** What {@link createSpringVoices} takes. */
export interface SpringVoicesOptions {
  /** The animation's id, which its first voice takes. */
  id: number;
  nextId(): number;
  stiffness: number;
  damping: number;
  mass: number;
  /** Where the move's voice runs, behind the target's holds. */
  behind: Behind;
}

/**
 * A spring on a target as up to two voices that sum to it. One is the move its destinations
 * made in the committed value, which a hold covers; the other is the rest, which shows on top
 * of a hold: a `from` away from the committed value, a push, a coast. A spring is linear, so
 * the two run apart and add up to the one spring.
 */
export interface SpringVoices {
  /** Both voices summed: the animation's whole offset, and its velocity. */
  own(): Own;
  /** What is left of the move. */
  moved(): number[];
  /** Adds `delta` to the move: a destination has moved the committed value by that much. */
  move(delta: readonly number[]): void;
  /** Stops the move's voice, where the committed value has taken what was left of it. */
  settleMove(): void;
  /** Starts the rest over at `from` and `velocity`, toward nothing left or, for a coast, free. */
  rest(from: readonly number[], velocity: readonly number[], coast: boolean): void;
  /** Sets the animation's velocity, by way of the rest. */
  push(velocity: readonly number[]): void;
  rate(rate: number): void;
  /** Whether every voice, played backward, has got back to where it was last cued. */
  rewound(): boolean;
  stop(): void;
}

export function createSpringVoices(codec: Codec, s: TargetState, o: SpringVoicesOptions): SpringVoices {
  const n = s.axes.count;
  const zeros = (): number[] => new Array<number>(n).fill(0);
  const moving = { id: -1 };
  const resting = { id: -1 };
  let first = true;
  let rate = 1;
  let coasting = false;

  const of = (v: { id: number }): Own =>
    (v.id >= 0 ? codec.own(v.id) : undefined) ?? { value: zeros(), velocity: zeros() };

  /** Counts `delta` into what `v` shows until the next frame reads it. */
  const adjust = (v: { id: number }, delta: readonly number[], sign: 1 | -1): void => {
    if (v === moving) bumpOn(s, o.behind, delta, sign);
    else bump(s, delta, sign);
  };
  const cue = (v: { id: number }, from: readonly number[], velocity: readonly number[], to: number[] | null): void => {
    if (v.id >= 0) {
      const was = codec.own(v.id)!.value;
      codec.recue(v.id, from.slice(), velocity.slice(), to);
      adjust(v, minus(from, was), 1);
      return;
    }
    v.id = first ? o.id : o.nextId();
    first = false;
    const on = v === moving ? runsOn(s, o.behind) : s;
    seat(s, on, codec.spring({
      id: v.id, on, axes: n, from: from.slice(), to, velocity: velocity.slice(),
      stiffness: o.stiffness, damping: o.damping, mass: o.mass,
    }));
    if (rate !== 1) codec.rate(v.id, rate);
    adjust(v, from, 1);
  };

  const drop = (v: { id: number }): void => {
    if (v.id < 0) return;
    const own = codec.own(v.id);
    if (own) adjust(v, own.value, -1);
    codec.stop(v.id);
    v.id = -1;
  };

  return {
    own() {
      const a = of(moving);
      const b = of(resting);
      return { value: plus(a.value, b.value), velocity: plus(a.velocity, b.velocity) };
    },
    moved: () => of(moving).value,
    move(delta) {
      const m = of(moving);
      cue(moving, plus(m.value, delta), m.velocity, zeros());
    },
    settleMove: () => drop(moving),
    rest(from, velocity, coast) {
      coasting = coast;
      cue(resting, from, velocity, coast ? null : zeros());
    },
    push(velocity) {
      const v = minus(velocity, of(moving).velocity);
      if (resting.id < 0) cue(resting, zeros(), v, coasting ? null : zeros());
      else codec.push(resting.id, v);
    },
    rate(r) {
      rate = r;
      for (const v of [moving, resting]) if (v.id >= 0 && codec.has(v.id)) codec.rate(v.id, r);
    },
    rewound: () => (moving.id >= 0 || resting.id >= 0)
      && [moving, resting].every((v) => v.id < 0 || codec.rewound(v.id)),
    stop() {
      drop(moving);
      drop(resting);
    },
  };
}
