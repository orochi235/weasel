# Side-scroller demo

**What this is:** the design for arc 1 of
`2026-08-22-game-audio-animation-decomposition.md` — a platformer in
`apps/site/demos/` whose job is to put continuous load on the animation timeline
and the audio engine that landed alongside it.

**Who it's for:** whoever implements it. It assumes the kit, not the game.

**What it answers:** how the demo is built, which kit surfaces it drives, and
what it is expected to break.

A platformer in `apps/site/demos/` is a deliberate exception to the terse,
single-purpose demo convention in `CLAUDE.md` — an exception, not a precedent.

---

## Load test, not showcase

The demo is a measuring instrument. A platformer changes animation state every
few frames, fires dozens of overlapping one-shots, and never lets the clock
idle — so it finds where the timeline and the audio engine are thin, wrongly
factored, or too slow, which no editor interaction does.

That makes instrumentation part of the deliverable, not a nicety. A debug panel
carries frame time, active voice count, active animation count, a collision-box
overlay, and a button that spawns an enemy swarm. Without it this is a game.

---

## Architecture

Everything is drawn by custom `RenderLayer`s with the scene graph suppressed
(`scene: { drawOne: () => [] }`), the shape `ParallaxDemo` and `RigDemo` already
use. Entity state lives in refs; layers read `ref.current` inside `draw`.

The rejected alternative is worth one sentence because it looks attractive:
putting rig joints in a `useScene` tree and writing `setPose` ops per frame would
exercise the container hierarchy and force the missing rig↔scene binding dep into
the open, but ops at 60 Hz fight history coalescing and React reconciliation.
Record that as a finding rather than spending the demo on it.

### Frame loop

`animator.keepAlive()` holds the rAF loop open; `animator.onTick` drives
everything. `onTick` carries no delta, so the demo takes its own
`performance.now()` difference and runs an accumulator at a fixed 1/120 s step,
rendering interpolated between steps. Physics, collision, and the tile map are
demo-local and do not migrate to the kit.

### World

A companion `platformerLevel.ts` holds the level as string rows over a tile
grid: solid, one-way platform, spike, coin, spawn, goal. `autoExtras()` in
`registry.ts` picks companion modules up as source tabs with no manual wiring.

Three `createParallaxLayer` backgrounds sit behind it, tiled horizontally so the
pan loops seamlessly.

### Camera

The outer `View` follows the player through a dead zone with smoothing, clamped
to level bounds. Parallax layers derive from it, so the camera is the only thing
that moves.

### Player

An eleven-joint skeleton — hip → torso → head, two arms, two legs. Clips are
`SampledTrack<Pose>` whose `interpolate` is built on `blendPoses`.

The three clips are driven three different ways on purpose, so each timeline
entry point takes load:

- **run** — a real `animator.timeline({ loop: true })` whose `setTimeScale`
  tracks ground speed.
- **jump / fall** — one timeline `seek()`ed by vertical velocity rather than
  played.
- **idle, land, hurt** — one-shot timelines.

The state machine cross-fades the two active clips by sampling both and blending
the results, so a pose blend runs every frame and the clip set changes every few
frames.

### Audio

Buses `music`, `sfx`, `ui`. Every sound is synthesized into an `AudioBuffer` at
load and handed to `engine.register()` — no binary assets, following
`AudioDemo`. Enemy sounds are spatialized against the player as listener. Hurt
ducks the music bus (`bus('music').setGain(0.3, 120)`) and restores it. The
swarm button exists to make voice stealing visible in `activeVoices()`.

### Game

Patrolling stompable enemies, all reading one shared looping timeline at
per-enemy phase offsets. Spinning coins, spikes, hearts, a goal with an outro
timeline, respawn on death.

---

## The bridge

Footsteps are an `EventTrack` on the looping run timeline: two events per cycle,
continuously, at a time scale that changes with speed. This is the
timeline→audio bridge under the heaviest load it will ever see, and it is the
main reason the demo exists.

It is expected to fail in a specific way. `EventTrack`'s events are
`{ t, fire: () => void }` — `fire` receives nothing, so the callback cannot know
the crossing time and can only schedule against `engine.now()` at rAF
resolution. The audio engine's whole scheduling design is lookahead against
`AudioContext.currentTime`, which `fire()` cannot reach. Footsteps at speed
should land with audible jitter instead of sample accuracy.

If that reproduces, the fix is a time argument on `fire`, and the demo is the
evidence for it.

---

## Art

The first pass is fully procedural — the world and the characters are drawn from
paths and gradients. Sprite art may follow.

So the draw code goes behind a skin seam: entity state and physics never name a
visual, and each entity kind resolves through one function that turns state into
draw commands. A later sprite pass replaces those functions and touches nothing
else.

That defers rather than dodges the `ImageDrawCommand` gap — no source rect and
no flip, so sprite sheets still need a custom fragment shader doing the UV math.
The art pass surfaces it; this one does not.

---

## Expected findings

Named up front so they are recognized rather than rediscovered. Each is recorded
against `docs/TODO.md` when the demo actually hits it.

- **`fire()` has no time argument** — above. The most likely real change.
- **No key-state poll.** `key-held` gives edges; the dispatcher's `heldKeys` is
  private and tracks claims, not physical keys. The demo maintains its own held
  set from the edges.
- **`TimelineHandle` has no `setLoop`.** Already a P2. A run cycle that starts
  and stops looping hits it.
- **Blur mid-hold.** Key-up never arrives if the window loses focus during a
  held key, so a held direction sticks. The demo guards it; the dispatcher
  probably should.
- **No tiled-content layer primitive.** Already a P3. The parallax backgrounds
  want one.

## Not in scope

Inverse kinematics, skinning, sprite sheets, and any migration of the demo's
frame loop, collision, or tile map into the kit.
