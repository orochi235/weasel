# Side-scroller, audio, and richer animation: three arcs

**What this is:** a decomposition, not a design. Three pieces of work were proposed
together — a side-scrolling game demo, sound support, and stronger animation
(timelines, tweening, rigging). They are three independent arcs. This names them,
records what the codebase already provides each one, and fixes the order.

**Who it's for:** whoever picks up one of the three. Each arc gets its own spec;
this document is what that spec starts from.

**What it answers:** what is actually missing (as opposed to assumed missing), and
why the game demo goes first even though nothing depends on it.

---

## What the kit already provides

Verified against `main` on 2026-08-22. Each arc's spec should re-check these
rather than trust them — but nobody needs to rediscover them.

- **Renderer** is WebGL2 (`WeaselRenderer.ts`), with batched solid geometry and a
  `GroupDrawCommand` carrying transform, alpha, color matrix, and stencil clip.
- **Parallax** ships: `deriveParallaxView(outer, { pan, zoom, anchor })` plus
  `createParallaxLayer`. `pan`/`zoom` each take a scalar or `{x, y}`, so one-axis
  parallax — the side-scrolling case — is already the documented use.
- **Animation** has tween, spring, decay, a unified `physics` primitive with
  mid-flight retargeting, `loop`, `tweenLoop`, and `stagger`, over 40 easings and
  spring presets. Every animation carries its own virtual clock: `pause`,
  `resume`, `setTimeScale`, and `cancelKey`, individually and by key.
- **Key holds** are public: `KeyHeldSpec` (`kind: 'key-held'`, `key: string |
  string[]`, `mods`, `phase`) is exported from `@weasel-js/gestures` and
  `@weasel-js/core`. Keydown opens, keyup closes; `toolOffhand.ts` is the shipped
  example. The dispatcher suppresses autorepeat for claimed keys and calls
  `preventDefault` on them.
- **Textures** are reachable: `registerTexture(image)` returns a `TextureHandle`
  whose id passes as a `ShaderDrawCommand` uniform.

And what it does not:

- **No frame tick.** `Animator`'s every entry point is a *value* animation. There
  is no `onFrame` subscription to hang a game loop or a timeline clock on.
- **No key-state poll.** Key holds are edges, not a queryable set. The dispatcher's
  internal `heldKeys` is not one either: a key enters it only when a key-held
  binding *claimed* it, so it tracks up-phase bookkeeping, not physical key state.
- **No sprite sub-rects on the first-class path.** `ImageDrawCommand` is
  `{ image, x, y, w, h }` — no source rect, no flip. Sprite sheets work only
  through `ShaderDrawCommand` with a custom fragment shader doing the UV math.
- **No audio.** Zero `AudioContext` or `new Audio` in `packages/` or `apps/`.
- **No timeline**, in the sense of keyframe tracks composed on one clock and
  scrubbable to an arbitrary `t`.
- **No game physics.** `useSimulation` is a d3-force integrator with alpha cooling
  — a settling simulation, with no fixed timestep and no collision. It is the
  right thing for force-directed layout and the wrong thing for a platformer.

---

## Arc 1 — side-scroller demo

An `apps/site/demos/` entry that exercises camera, parallax, container transforms,
and the animator harder than any current demo does.

The demo owns its own frame loop, its own held-key set derived from `key-held`
edges, its own collision, and its own tile map. None of that is a kit concern and
none of it should migrate.

Nothing blocks it. The kit changes it will surface, which are worth seeing in
practice before their shape is fixed:

- a source rect and flip on `ImageDrawCommand`, so sprite sheets stop needing a
  custom shader;
- a public frame tick, which the timeline in arc 2 needs regardless;
- a key-state poll over the `key-held` edges.

**Decision:** a platformer in `apps/site/demos/` is a deliberate exception to the
"terse and single-purpose" rule in `CLAUDE.md`. It is an exception, not a
precedent — the convention still holds for everything else in that directory.

## Arc 2 — animation timelines and a hierarchical rig

One spec for both, because the rig is what the timeline drives.

**Timeline:** keyframe tracks, scrub to an arbitrary `t`, sequence and parallel
composition, one clock. It sits *over* the existing animator rather than beside
it — tween and spring stay as the per-segment interpolators.

**Rig:** named joints, a bind pose, and pose blending over the container transform
hierarchy that already exists. No renderer work.

Explicitly out of scope, and named here so they are not smuggled in: inverse
kinematics, and skinning. Skinning is the large one — the renderer flattens paths
to meshes, so per-vertex bone weights would have to reach the vertex shader or be
applied on the CPU every frame. Either is its own arc, and neither should be
attempted before the hierarchical rig exists to attach to.

This arc absorbs three P3 items standing in `docs/TODO.md` under Animation:
animation events and observability (a timeline needs them), scroll- and
pointer-driven progress (that *is* a timeline scrubbed by a non-time value), and
animation-aware undo.

## Arc 3 — `@weasel-js/audio`

A new package joining the lockstep `fixed` group, which means one bump here moves
all fourteen.

Audio is a foundation the engine doesn't have, so the arc builds one: loading and
decoding, one-shot playback with voice pooling, looping beds, a mix graph, and a
clock the timeline can share. Design it as engine surface — general, composable,
and good on its own terms — not as the minimum the game demo happens to need.

The one real design constraint is the clock. Web Audio runs on its own hardware
timeline (`AudioContext.currentTime`), which does not tick with
`requestAnimationFrame` and cannot be paused by an animator's virtual clock.
Scheduling has to be lookahead-based against the audio clock rather than
frame-driven, and that shapes the bridge to arc 2 more than anything else does.

---

## Order: 1, then 2 and 3 in parallel, bridge last

The three are technically independent. None blocks another, and 2 and 3 can run
concurrently.

The ordering is about information rather than dependency. The game demo is the only
one of the three that *generates requirements* for the others: run it first and the
timeline arc opens with a real animation it has to express, and the audio arc with a
real one-shot workload it has to serve. Run it last and both are designed against
guesses about what a consumer wants.

The bridge — firing a sample from a timeline track — comes after both arcs land.
Design each side to meet at "a track emits an event at `t`" and neither package
needs to import the other.
