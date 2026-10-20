# Live audio runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Unbuilt (2026-10-20).** Wave 2 of the fourth arc. The patchable audio graph it builds on has
merged (2026-10-20); its contract, JSDoc included, is `packages/audio/src/graph/types.ts`.

**Depends on:** that API, as written there:
`AudioEngine.graph(bus?)` returning an `AudioGraph` (`add`, `remove`, `replace`, `connect`, `disconnect`,
`set(id, param, value, rampMs?)`, `apply(patches)`, `start`, `stop`, `playing`, `has`, `ids`, `tap(id)`,
`settled`, `dispose`); `GraphNodeDef`; `GraphTarget = { node, port } | { output: true }`; `GraphPatch`
with kinds `add | remove | replace | connect | disconnect | set`; and the node factories
`createFileSourceNode`, `createOscillatorNode`, `createNoiseNode`, `createGainNode`, `createPanNode`,
`createMixNode`, `filterNode`, `delayNode`, `reverbNode`, `compressorNode`. `reverbNode` takes a `seconds`
setting and makes its own impulse with that plan's `impulseResponse`. Three of its rules shape this
plan: a discrete setting (oscillator wave, noise color, filter type, a file's buffer) changes through
`replace`, never `set`; `connect` throws on a cycle, so feedback wires are flagged before any patch is
made; and pausing is `stop()` (sources stop, the output fades), playing is `start()`. Three more, settled while building it (2026-10-20): the output starts at gain 0, so a graph
never started is silent; `apply` validates the whole list before changing anything, but a `set` that
throws (a delay's `RangeError`) lets the rest of the list apply and then rethrows; and `dispose()`
fades out over `fadeMs` while sounding before it tears down.

**Goal:** Pipeline mode in weaselchart plays audio pipelines live: each edit is diffed against the
running graph and applied as patches, so editing never restarts the sound.

**Architecture:** A pure compiler turns an `EffectPipeline` into a `LivePlan` (the nodes, their
discrete settings and numeric params, and the connections that should exist), and a pure differ turns
two plans into `GraphPatch`es for `AudioGraph.apply`. `createLiveAudioRunner` holds the current plan and
graph, and publishes `EffectRun`s whose previews come from `graph.tap`. The audio stage types live in
`packages/diagram/src/effect/audio/`, apart from the runner, the way `image/` holds `imageEvaluators`.
They ship from a new subpath, `@weasel-js/diagram/effect-audio`, so `./effect` consumers don't pull in
`@weasel-js/audio`.

**Tech Stack:** TypeScript, React, Web Audio (`AudioContext`, `OfflineAudioContext`), vitest
(jsdom `weasel-ui` and `draw` projects, Chromium `browser` project), tsup.

**Spec:** `docs/superpowers/specs/2026-10-20-chart-fourth-arc-design.md` (row "Live audio runner",
and the Decisions on audio sources and previews).

## Global Constraints

- Audio sources are an audio file and oscillators and noise. No microphone.
- Audio previews are a scope and a spectrum: with View › Show Previews on, each stage taps an analyser
  on its output and draws a waveform, with a toggle to a spectrum.
- The audio stage types are file, oscillator, noise, gain, pan, filter, delay, reverb, compressor, mix,
  and output, kept apart from the runner the way `imageEvaluators` is.
- In pipeline mode the stage palette picks Image or Audio, and Run › Play and Pause start and stop the sound.
- Every changeset is `patch`.
- No source file over 400 lines, no function over 120 (`npm run check:size`).
- Every frame loop runs behind `useVisibleRaf`, with `onResume` rebasing any clock.
- Tests and typechecks run on the fleet, never locally: `onto do --kind test -- npx vitest run --project=<p> <file>`,
  `onto do --kind typecheck -- npm run typecheck`. The merge gate is `npm run test:fleet` on the branch.
- Browser checks are `*.browser.test.{ts,tsx}` files (the `browser` project), not story `play`s.

## Review Focus

- **A feedback wire** — a cycle through a delay is a natural thing to patch, and the graph's `connect`
  throws on one. The looped stages show "on a feedback loop" and the rest keeps playing. Pinned in Task 3
  and Task 5.
- **Two wires into one audio input** — they sum, as Web Audio does, rather than the first winning the
  way `createPass` picks one. Pinned in Task 3.
- **Turning a knob while it plays** — a level change is a `set` patch, never a `replace` or a remove
  and re-add, so a delay's tail survives. Pinned in Task 4 (patch shape) and Task 7 (rendered audio).
- **A file stage before any audio is chosen** — that stage shows "no source audio" as its error and
  everything else keeps playing; nothing throws. Pinned in Task 3.
- **Leaving pipeline mode while sound plays** — unmounting disposes the graph and the sound stops.
  Pinned in Task 9.

---

### Task 1: Share param reading and preview closing between runners

No behavior change: two helpers the live runner needs leave the files they're private to.

**Files:**
- Create: `packages/diagram/src/effect/runner/params.ts`
- Create: `packages/diagram/src/effect/runner/previews.ts`
- Modify: `packages/diagram/src/effect/runner/pass.ts` (the `params` line in `evaluate`)
- Modify: `packages/diagram/src/effect/runner/runner.ts` (delete `previewsOf` and `close`, import them)
- Test: `packages/diagram/src/effect/runner/params.test.ts`

**Interfaces:**
- Produces: `paramValues(stage: EffectStage): Record<string, unknown>` (by `p.id ?? p.label`, value
  `p.control?.value ?? p.value`); `previewsOf(run: EffectRun): ImageBitmap[]`;
  `closeBitmaps(bitmaps: readonly ImageBitmap[]): void` (closes each distinct bitmap once).

- [ ] **Step 1: Write the failing test** — `paramValues` keys a param by id when it has one and by label
  otherwise, and prefers the control's value over the display string:

```ts
expect(paramValues({ id: 's', title: 'S', params: [
  { id: 'f', label: 'freq', value: '440 Hz', control: { kind: 'number', value: 440 } },
  { label: 'note', value: 'A4' },
] })).toEqual({ f: 440, note: 'A4' });
```

- [ ] **Step 2: Run it to verify it fails** — `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/effect/runner/params.test.ts`. Expected: FAIL, cannot resolve `./params`.
- [ ] **Step 3: Add both modules and point `pass.ts` and `runner.ts` at them.**
- [ ] **Step 4: Run the test plus `runner.test.ts`, `runPipeline.test.ts` and `useEffectRunner.test.tsx`** in the same `onto do` call. Expected: all PASS.
- [ ] **Step 5: Commit** — `git commit -m "share param reading and preview closing between effect runners"`

### Task 2: Audio stage types and the graph node each builds

**Files:**
- Create: `packages/diagram/src/effect/audio/stageTypes.ts`
- Create: `packages/diagram/src/effect/audio/nodes.ts`
- Test: `packages/diagram/src/effect/audio/nodes.test.ts`

**Interfaces:**
- Consumes: `formatParam`, `EffectStageType` (`../stageTypes`); the graph plan's node factories and `GraphNodeDef`.
- Produces:
  - `AUDIO_STAGE_TYPES: readonly EffectStageType[]`. Every `type` is prefixed `audio.` because
    `IMAGE_STAGE_TYPES` already has `oscillator`. Every port has type `'audio'`. A param is a
    **setting** (discrete, changed by `replace`) or a **level** (numeric, changed by `set`, under the
    graph factory's own param name):

    | type | title | kind | inputs | settings | levels (control) | factory |
    |---|---|---|---|---|---|---|
    | `audio.file` | File | source | — | the source buffer | — | `createFileSourceNode` (loops) |
    | `audio.oscillator` | Oscillator | source | — | wave: enum sine/square/sawtooth/triangle, sine | frequency: 20–20000, 440, step 1, Hz | `createOscillatorNode` |
    | `audio.noise` | Noise | source | — | color: enum white/pink/brown, white | — | `createNoiseNode` |
    | `audio.gain` | Gain | | in | — | gain: 0–2, 1, step 0.01 | `createGainNode` |
    | `audio.pan` | Pan | | in | — | pan: −1–1, 0, step 0.01 | `createPanNode` |
    | `audio.filter` | Filter | | in | type: enum lowpass/highpass/bandpass, lowpass | frequency: 20–20000, 1000, step 1, Hz; Q: 0.1–20, 1, step 0.1 | `filterNode` |
    | `audio.delay` | Delay | | in | — | time: 0–2000, 300, step 10, ms; feedback: 0–0.95, 0.4, step 0.01; mix: 0–1, 0.5, step 0.01 | `delayNode` |
    | `audio.reverb` | Reverb | | in | seconds: number 0.1–10, 2, step 0.1, s | mix: 0–1, 0.3, step 0.01 | `reverbNode({ seconds, mix })`, which makes its own impulse |
    | `audio.compressor` | Compressor | | in | — | threshold: −60–0, −24, step 1, dB; ratio: 1–20, 4, step 0.5 | `compressorNode` |
    | `audio.mix` | Mix | | a, b | — | a: 0–2, 1, step 0.01; b: 0–2, 1, step 0.01 | `createMixNode({ inputs: ['a', 'b'] })` |
    | `audio.output` | Output | sink | in | — | — | none: it is the graph's output |

    Every stage but File has an `out` output. Each param's `id` is the name in the table.
  - ```ts
    interface AudioStageNode {
      /** The stage's discrete settings, from its param values and the run's sources. Throws to fail the stage. */
      settings(params: Readonly<Record<string, unknown>>, sources: AudioSources): Readonly<Record<string, unknown>>;
      /** The ids of its numeric params, each a `params` key of the def `build` returns. */
      levels: readonly string[];
      build(ctx: BaseAudioContext, settings: Readonly<Record<string, unknown>>, levels: Readonly<Record<string, number>>): GraphNodeDef;
    }
    type AudioStageNodes = Readonly<Record<string, AudioStageNode>>;
    const audioStageNodes: AudioStageNodes;   // every type above but audio.output
    interface AudioSources { audio?: AudioBuffer }
    ```
    `audio.file`'s `settings` throws `new Error('no source audio')` when `sources.audio` is absent, and
    returns `{ buffer }` otherwise, so choosing a new file is a settings change (a `replace`).

- [ ] **Step 1: Write the failing tests**:
  - every `AUDIO_STAGE_TYPES` entry but `audio.output` has an `audioStageNodes` entry, and every type starts with `audio.`;
  - every `levels` id is a key of the def `build` returns, checked for each type on `createFakeAudioContext` (from `@weasel-js/audio`'s testing helpers, the way its own tests import them);
  - `audioStageNodes['audio.oscillator']!.settings({ wave: 'square', frequency: 220 }, {})` equals `{ wave: 'square' }`;
  - `audio.file` without a buffer throws `/no source audio/`;
  - `audio.reverb`'s `settings({ seconds: 3, mix: 0.3 }, {})` equals `{ seconds: 3 }`, and its `build` hands `reverbNode` `{ seconds: 3, mix: 0.3 }`.
- [ ] **Step 2: Run to verify it fails** — `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/effect/audio/nodes.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement both files.** Build the params with the same `param()` helper shape `image/stageTypes.ts` uses.
- [ ] **Step 4: Rerun.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "add 11 audio stage types and the graph node each builds"`

### Task 3: Compile a pipeline into a live plan

**Files:**
- Create: `packages/diagram/src/effect/audio/plan.ts`
- Test: `packages/diagram/src/effect/audio/plan.test.ts`

**Interfaces:**
- Consumes: `runOrder` (`../runner/order`), `uniqueStages` (`../draw`), `paramValues` (Task 1), `AudioStageNodes`, `AudioSources` (Task 2); `GraphTarget`.
- Produces:

```ts
interface PlanNode { type: string; settings: Readonly<Record<string, unknown>>; levels: Readonly<Record<string, number>> }
interface PlanEdge { from: string; to: GraphTarget }
interface LivePlan {
  nodes: Readonly<Record<string, PlanNode>>;
  edges: readonly PlanEdge[];                 // sorted by edgeKey, so equal plans compare equal
  errors: Readonly<Record<string, string>>;   // by stage id
}
function livePlan(pipeline: EffectPipeline, nodes: AudioStageNodes, sources: AudioSources): LivePlan
const edgeKey: (e: PlanEdge) => string
const EMPTY_PLAN: LivePlan
```

Rules: only stages with an `audioStageNodes` entry or of type `audio.output` take part. A stage on a
cycle (`runOrder(...).cyclic`) is left out with the error `'on a feedback loop'`, so no patch ever asks
the graph for a cycle. A source whose `settings` throws is left out with its message as the error. A
stage with inputs none of which a planned stage reaches is left out, with no error. A bypassed stage is
no node: each edge into its first `audio` input is carried on to every target of its output. An edge
into an `audio.output` stage becomes `to: { output: true }`. Every wire into an input is kept, so several
sum. A wire's `to.port` is the port id; a wire's `from.port` is dropped, since every node has one output.

- [ ] **Step 1: Write the failing tests**, one `it` each:
  - oscillator → gain → output gives two nodes and the edges `osc → { node: 'gain', port: 'in' }`, `gain → { output: true }`; the oscillator's node is `{ type: 'audio.oscillator', settings: { wave: 'sine' }, levels: { frequency: 440 } }`.
  - two oscillators wired into one gain's `in` give two edges into `gain` (they sum).
  - `audio.file` with no `sources.audio` gives `errors: { file: 'no source audio' }`, no `file` node,
    and a gain fed only by it is absent from `nodes`.
  - a bypassed filter between an oscillator and the output gives the edge `osc → { output: true }` and no `filter` node.
  - a gain wired to itself through a delay (a feedback loop) leaves both out, each with the error `'on a feedback loop'`, and no edge names either.
  - an image stage (`blur`) in the same pipeline is ignored.
- [ ] **Step 2: Run to verify it fails** — `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/effect/audio/plan.test.ts`.
- [ ] **Step 3: Implement `livePlan`, `edgeKey` and `EMPTY_PLAN`.**
- [ ] **Step 4: Rerun.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "compile an audio pipeline into the graph it should play"`

### Task 4: Diff two plans into graph patches

**Files:**
- Create: `packages/diagram/src/effect/audio/patches.ts`
- Test: `packages/diagram/src/effect/audio/patches.test.ts`

**Interfaces:**
- Consumes: `LivePlan`, `PlanNode`, `edgeKey` (Task 3); `GraphPatch`, `GraphNodeDef`.
- Produces:

```ts
/** Makes the def for a node that is added or replaced. The runner passes one over its context and stage nodes; tests pass a stub. */
type BuildNode = (id: string, node: PlanNode) => GraphNodeDef;
function diffPlans(prev: LivePlan, next: LivePlan, build: BuildNode): GraphPatch[]
```

Per node: absent before → `add`; absent after → `remove`; a different `type` → `remove` then `add`, and
every edge touching it is reconnected; different `settings` (compared shallowly, a buffer by identity) →
`replace`, which keeps its edges; each changed level → `set` with no `rampMs`, so the graph's fade
applies. Patch order is always: every `disconnect`, every `remove`, every `add`, every `replace`, every
`set`, every `connect`. A removed node's own edges get no `disconnect` (removing it drops them); only
edges between nodes that survive do.

- [ ] **Step 1: Write the failing tests** (with `build` a stub returning `{ inputs: {}, output: {} as AudioNode, params: {} }` tagged by id):
  - `diffPlans(EMPTY_PLAN, p, build)` is every `add`, then every `connect`.
  - changing a delay's `time` from 300 to 500 gives exactly `[{ kind: 'set', id: 'delay', param: 'time', value: 500 }]`.
  - changing an oscillator's `wave` gives exactly one `replace` for it, and no `disconnect` or `connect`.
  - changing a reverb's `seconds` gives exactly one `replace`.
  - deleting a gain between osc and output gives `remove gain`, then `connect osc → { output: true }`, with no `disconnect` naming `gain`.
  - round trip: replaying `diffPlans(a, b)` then `diffPlans(b, a)` through a small reducer in the test file over `a` ends equal to `a`.
  - `diffPlans(p, p, build)` is `[]`.
- [ ] **Step 2: Run to verify it fails** — `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/effect/audio/patches.test.ts`.
- [ ] **Step 3: Implement `diffPlans`.**
- [ ] **Step 4: Rerun.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "diff two audio plans into graph patches"`

### Task 5: The live runner over the graph

**Files:**
- Create: `packages/diagram/src/effect/audio/liveRunner.ts`
- Test: `packages/diagram/src/effect/audio/liveRunner.test.ts` (on `createFakeAudioContext`, with a fake `AudioGraph` that records calls)

**Interfaces:**
- Consumes: Tasks 2–4; `AudioEngine`, `AudioGraph` from `@weasel-js/audio`.
- Produces:

```ts
interface LiveAudioRunnerState { run: EffectRun | undefined; playing: boolean }
interface LiveAudioRunnerOptions {
  engine: AudioEngine;
  pipeline: EffectPipeline;
  nodes?: AudioStageNodes;     // default audioStageNodes
  sources?: AudioSources;
  bus?: string;                // passed to engine.graph
}
interface LiveAudioRunner {
  readonly state: LiveAudioRunnerState;
  setPipeline(pipeline: EffectPipeline): void;  // replan, diff, graph.apply, playing or not
  setSources(sources: AudioSources): void;      // replan: a new buffer is a replace of each file node
  play(): Promise<void>;   // await engine.unlock(), then graph.start(); playing: true
  pause(): void;           // graph.stop(); playing: false
  reset(): void;           // graph.dispose(), a fresh engine.graph(bus), the current plan added from EMPTY_PLAN; not playing. Files start again from 0.
  subscribe(listener: () => void): () => void;
  dispose(): void;         // graph.dispose(); usable no further. The engine is the caller's.
}
function createLiveAudioRunner(opts: LiveAudioRunnerOptions): LiveAudioRunner
```

The runner's `BuildNode` is `(id, n) => nodes[n.type]!.build(engine.context, n.settings, n.levels)`.
`state.run` carries each plan error as that stage's `error`, and nothing else yet (previews come in
Task 6); it is a new object only when the errors change. If `graph.apply` throws on a structural error, the runner keeps the
previous plan, records the message as the error of the stage the failing patch names, and logs once
with `console.warn('@weasel-js/diagram: …')`. When the throw comes from a `set` (the rest of the list has applied), the runner adopts the next plan instead, records the message on that stage, and still warns once; a test pins both cases.

- [ ] **Step 1: Write the failing tests** against the fake graph:
  - creating the runner over osc → output records one `apply` holding `add osc` then `connect osc → { output: true }`.
  - `setPipeline` with the oscillator's frequency changed records one `apply([{ kind: 'set', id: 'osc', param: 'frequency', value: 220 }])`.
  - `setPipeline` with a feedback wire added records no `connect` naming either looped stage, and `state.run.stages` gives both the error `'on a feedback loop'`.
  - `play()` awaits `engine.unlock()` and then calls `graph.start()`, and sets `state.playing`; `pause()` calls `graph.stop()`.
  - `state.run.stages.file.error` is `'no source audio'` until `setSources({ audio: buffer })`, which records an `add` for `file`; a second `setSources` with another buffer records a `replace`.
  - an `apply` that throws leaves the plan unchanged: the next `setPipeline` diffs from the old plan.
  - `dispose()` calls `graph.dispose()` once, and a second `dispose()` doesn't.
- [ ] **Step 2: Run to verify it fails** — `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/effect/audio/liveRunner.test.ts`.
- [ ] **Step 3: Implement `createLiveAudioRunner`.**
- [ ] **Step 4: Rerun.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "add a live runner that patches an audio graph as its pipeline is edited"`

### Task 6: Scope and spectrum previews, and the hook

**Files:**
- Create: `packages/diagram/src/effect/audio/scope.ts`
- Create: `packages/diagram/src/effect/audio/useLiveAudioRunner.ts`
- Modify: `packages/diagram/src/effect/audio/liveRunner.ts` (previews)
- Test: `packages/diagram/src/effect/audio/scope.browser.test.ts`, `packages/diagram/src/effect/audio/useLiveAudioRunner.test.tsx`

**Interfaces:**
- Consumes: Task 5; `AudioGraph.tap`, `AnalyserTap` (`@weasel-js/audio`); `previewsOf`, `closeBitmaps` (Task 1); `PREVIEW_SIZE` (`../draw`); `useVisibleRaf` (`@weasel-js/react`).
- Produces:
  - `type AudioPreview = 'off' | 'scope' | 'spectrum'`.
  - `drawScope(tap: AnalyserTap, size: { width: number; height: number }): ImageBitmap` — the waveform
    as a 1.5px line at `PREVIEW_DENSITY` 2, centered at mid-height.
  - `drawSpectrum(tap: AnalyserTap, size): ImageBitmap` — `tap.bands(32)` as filled bars from the bottom.
  - On `LiveAudioRunner`: `setPreviews(mode: AudioPreview): void` (when not `'off'`, holds a
    `graph.tap(id)` for every planned node, and takes one for each node a later `add` brings; a tap
    survives `replace` and goes with its node on `remove`, so a node removed and re-added is tapped
    again; `'off'` disposes every tap); `frame(): void` (publishes a
    new `run` whose `previews.out` is drawn from each tap); `drawn(run: EffectRun | undefined): void`
    (same contract as `EffectRunner.drawn`, through `previewsOf`/`closeBitmaps`).
  - `useLiveAudioRunner(opts: LiveAudioRunnerOptions & { previews: AudioPreview } & Pick<VisibleRafOptions, 'target' | 'requestFrame' | 'cancelFrame'>): LiveAudioRunnerState & { runner: LiveAudioRunner }`
    — makes the runner once, follows `pipeline`, `sources` and `previews`, runs `runner.frame()` every
    visible frame while `playing` and `previews !== 'off'`, calls `drawn` after the render that shows a
    run, and disposes on unmount. The engine is the caller's.

- [ ] **Step 1: Write the failing tests**:
  - browser: a tap on a 1 kHz oscillator in an `OfflineAudioContext` rendered 0.1 s gives a scope
    bitmap of `size × 2` whose middle column has an opaque pixel away from mid-height, and a spectrum
    bitmap whose tallest bar is in the bucket containing 1 kHz.
  - jsdom: with a fake `requestFrame`, `useLiveAudioRunner` calls `frame` once per frame while playing
    with previews on, never with previews `'off'`, and calls `runner.dispose` on unmount.
- [ ] **Step 2: Run to verify they fail** — `onto do --kind test -- npx vitest run --project=browser packages/diagram/src/effect/audio/scope.browser.test.ts` and `onto do --kind test -- npx vitest run --project=weasel-ui packages/diagram/src/effect/audio/useLiveAudioRunner.test.tsx`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Rerun both.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "draw a scope or a spectrum for each audio stage while it plays"`

### Task 7: The `effect-audio` entry, and the tail test

**Files:**
- Create: `packages/diagram/src/effect-audio.entry.ts`
- Modify: `packages/diagram/tsup.config.ts` (add `'effect-audio': 'src/effect-audio.entry.ts'`)
- Modify: `packages/diagram/package.json` (`exports["./effect-audio"]`; `@weasel-js/audio` in
  `peerDependencies` at the current fixed version, marked optional in `peerDependenciesMeta`)
- Create: `packages/diagram/src/effect/audio/liveRunner.browser.test.ts`
- Create: `.changeset/<name>.md` (`'@weasel-js/diagram': patch`)
- Modify: `packages/diagram/README.md` (a short "Live audio" section under the effect runner docs)

**Interfaces:**
- Produces: `@weasel-js/diagram/effect-audio` exports `AUDIO_STAGE_TYPES`, `audioStageNodes`,
  `livePlan`, `EMPTY_PLAN`, `diffPlans`, `createLiveAudioRunner`, `useLiveAudioRunner`,
  `drawScope`, `drawSpectrum`, and the types `AudioStageNode`, `AudioStageNodes`, `AudioSources`,
  `LivePlan`, `PlanNode`, `PlanEdge`, `BuildNode`,
  `LiveAudioRunner`, `LiveAudioRunnerOptions`, `LiveAudioRunnerState`, `AudioPreview`. Re-export by name.

- [ ] **Step 1: Write the failing browser test** — through `renderEngineStereo` and its `later` hook,
  a runner over osc → gain → delay(time 250, feedback 0.6, mix 0.5) → output, started with `play()`. At
  `later.at = 0.3` one `setPipeline` sets the gain to 0 and the delay's `mix` to 0.8. Assert RMS over
  0.5–0.8 s is above 0.01: the delay's tail survived the patch. A control render passes a `nodes`
  override whose delay returns `mix` from `settings` instead of listing it in `levels`, so the same
  edit is a `replace`; its RMS over 0.5–0.8 s must be below 0.001. The control proves the assertion can
  fail.
- [ ] **Step 2: Run it** — `onto do --kind test -- npx vitest run --project=browser packages/diagram/src/effect/audio/liveRunner.browser.test.ts`. Expected: FAIL until the entry exists.
- [ ] **Step 3: Add the entry, build config, manifest, changeset, README section.**
- [ ] **Step 4: Verify** — rerun the browser test (PASS); `onto do --kind typecheck -- npm run typecheck`;
  `onto do --kind lint -- npm run check:imports`; `onto do --kind build -- npm run test:smoke:consumer`. Expected: all clean.
- [ ] **Step 5: Commit** — `git commit -m "ship the live audio runner from @weasel-js/diagram/effect-audio"`

### Task 8: Image or Audio in the stage palette

**Files:**
- Modify: `apps/chart/src/pipeline/StagePalette.tsx`
- Modify: `apps/chart/src/pipeline/StagePalette.test.tsx`

**Interfaces:**
- Produces: `StagePaletteProps` gains nothing; the palette holds `domain: 'image' | 'audio'` itself
  (default `'image'`) and shows a `ToggleBar` (`@weasel-js/ui/components/ToggleBar`, `ariaLabel="Stage set"`,
  items `Image` and `Audio`) above the list, listing `IMAGE_STAGE_TYPES` or `AUDIO_STAGE_TYPES`.

- [ ] **Step 1: Write the failing test** — clicking `Audio` lists "Delay" and not "Blur"; activating
  "Delay" calls `onAdd` with the type whose `type` is `audio.delay`.
- [ ] **Step 2: Run** — `onto do --kind test -- npx vitest run --project=draw apps/chart/src/pipeline/StagePalette.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Rerun.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "let the stage palette list image or audio stages"`

### Task 9: Play audio pipelines in pipeline mode

**Files:**
- Create: `apps/chart/src/pipeline/pipelineAudio.ts`
- Modify: `apps/chart/src/pipeline/pipelineRun.ts`
- Test: `apps/chart/src/pipeline/pipelineAudio.test.ts`, `apps/chart/src/pipeline/audio.browser.test.tsx`

**Interfaces:**
- Consumes: Task 7's entry; `createAudioEngine`; `pickFile`; `useCommand`.
- Produces:
  - `splitDomains(pipeline: EffectPipeline): { image: EffectPipeline; audio: EffectPipeline }` — audio
    stages are those whose `type` is in `AUDIO_STAGE_TYPES`; each half keeps only wires between its own
    stages, and both keep `types` and `groups`.
  - `usePipelineAudio(pipeline: EffectPipeline, previews: AudioPreview): { run: EffectRun | undefined; runner: LiveAudioRunner | null }`
    — makes its engine (`createAudioEngine()`) on the first Play, not on mount, and disposes it on unmount.
  - `RUN_ACTIONS` gains `audioSource: 'pipeline.audioSource'` ("Choose Source Audio…", in the `source`
    run beside "Choose Source Image…") and `showSpectrum: 'pipeline.showSpectrum'` ("Show Spectrum",
    in `SHOW_MENU` after Show Previews, active when on, enabled only while Show Previews is on).
  - `usePipelineRun` feeds `splitDomains(pipeline).image` to `useEffectRunner`, `.audio` to
    `usePipelineAudio`, and returns one `EffectRun` whose `stages` merge both (ids are disjoint). Play,
    Pause and Reset drive both runners.

- [ ] **Step 1: Write the failing tests**:
  - jsdom: `splitDomains` of blur + audio.gain with a wire between two audio stages and one between two
    image stages puts each wire on its own side and the blur stage only in `image`.
  - browser: mount the chart app in pipeline mode, pick Audio in the palette, add Oscillator and
    Output, wire them, choose Run › Play: Run › Pause becomes enabled and Play disabled; turn on View ›
    Show Previews and the oscillator's preview slot gets a bitmap, and View › Show Spectrum swaps it for
    another; Run › Pause re-enables Play; switching to chart mode leaves the engine's context `'closed'`. Grant autoplay the way the browser project
    already does for audio tests, or start from a click so the gesture rule is met.
- [ ] **Step 2: Run** — `onto do --kind test -- npx vitest run --project=draw apps/chart/src/pipeline/pipelineAudio.test.ts` and `onto do --kind test -- npx vitest run --project=browser apps/chart/src/pipeline/audio.browser.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Rerun both, and `pipeline.browser.test.tsx`** (image runs must not change). Expected: PASS.
- [ ] **Step 5: Run the gate and the branch fleet run** — `onto do --kind test -- npm run test:gate`, then `npm run test:fleet`. Expected: green, with the `fleet-tree: … match <sha>` line.
- [ ] **Step 6: Update `docs/TODO.md`** (retire the live-runner entry, or rewrite it around what's left) and
  the spec's opening line (this piece built), then commit — `git commit -m "play audio pipelines live in weaselchart's pipeline mode"`
