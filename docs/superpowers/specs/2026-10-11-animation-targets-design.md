# Animation targets

**Status: not built.** Design for the first of five arcs in
`docs/proposals/2026-09-30-animator-on-blits.md` ("The arcs"). Delete this when the arc merges.

For whoever implements it. It answers: how an animation names the value it moves, so that two
animations on one value combine instead of the later one winning.

## What is wrong today

`tween`, `spring`, `physics`, and `decay` hand each frame's value to the caller's `onTick`, and the
caller writes it somewhere. The animator cannot tell that two animations write the same thing, so
each is its own blits subject and nothing folds. Start a second move on a node mid-flight and the
node either jumps or, on a shared `cancelKey`, restarts from a standstill.

## The model

A **target** is one value the animator can move. Its owner says how to read and set the
**committed** value: what shows when nothing is animating.

An animation given a target is an **offset**. When it starts it commits its destination, and from
then on it contributes only what is left to travel: a tween from 0 to 100 sets the committed value
to 100 and contributes −100, shrinking to 0. What is on screen is the committed value plus every
live offset on that target. Offsets add, so a second animation started mid-flight bends the motion
toward its own destination with no kink in speed, and neither cancels the other.

```ts
const x = createTarget<number>({ get: () => box.x, set: (v) => { box.x = v; }, show: draw });
animator.tween({ target: x, to: 100, ms: 300 });
// 150 ms later, from anywhere, on any key or none:
animator.spring({ target: x, to: 40 });
```

Measured against blits 0.8.1 in a scratch script: two tween voices and a spring voice cued on one
subject of a `vec(2, sum())` channel pull as the sum of the three, and a tween patch's `read`
reports velocity as well as value.

## Public surface

In `packages/core/src/animation/target.ts`, exported from core. No blits type appears in it.

```ts
interface TargetOptions<T> {
  /** The committed value. */
  get(): T;
  /** Commits a value: an animation's destination as it starts, and where a canceled one stopped. */
  set(value: T): void;
  /** How `T` maps to numbers. Default: a number, a number array, or an object of numeric fields. */
  axes?: TargetAxes<T>;
  /** Called once a frame, after the frame's animations, with the value to show, on any frame it
   *  changed. Omit for a target whose reader calls `read()` itself. */
  show?(value: T): void;
}
interface TargetAxes<T> {
  count: number;
  to(value: T): number[];
  from(axes: ArrayLike<number>): T;
  /** Indexes of axes that are angles in radians. An offset on one is formed the short way round. */
  angles?: readonly number[];
}
interface Target<T> {
  /** The committed value plus every live offset. */
  read(): T;
  /** Whether any animation is moving it. */
  readonly active: boolean;
}
function createTarget<T>(opts: TargetOptions<T>): Target<T>;
```

Each of `TweenOptions`, `SpringOptions`, `PhysicsOptions`, and `DecayOptions` becomes a union of
today's form, unchanged, and a targeted form:

| Option | Targeted form |
|---|---|
| `target` | Required. |
| `to` | The destination, committed at the start. |
| `from` | Optional. Default `target.read()`, so the value on screen does not move at the start. Given, the value on screen jumps to it. |
| `onTick` | Optional. Receives this animation's own value, the destination plus its own offset. |
| `interpolate`, `interpolator` | As today. The offset is the caller's path minus the destination. |
| `add`, `subtract`, `scale`, `magnitude` | Not taken. The target's axes do the arithmetic. |
| everything else | As today. |

Every axis folds by addition. An offset is a difference, and differences add whatever the axis
means; scale and rotation rules that differ belong to absolute voices, which arrive with the
timeline and rig arcs.

## Behavior

- **Start.** The offset starts at `from − to`, the short way on an angle axis. Then `set(to)`.
- **End.** A tween ends at its duration with its offset at 0. A spring ends when its offset and
  velocity are both under `restThreshold`, and what is left of the offset is dropped.
- **Cancel**, by handle, by key, by `cancelAll`, or on unmount: the animation's remaining offset is
  added into the committed value, then the voice stops. The value on screen stays where it was,
  as today.
- **Same `cancelKey`.** The new animation interrupts the old, as today. When both are on one
  target and the new one is a spring or `physics` with no `velocity`, it starts at the old one's
  velocity. A tween that interrupts does not carry velocity; leave the key off to blend instead.
- **Decay.** A fling's landing point is a closed form, `from + velocity · τ`, with `τ` the friction's
  time constant. It is committed at the start like any destination.
- **`setTarget(to)`** commits the new destination and shifts the offset by the difference, keeping
  velocity. `setTarget(null)` commits the landing point of a fling from the current velocity.
- **Pause and time scale**, per animation, per key, and global, act as today.
- **Refused at the call**, not on a frame: a value the target's axes cannot map, a `to` or
  `velocity` of another shape, and spring constants blits' closed forms cannot solve. The old
  integrator serves only the untargeted form.
- **One animator per target.** Offsets live in the animator that cued them. A second animator
  cueing onto a target that another is moving throws.

## Inside

The codec already keeps one blits mix per axis count and cues a voice per animation. Two changes:

- A voice's subject is the target when there is one, and the animation's id otherwise. Several
  voices then reach one subject and blits sums them. Each frame's `pull` reads each live target
  once, and the codec writes the sum where `target.read()` finds it.
- A targeted animation reads its own offset and velocity from its patch (`read`), for `onTick`,
  for the rest check, and for the commit on cancel.

`show` runs after the frame's ticks and before `animator.onTick` subscribers, so a subscriber that
publishes sees the frame's values.

Two files are already long and each takes a new branch here, so both are split first:

- `useAnimator.ts` (692 lines): `tween` and `physics` move out to `engine/tweenAnimation.ts` and
  `engine/physicsAnimation.ts`, each taking the registry, codec, and clock it needs.
- `engine/codec.ts` (272 lines): lane bookkeeping (`join`, `depart`, `rebuild`) moves to
  `engine/lanes.ts`.

## Tests

- `engine/blitsContract.test.ts` pins what this adds to the list of blits behaviors relied on:
  voices on one subject sum, and a tween patch reads velocity.
- `engine/codec.test.ts`: targeted cue, sum, stop, and a target read once however many voices
  reach it.
- A new `useAnimator.target.test.ts` covers each bullet under "Behavior", including that the
  value on screen is continuous across start, cancel, interrupt, and `setTarget`.
- `tests/perf/bench/animator-on-blits.bench.ts` gains a row for 10k targeted tweens on 10k
  targets, reported beside the untargeted row.

## Not in this arc

Pose, color, and camera targets, absolute voices, the timeline, and the rig: each is a later arc.
Nothing in the tree is moved onto a target here, so no existing behavior changes.
