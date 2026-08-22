# `@weasel-js/audio` — engine design

**What this is:** the design for arc 3 of
`2026-08-22-game-audio-animation-decomposition.md` — a standalone Web Audio
engine: loading, voices, buses, 2D spatialization, and analysis.

**Who it's for:** whoever implements it. Assumes Web Audio familiarity —
`AudioContext`, `AudioBuffer`, the node graph — but nothing about weasel beyond
the repo's packaging conventions.

**What it answers:** why the scheduler has its own clock, what a voice is, and
which parts are pure functions you can test without a browser.

---

## The constraint everything follows from

`AudioContext.currentTime` is driven by the audio hardware. It ticks
independently of `requestAnimationFrame`, drifts against `performance.now()`,
and nothing in the kit can pause or time-scale it — not the animator's global
clock, not a timeline's playhead.

So playback is **lookahead-scheduled**, never frame-triggered. A scheduler pass
books every event due within the next window directly on the audio clock via
`source.start(when)`. Triggering a sound *on* a frame inherits frame jitter,
which is audible; scheduling it *from* a frame, for a time slightly in the
future, is not.

The scheduler runs on its own timer (~25 ms passes, 100 ms lookahead) rather
than on the animator's tick: `requestAnimationFrame` stops entirely when nothing
is animating, which would stall music and long cues. The timer is one-shot and
re-armed at the end of every pass, so a pass can never overlap itself.

**A hidden tab is not covered by this.** Browsers clamp `setTimeout` and
`setInterval` to at least 1000 ms once a tab is hidden — Chrome harder still for
timers it judges intensive — so a 100 ms lookahead books nothing on time there
and everything scheduled during it arrives late. What does survive is the clock:
`currentTime` keeps running, so the queue is still ordered correctly when the tab
comes back, and the engine drops entries that came due meanwhile rather than
firing the backlog in one pass. Driving the pass from a `MessageChannel` or a
dedicated Worker, which are not clamped the same way, is the fix — TODO, not
built.

## Package

`packages/audio`, a leaf with **no weasel dependencies**. Positional audio takes
plain `{ x, y }`; it knows nothing of `View`, `Scene`, or nodes. Model the
manifest on `packages/geom/package.json`.

Registration points for a new leaf package:

- `build:leaves` in the root `package.json`
- the `fixed` group in `.changeset/config.json` — it becomes the fourteenth
  member, and one bump there still moves all of them
- `scripts/check-publish-manifests.mjs` needs no edit; it enumerates workspaces.

## Context lifecycle

Browsers start an `AudioContext` suspended until a user gesture, and this is the
first thing that goes wrong.

```ts
createAudioEngine({ context?, lookahead = 100, tickInterval = 25, buses = ['sfx','music','ui'] })
```

The engine attaches a one-time gesture listener that resumes the context, and
exposes `state` and an explicit `unlock()` for consumers that want to drive it
themselves. **`play()` before unlock drops the voice with a dev warning** rather
than queueing it — a queue replays a backlog of stale sounds the instant someone
clicks, which is worse than silence.

`context` is injectable so tests can supply a stub or an `OfflineAudioContext`.

## Loading

```ts
engine.load(url): Promise<SoundHandle>
engine.loadAll(urls: Record<string, string>): Promise<Record<string, SoundHandle>>
engine.decode(bytes: ArrayBuffer): Promise<SoundHandle>
```

`SoundHandle` is an opaque `{ id }`, following `registerTexture`'s convention in
core. Cache by URL; a repeat `load` of the same URL returns the same handle
without refetching.

## Voices

```ts
engine.play(sound, {
  bus?, gain?, rate?, detune?, loop?, pan?, position?, when?, cancelKey?, onDone?
}): VoiceHandle

interface VoiceHandle {
  id: number;
  stop(fadeMs?: number): void;
  setGain(g: number, rampMs?: number): void;
  setRate(r: number): void;
  setPan(p: number): void;
  setPosition(p: { x: number; y: number }): void;
  isPlaying(): boolean;
}

engine.stopKey(key: string): void
engine.stopAll(): void
```

`cancelKey` mirrors the animator's, so `stopKey('footsteps')` reads the same way
`cancelKey('drag')` does.

`when` is engine-time in ms (`engine.now()`, derived from
`ctx.currentTime * 1000`). It exists from v1 specifically so the timeline bridge
can schedule accurately — see below.

**The pool is slot accounting; the nodes are per play.** `createVoicePool` owns
no audio nodes at all — it hands out numbered slots, tracks `startedAt` and gain
for the steal policy, and returns the token of whoever it evicted. The engine
builds a `GainNode` + `StereoPannerNode` chain per `play()` and disconnects it in
teardown. Holding that chain per slot instead is a real optimization and is not
implemented: TODO.

What must not be pooled is the source. `AudioBufferSourceNode` is single-use by
specification: once stopped it cannot restart, so a pooled source produces a
voice pool that silently stops making sound after its first pass through the
ring. Every play mints a fresh one.

A slot is taken when the voice actually starts, not when `play()` returns.
Otherwise a voice booked a bar ahead holds one for the whole wait, and — its
`startedAt` being in the future — is the last thing an 'oldest' policy evicts,
so booking a bar of events evicts everything currently audible.

**Voice limiting** is per-bus, with a steal policy (oldest, or quietest).
Unlimited concurrency clips into distortion and saturates the audio thread long
before it runs out of nodes.

## Buses

```ts
engine.bus(name): BusHandle
interface BusHandle {
  setGain(g: number, rampMs?: number): void;
  mute(on: boolean): void;
  solo(on: boolean): void;
  analyser(opts?): AnalyserTap;
}
```

Buses route to a master that always exists. Solo is engine-wide: soloing any bus
mutes the others until nothing is soloed.

## Spatialization

```ts
spatialize(source: Vec2, listener: Vec2, opts): { gain: number; pan: number }
engine.setListener({ x, y })
```

Distance through a rolloff curve gives gain; horizontal offset gives pan. That is
the entire spatial model — a 3D panner with HRTF would be a 3D model imposed on a
2D engine, expensive per voice, and harder to predict.

**`spatialize` is a pure function, exported and tested on its own.** It is where
all the interesting behavior lives, and keeping it free of Web Audio means the
math is testable in Node with no `AudioContext`. The wiring around it should stay
thin enough to be uninteresting.

## Analysis

```ts
interface AnalyserTap {
  frequencies(out?: Uint8Array): Uint8Array;
  waveform(out?: Uint8Array): Uint8Array;
  level(): number;                     // RMS, 0..1
  bands(n: number): Float32Array;      // n grouped bands
  dispose(): void;
}
```

A tap is an `AnalyserNode` on an existing bus or voice, so it changes nothing
about the rest of the graph.

`bands(n)` is the one that earns its place: collapsing 1024 FFT bins into eight
usable numbers is what actually drives a shader uniform, a vertex color, or a
pose, and it is a loop every consumer would otherwise write by hand.

## The timeline bridge — not v1, but it constrains v1

An `EventTrack` (see the arc 2 spec) whose `fire()` calls `engine.play()` would
schedule the sound at frame time, inheriting exactly the jitter lookahead
scheduling exists to remove.

The timeline knows the event's exact `t` and its current playhead, so the bridge
passes:

```ts
when: engine.now() + (event.t - playhead)
```

which books the sound at its true sub-frame time. This is why `when` is in
`PlayOptions` from the start, and why neither package needs to import the other:
they meet at a number.

## Phases

1. **Engine** — context lifecycle, unlock, the scheduler loop, `now()`, the
   load/decode cache.
2. **Voices** — `play`, handles, `cancelKey`, node-chain pooling, limiting and
   steal.
3. **Buses** — gain, mute, solo, routing to master.
4. **Spatialization** — pure `spatialize()` first and tested alone, then wiring.
5. **Analysis** — taps, `bands()`.
6. **Demo** — an `apps/site/demos/` entry. Audio-reactive rendering is the one to
   show: `bands()` driving something the renderer already does well.

## Explicitly out of scope

- **AudioWorklet scheduling.** More accurate than a 25 ms lookahead and immune to
  main-thread jank, at the cost of a worklet module, cross-thread messaging, and
  a bundling story. Revisit if main-thread jank proves audible.
- **Convolution reverb, filters, effect chains.** A per-bus insert-effect slot is
  the natural shape when it happens; nothing here forecloses it.
- **Streaming / `MediaElementAudioSourceNode`.** Everything here decodes fully
  into an `AudioBuffer`, which is wrong for long music tracks and right for
  everything else.
