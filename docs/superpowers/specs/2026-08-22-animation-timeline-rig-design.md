# Animation timelines and a hierarchical rig

**What this is:** the design for arc 2 of
`2026-08-22-game-audio-animation-decomposition.md` — a keyframe timeline over the
existing animator, and a skeleton/pose layer that rides on it.

**Who it's for:** whoever implements it. Assumes familiarity with
`packages/core/src/animation/` — `useAnimator`, the tween/spring contracts, and
the internal `Supervisor` seam that `loop` and `stagger` sit on.

**What it answers:** where the timeline's clock comes from, what a track is, how a
rig avoids needing timeline integration of its own, and where the editor lives.

---

## Why this is an animator primitive, not a new clock

Every entry in the animator's table carries a `virtualNow` that the shared tick
advances by `realDt * scale`, where `scale` folds in the global pause, the global
time scale, and the entry's own pause and time scale. Composite primitives —
`loop`, `stagger` — already sit in that table through `Supervisor`, an internal
capability passed in at bind time and deliberately absent from the public
`Animator` surface.

A timeline is the same shape. **Its playhead is its entry's `virtualNow`.** That
buys `pause`, `resume`, `setTimeScale`, `pauseKey`, `cancelKey`, `isActive`, and
`cancelAll` with no new machinery and no second clock to keep in sync — and it
means a timeline can be time-scaled by the same call that slows everything else
down.

It also means the timeline **must** live in `packages/core/src/animation/`. Any
other package would need `Supervisor` exported, and it is internal on purpose.

A public frame tick falls out of this for free: an entry whose tick never
completes and whose body calls a consumer callback. That closes the gap arc 1
would otherwise have to work around.

## Timeline

`animator.timeline(opts)` returns:

```ts
interface TimelineHandle extends AnimationHandle {
  seek(t: number): void;            // ms; event tracks re-cursor without firing
  time(): number;
  duration(): number;
  tracks(): readonly Track[];
  edit(fn: () => void): void;       // mutate tracks, bump version, notify
  subscribe(cb: () => void): () => void;
}

interface TimelineOptions {
  tracks: Track[];
  duration?: number;                // default: max track end
  loop?: boolean | number;          // true = forever, n = n times
  autoplay?: boolean;               // default true
  onDone?: () => void;
  cancelKey?: string;
}
```

Per tick: sample every sampled track at the playhead, then fire every event
crossing in `(lastT, playhead]`. Finished when the playhead reaches `duration`
and no loops remain.

## Tracks

```ts
interface Keyframe<T> {
  t: number;
  value: T;
  easing?: EasingFn;   // eases INTO this key from the previous one
}

interface SampledTrack<T> {
  kind: 'sampled';
  label?: string;
  keys: Keyframe<T>[];              // sorted by t
  interpolate?: Interpolate<T>;
  interpolator?: InterpolatorFactory<T>;
  onTick: (value: T) => void;
}

interface EventTrack {
  kind: 'event';
  label?: string;
  events: { t: number; fire: () => void }[];
}

interface TimelineTrack {
  kind: 'timeline';
  label?: string;
  at: number;                       // offset into the parent, ms
  timeline: TimelineOptions;
}
```

`SampledTrack` reuses `Interpolate<T>` and `InterpolatorFactory<T>` exactly as
`tween` takes them today, default numeric lerp included. Sampling finds the
bracketing keys, normalizes to `u`, applies the *later* key's easing, and
interpolates. Before the first key it holds the first value; after the last, the
last.

`TimelineTrack` is how composition works — sequence is two child timelines at
different `at`, parallel is two at the same one. The tick needs no special case
for either.

A child takes `TimelineOptions`, not a `TimelineHandle`: children are evaluated
by the parent at `playhead - at` and are **not** separately registered in the
animator's table. One timeline tree is one entry, so pausing or time-scaling the
root governs the whole tree and there is no way for a child to drift from its
parent.

**Two kinds, not one, because scrubbing forces it.** A sampled track is a pure
function of `t`: scrub anywhere, get the right value, order irrelevant. An event
is an edge crossing and has a side effect. Collapsing them makes one of the two
incoherent.

### Seek semantics

`seek(t)` sets the playhead and advances every event track's cursor to `t`
**without firing** — recursively, so a child timeline's event tracks re-cursor
too. Looping resets cursors at the wrap. So events fire only when
the playhead advances forward under playback — dragging a scrubber is silent,
which is the only behavior under which a scrubber and a sound engine can coexist.

### Mutation

Tracks are mutable; that is what makes the editor possible. All edits go through
`timeline.edit(fn)`, which runs `fn`, bumps a version, recomputes `duration`, and
notifies subscribers.

**Trap:** `InterpolatorFactory` is built once per segment and cached. `edit` must
drop that cache, or an edited keyframe keeps interpolating toward its old value
with no visible error.

## Rig

```ts
type JointTransform = { x: number; y: number; rotation: number; scaleX: number; scaleY: number };

interface Joint { name: string; parent: string | null; bind: JointTransform }
interface Skeleton { joints: Joint[] }        // topologically ordered

type Pose = Record<string, Partial<JointTransform>>;   // local deltas from bind

blendPoses(poses: Pose[], weights: number[]): Pose
resolveSkeleton(skeleton: Skeleton, pose: Pose): Map<string, Mat3>
```

Joints carry their own TRS rather than the scene's `TPose`. `TPose` is
consumer-defined and legitimately can be a bare AABB with no rotation term, which
a joint chain cannot compose through.

**The rig needs no timeline integration of its own.** Animating one is a
`SampledTrack<Pose>` whose `interpolate` is `blendPoses(...)` with weights
`[1 - u, u]` — pose interpolation and pose blending are the same operation. Any
work spent bridging rig-to-timeline is work spent reimplementing that identity.

Binding to a scene follows the `insert` dep pattern: `useRig({ skeleton,
bindings, apply })`, where `bindings` maps joint names to node ids and `apply`
writes a joint's world `Mat3` onto whatever `TPose` the consumer uses. `apply` is
the only part that knows anything about scene shape, and it is the consumer's.

## Editor

A `<Timeline>` control in **`@weasel-js/ui`** — transport, ruler with a draggable
playhead, one lane per track, keyframes as draggable dots, per-segment easing.

It goes in `ui` rather than `labkit` because that is where its siblings already
are: `BandEditor` (a draggable-seam axis), `Slider`, `RangeSlider`, and
`CurveEditor` — the last being exactly the control the per-segment easing picker
needs. `labkit` does not depend on `ui` today, so building it there would mean
either duplicating those or adding the dep.

Every edit routes through `timeline.edit()`. The control renders from
`tracks()` — a track's `label` and its keyframe times are all a lane needs, so
the editor never learns what a track targets.

**This is where the model gets pressure-tested.** Tracks are typed callbacks, not
data, so a timeline cannot be serialized — the editor edits a live timeline, it
does not author a document. If that turns out to be the wrong trade, the editor
is where it will show up first.

## Phases

1. **Timeline core** — sampled tracks, sampling, `seek`, loop, nesting, the
   version/cache invalidation. The bulk of the tests live here.
2. **Event tracks** — crossing detection, cursors, seek suppression, loop reset.
3. **Rig** — skeleton, pose, `blendPoses`, `resolveSkeleton`, the `useRig` dep.
   Includes the `SampledTrack<Pose>` identity as a test, not just a claim.
4. **Editor** — the `<Timeline>` control in `@weasel-js/ui`.
5. **Demo** — an `apps/site/demos/` entry driving a rigged figure from a timeline
   with the editor attached.

## Explicitly out of scope

- **Inverse kinematics.** A solver that writes poses; it composes with everything
  here and needs none of it changed. Its own arc.
- **Skinning.** Per-vertex bone weights deforming path geometry. The renderer
  flattens paths to meshes, so weights have to reach the vertex shader or be
  applied on the CPU every frame. Much the largest of the three, and it needs the
  hierarchical rig to exist first.
- **Serializable clips.** Follows from typed-callback tracks. Revisit only with
  the editor's experience in hand.
