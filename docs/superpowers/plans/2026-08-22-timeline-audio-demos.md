# Timeline, Rig and Audio Demos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three `apps/site/demos/` pages that exercise the timeline, the rig, and the audio engine — plus the one small engine addition the audio demo needs.

**Architecture:** Each demo is one file under `apps/site/demos/` plus one entry in `apps/site/registry.ts`. Demos here are deliberately terse and single-purpose: each shows one kit capability in the smallest plausible form, per the convention in `CLAUDE.md`. Anything a demo has to hand-roll that the kit should have absorbed is a finding, not something to paper over.

**Tech Stack:** React 19, TypeScript, vite. Demos import from `@weasel-js/core` and `@weasel-js/audio` — never from a deep source path.

**Prerequisite:** BOTH arcs must be merged to `main` first — `animation-timeline` and `audio-engine`. Nothing here can start before that.

**Specs:**
- `docs/superpowers/specs/2026-08-22-animation-timeline-rig-design.md`
- `docs/superpowers/specs/2026-08-22-audio-engine-design.md`

---

## Registry entry shape

Every demo needs three edits to `apps/site/registry.ts`, matching what the other 48 entries do:

```ts
import { TimelineDemo } from './demos/TimelineDemo';          // 1. component import
import TimelineDemoFull from './demos/TimelineDemo.tsx?raw';  // 2. raw source, for the source panel
```

```ts
  {                                                            // 3. the entry
    id: 'timeline',
    title: 'Timeline',
    category: 'Animation',
    description: '...',    // full prose: what it shows and what to look at
    hint: '...',           // one line of controls
    Component: TimelineDemo,
    full: TimelineDemoFull,
    path: 'apps/site/demos/TimelineDemo.tsx',
  },
```

Put the three new entries in the `Animation` category block, after the `easings` entry. `description` is a real paragraph — read the `easings` and `pan-zoom` entries for the register and length expected.

---

### Task 1: `engine.register(buffer)` — play a buffer the consumer already has

**Files:**
- Modify: `packages/audio/src/soundCache.ts`
- Modify: `packages/audio/src/createAudioEngine.ts`
- Modify: `packages/audio/src/index.ts`
- Test: `packages/audio/src/soundCache.test.ts` (append)

The engine can `load(url)` and `decode(bytes)`. Neither helps a consumer who already holds an `AudioBuffer` — from an `OfflineAudioContext` render, a procedural synth, or a recorder. The audio demo needs exactly this so it can ship zero binary assets, and it is a real gap regardless: synthesized audio is a first-class source.

- [ ] **Step 1: Write the failing test**

Append to `packages/audio/src/soundCache.test.ts`:

```ts
  it('registers a buffer the caller already holds', async () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const buffer = { duration: 2.5 } as never;
    const h = cache.register(buffer);
    expect(cache.buffer(h)).toBe(buffer);
  });

  it('gives each registered buffer its own handle', async () => {
    const ctx = createFakeAudioContext();
    const cache = createSoundCache(ctx as never, okFetch());
    const a = cache.register({ duration: 1 } as never);
    const b = cache.register({ duration: 1 } as never);
    expect(a.id).not.toBe(b.id);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/audio/src/soundCache.test.ts`
Expected: FAIL — `cache.register is not a function`.

- [ ] **Step 3: Implement**

In `soundCache.ts`, add to the `SoundCache` interface:

```ts
  /** Take ownership of a buffer the caller already has — a procedural synth,
   *  an OfflineAudioContext render, a recording. Synchronous; nothing to decode. */
  register(buffer: AudioBuffer): SoundHandle;
```

and to the returned object, beside `decode`:

```ts
    register: (buffer) => store(buffer),
```

In `createAudioEngine.ts`, add `register: sounds.register,` to the `AudioEngine` object beside `decode`, and to the `AudioEngine` interface:

```ts
  register(buffer: AudioBuffer): SoundHandle;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/audio/`
Expected: PASS, all green.

- [ ] **Step 5: Commit**

```bash
git add packages/audio/src/
git commit -m "let a consumer register an AudioBuffer it already holds"
```

---

### Task 2: Timeline demo

**Files:**
- Create: `apps/site/demos/TimelineDemo.tsx`
- Modify: `apps/site/registry.ts`

Show the four things that distinguish a timeline from a tween: **scrubbing**, **event tracks that stay silent while you scrub**, **nesting**, and **live editing**.

- [ ] **Step 1: Build the demo**

Requirements — keep it to roughly 150 lines:

- A `SceneCanvas` with three rects driven by three `SampledTrack`s (x, y, and a color track using `lerpOklab` as its `interpolate`).
- One `EventTrack` whose `fire` pushes a labeled marker into a visible log panel, with keyframes at a few times.
- One `TimelineTrack` nesting a child timeline at an offset, so sequencing is visible.
- A transport row: play / pause, a **scrub slider** bound to `timeline.seek()`, a time readout from `timeline.time()`, a loop toggle, and a time-scale slider calling `setTimeScale`.
- A visible note next to the event log saying events fire on playback but not on scrub — then let the user prove it by dragging the slider and watching the log stay still.
- An "add keyframe" button that calls `timeline.edit()` to push a key onto the x track, showing that editing takes effect immediately.

Use `useAnimator()` and `animator.timeline(...)`. Do NOT reach for `createTimeline` — it is deliberately not exported.

- [ ] **Step 2: Register it**

Add the three registry edits described at the top of this plan. `id: 'timeline'`, `title: 'Timeline'`, `category: 'Animation'`.

- [ ] **Step 3: Verify it renders**

Run the dev server and load the demo. Confirm by direct observation: playback animates, the scrub slider moves the playhead, the event log grows during playback and does NOT grow while scrubbing, and the nested child starts at its offset.

- [ ] **Step 4: Commit**

```bash
git add apps/site/demos/TimelineDemo.tsx apps/site/registry.ts
git commit -m "add a timeline demo with transport, scrub and event tracks"
```

---

### Task 3: Rig demo

**Files:**
- Create: `apps/site/demos/RigDemo.tsx`
- Modify: `apps/site/registry.ts`

Show that a rig is a transform hierarchy and that animating one is an ordinary sampled track.

- [ ] **Step 1: Build the demo**

Requirements — roughly 150 lines:

- A `Skeleton` for a simple jointed figure: root → torso → upper arm → forearm, plus a leg chain. Five or six joints is enough; more is noise.
- Render each joint as a line or capsule using `resolveSkeleton(skeleton, pose)` to place it.
- Two named poses (call them A and B) and a **blend slider** calling `blendPoses([a, b], [1 - t, t])` directly, so the identity between blending and interpolating is visible by hand.
- A **play button** running a `SampledTrack<Pose>` on a timeline with `interpolate: (a, b, u) => blendPoses([a, b], [1 - u, u])`, looping — demonstrating that the slider and the timeline are doing the same operation.
- Joint labels toggled by a checkbox, so the hierarchy is legible.

- [ ] **Step 2: Register it**

`id: 'rig'`, `title: 'Rig'`, `category: 'Animation'`. The description should state plainly that pose interpolation and pose blending are the same operation, which is why the rig needs no timeline integration of its own.

- [ ] **Step 3: Verify it renders**

Load it. Confirm the blend slider and the looping timeline produce identical intermediate poses at the same blend factor.

- [ ] **Step 4: Commit**

```bash
git add apps/site/demos/RigDemo.tsx apps/site/registry.ts
git commit -m "add a rig demo showing pose blending as track interpolation"
```

---

### Task 4: Audio demo

**Files:**
- Create: `apps/site/demos/AudioDemo.tsx`
- Modify: `apps/site/registry.ts`

Ship **no binary assets**. Synthesize every sound procedurally into an `AudioBuffer` and hand it to `engine.register()` from Task 1.

- [ ] **Step 1: Build the demo**

Requirements — roughly 200 lines:

- A small `makeTone(ctx, { freq, ms, type })` helper filling an `AudioBuffer` by hand (a sine or a short decaying pluck — a few lines of `Math.sin` over `getChannelData(0)`). Three or four distinct tones.
- **An explicit "enable audio" button.** The context starts suspended; the demo must show this rather than hide it, because it is the first thing every consumer hits. Display `engine.state()` next to the button.
- **Spatialization:** a draggable source dot on a canvas with a fixed listener at center. Dragging calls `voice.setPosition()` on a looping tone. Show the computed `gain` and `pan` as live numbers next to the canvas — this is what makes the model legible.
- **Buses:** gain sliders plus mute and solo toggles for `sfx` and `music`, with a one-shot trigger per bus.
- **Analysis:** an `analyser()` tap on master, with `bands(16)` driving sixteen bars rendered on the canvas. This is the payoff — audio driving what the renderer draws.
- **Voice limiting:** a "fire 50 one-shots" button and a live active-voice count, so stealing is observable.

Call `engine.dispose()` on unmount.

- [ ] **Step 2: Register it**

`id: 'audio'`, `title: 'Audio'`, `category: 'Animation'`. The description should say that playback is lookahead-scheduled against the audio hardware clock rather than triggered per frame, and why.

- [ ] **Step 3: Verify it renders and sounds right**

Load it and use it. Confirm by direct observation: audio is silent until enabled; dragging the source pans and attenuates audibly; solo silences the other bus; the bands react to what is playing; firing 50 one-shots does not distort, and the active count holds at the limit.

Report honestly if any of that does not hold. A demo that renders but does not make sound is not done.

- [ ] **Step 4: Commit**

```bash
git add apps/site/demos/AudioDemo.tsx apps/site/registry.ts
git commit -m "add an audio demo with spatialization, buses and band analysis"
```

---

### Task 5: Gate

- [ ] **Step 1: Full verification**

Run from the repo root:

```bash
npx tsc --noEmit \
  && npx vitest run --project=kit --project=weasel-ui \
  && npm run build:demo
```

Expected: all exit 0. `build:demo` matters — a demo that breaks the site build is worse than no demo.

- [ ] **Step 2: Changeset**

Only if Task 1 shipped (`engine.register`). Demos are not published, so they need no changeset of their own.

```markdown
---
'@weasel-js/audio': patch
---

Add `engine.register(buffer)` for playing an `AudioBuffer` the consumer already
holds — a procedural synth, an `OfflineAudioContext` render, a recording. `load`
and `decode` both assume encoded bytes; neither covers audio you generated.
```

- [ ] **Step 3: Commit**

```bash
git add .changeset/
git commit -m "add a changeset for the buffer registration API"
```

---

## Notes for whoever executes this

**Demo conventions matter here.** `CLAUDE.md` says demos are terse and single-purpose, and that boilerplate accumulating in one is a signal the kit should absorb it. If any of these three demos ends up hand-rolling something the kit ought to provide, stop and say so — that is a kit finding, and more valuable than the demo.

**Do not import from deep source paths.** Demos consume the public barrels, `@weasel-js/core` and `@weasel-js/audio`. If something a demo needs is not exported, that is a real gap in the public surface; report it rather than routing around it.

**These three demos are the load test that arc 1 was moved after.** Anything awkward, missing, or surprising while writing them belongs in `docs/TODO.md`.
