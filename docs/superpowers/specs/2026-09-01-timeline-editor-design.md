# Timeline editor design

**What this is:** the design for `<Timeline>`, a keyframe editor for the timeline primitive, plus
the two changes to `core` it depends on. The editor phase of the timeline/rig arc
(`2026-08-22-animation-timeline-rig-design.md`); inverse kinematics, skinning and serializable
clips remain open under that arc and are untouched by this one.

**Who it's for:** whoever implements it. Assumes `packages/core/src/animation/timeline/`, the
`@weasel-js/ui` component conventions, and the `onInput`/`onChange` gesture split; assumes no
memory of the conversation that produced this.

**What it answers:** how an editor binds to a running timeline, what it can edit for a track whose
value type it does not know, and what has to exist in the engine before any of it can be built.

## Two arcs

Arc A is core. Arc B is the component, and cannot start before A: a per-segment easing UI has
nothing to display while `Keyframe.easing` is a bare function, and a transport has no loop toggle
while `TimelineHandle` has no setter for one.

---

## Arc A — core

### Easing becomes a describable value

```ts
export type EasingSpec =
  | EasingFn
  | EasingName                                    // keyof typeof EASINGS
  | { bezier: [number, number, number, number] }  // CSS cubic-bezier control points

export function resolveEasing(spec?: EasingSpec): EasingFn
```

`undefined` resolves to `linear`, a name to `EASINGS[name]`, and a bezier to a memoized
Newton-Raphson solver — solve `t` from `x`, evaluate `y`. The union is additive, so every existing
`EasingFn` value stays assignable and nothing in or out of the tree breaks.

Widen every `easing?:` field in `animation/types.ts` — `Keyframe`, `TweenOptions`,
`TweenLoopOptions`, `StaggerTweenOptions` — and `ViewAnimationOptions` in
`core/viewport/useViewAnimation.ts`. Only `Keyframe` is read back by an editor, but a spec that
works on a keyframe and fails on `animator.tween` is two rules where one will do.

Easing is *invoked* in four places kit-wide: `animation/timeline/sampleTrack.ts:46`,
`animation/useAnimator.ts:301`, and `animation/colorHelpers.ts:183` and `:259`. Each becomes a
`resolveEasing` call. `useViewAnimation.ts:92` only forwards.

A shadow `easingKey` field beside the function — mirroring `kit:add`'s `derivePathKey`, which is
the in-tree precedent someone will reach for — was rejected. Two fields carrying one meaning can
disagree, and the editor then shows the wrong curve name against the right motion with nothing to
catch it. It also has no spelling for a bezier the editor itself authored.

### `TimelineHandle.setLoop`

```ts
setLoop(loop: boolean | number): void
```

Writes `loopsLeft` (`true → Infinity`, `false → 0`, `n → n`) and does nothing else.

**A timeline parked at `duration` does not restart.** `setLoop` sets policy; the transport's play
button starts playback. Enabling the loop on a finished timeline is therefore visibly inert until
something restarts it, which is correct rather than broken: the alternative gives `setLoop` a hidden
playback side effect that fires from one particular playhead position, and a consumer restoring
saved transport state — loop first, then seek — gets a surprise start.

Restarting one takes a rewind, not just a `resume`. `rearm` (`createTimeline.ts:168`) returns early
on `playhead >= duration`, so `resume()` on a finished timeline revives nothing and reports no
error. The transport's play button seeks to 0 first when the playhead is at the end — which is what
play-at-end should do anyway. `setLoop` itself stays free of this.

This retires the `loop cannot be changed after a timeline is created` entry in `docs/TODO.md`,
whose stated blocker was exactly this decision.

---

## Arc B — `@weasel-js/ui`

### Two exports

`<Timeline>` is controlled and pure: it takes tracks, a duration and a playhead, emits changes, and
knows nothing about the animator. `<AnimatedTimeline handle={h}>` binds it to a live
`TimelineHandle`. Same split as `GradientEditor` / `SceneGradientHandles`.

The pure half is what makes the component testable and storybook-able without standing up an
animator, and it means the mutable-primitive-to-immutable-React bridge is written once here rather
than in every consumer.

### Module layout

```
packages/ui/src/components/Timeline/
  Timeline.tsx           pure controlled component
  AnimatedTimeline.tsx   TimelineHandle-bound wrapper
  Transport.tsx          play/pause/loop/rate/time readout
  Lane.tsx               one track row, both modes
  Ruler.tsx              ticks, playhead, scrub
  timeScale.ts    (+test) px <-> ms across a zoom/pan window
  lanes.ts        (+test) Track[] -> lane rows, nested flattening
  keys.ts         (+test) move / insert / delete / snap
  easingSpec.ts   (+test) spec <-> picker label, bezier sampling for the curve
  EasingPicker.tsx       the per-segment easing control
  Timeline.module.css - Timeline.stories.tsx - index.ts
```

The four `.ts` modules hold the geometry and the edit algebra, each tested on its own. This follows
`CurveEditor`, the closest complexity peer in the package.

### API

```ts
interface TimelineProps {
  tracks: readonly Track[];
  duration: number;
  playhead: number;

  mode?: 'dope' | 'graph';                       // default 'dope'
  onModeChange?: (mode: 'dope' | 'graph') => void;

  onInput?: (next: Track[]) => void;             // live during a drag
  onChange: (next: Track[]) => void;             // one call per gesture
  onScrub: (t: number) => void;

  transport?: TransportProps | false;            // false hides it
  selection?: KeySelection | null;
  onSelect?: (sel: KeySelection | null) => void;
  renderKeyEditor?: (ctx: KeyEditorCtx) => ReactNode;

  window?: { from: number; to: number };         // uncontrolled if omitted
  onWindowChange?: (w: { from: number; to: number }) => void;

  label?: ReactNode;
  className?: string;
}
```

The three named payload types:

```ts
interface KeySelection { trackIndex: number; keyIndex: number }

interface KeyEditorCtx<T = unknown> {
  key: Keyframe<T>;
  track: SampledTrack<T>;
  selection: KeySelection;
  /** Replace the selected key. Routed through the component's own onChange. */
  commit: (next: Keyframe<T>) => void;
  /** Set the easing shaping the approach into this key. */
  setEasing: (easing: EasingSpec | undefined) => void;
}

interface TransportProps {
  paused: boolean;
  loop: boolean | number;
  rate: number;
  onPlay(): void; onPause(): void;
  onLoopChange(loop: boolean | number): void;
  onRateChange(rate: number): void;
}
```

A selection is a single key. Multi-select is a later change to this field's type, not to anything
around it.

`onInput` / `onChange` is `BandEditor`'s split: live preview during the gesture, one committed call
at its end. A track is shallow-cloned on edit, so `onTick`, `fire` and `interpolate` survive as
references; only the `keys` / `events` array and the touched entries are new.

### The two modes

**Dope sheet** (default) edits time and easing for every track kind. Sampled tracks show keyframe
diamonds, event tracks show crossing markers, nested timelines show an expandable bar.

**Graph** adds a value axis, and only for `SampledTrack<number>`. A non-numeric sampled track stays
a dope row in graph mode — a `Pose` has no honest vertical position — as do event and nested
tracks.

`renderKeyEditor` is how a non-numeric value gets edited at all: the selected key goes out to the
consumer, which supplies a control that knows its own `T`. The editor never guesses.

### The wrapper

`createTimeline.ts:198` is `tracks: () => opts.tracks` — the **live** array, not a copy. Mutating
it in place inside `edit()` is what propagates; building a replacement array and assigning it
silently no-ops.

```tsx
export function AnimatedTimeline({ handle, ...rest }: { handle: TimelineHandle }) {
  return <Timeline
    tracks={handle.tracks()}
    duration={handle.duration()}
    playhead={handle.time()}
    onScrub={handle.seek}
    onChange={(next) => handle.edit(() => {
      const live = handle.tracks() as Track[];
      live.splice(0, live.length, ...next);
    })}
    {...rest} />;
}
```

Re-render is driven by `useSyncExternalStore` over `handle.subscribe`. `subscribe` fires on `edit`
only, so the playhead needs the animator's frame instead — the wrapper reads `handle.time()` under
`useVisibleRaf` while the timeline is unpaused.

A segment is named by the key it runs *into*, because that is the key whose `easing` shapes it —
`sampleTrack.ts:45`'s convention. So a segment selection is a `KeySelection` and needs no type of
its own.

### Interaction

| Gesture | Effect |
|---|---|
| drag the ruler or playhead | scrub |
| drag a key | move in time; in graph mode, also in value |
| double-click a lane | insert a key at that time |
| `Delete` on a selected key | remove it |
| click a segment | select it; easing picker in the inspector strip |
| `Enter` / `Space` on a focused segment | the same |
| drag a bezier handle (graph mode) | write `{ bezier: [...] }` onto the key |
| wheel or pinch on the ruler | zoom the time window; drag to pan |
| `alt` during a key drag | defeat snapping |

### Testing

Arc A runs under `npx vitest run --project=kit`: name and bezier resolution against sampled
endpoints and monotonicity, and `setLoop` asserted at `duration`, mid-play, and across a wrap.
Arc B runs under `npx vitest run --project=weasel-ui`.

The four geometry modules carry the real assertions — they are pure, and jsdom cannot weaken them.

**`setPointerCapture` is the trap this component walks into.** It exists in jsdom, records the call
and has no other consequence, so a drag test can pass against an implementation that never moved
anything. Drag assertions go against a proxy on this side of the boundary, and each such test says
in so many words that it is a proxy.

The multi-lane scrolling container is new, so it gets screenshotted rather than trusted: a `flex: 1`
that resolves to nothing renders an empty panel with a fully green suite.
