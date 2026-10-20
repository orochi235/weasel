# Patchable audio graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Unbuilt (2026-10-20).** Wave 1 of the fourth arc. Delete this plan when the branch merges.

**Goal:** Give `@weasel-js/audio` a graph of audio nodes that can be added, removed, connected,
disconnected, replaced and re-parameterized while it plays, without a click, feeding one of the
engine's buses. It also adds a looping file source and an analyser tap on any node.

**Architecture:** `createAudioGraph` keeps a map of node ids to wrappers. Every wrapper owns a
stable `GainNode` per input port and one for its output, so connections and taps attach to the
wrapper and survive a `replace`. Each connection is a fader `GainNode` that ramps in on connect
and out before it is cut, the way `inserts.ts` links do. The built-in node factories (sources,
gain, pan, mix, and adapters over the existing insert effects) return a `GraphNodeDef`, the one
shape the graph accepts. The later live-runner plan turns pipeline diffs into `GraphPatch`es and
calls `apply`.

**Tech Stack:** TypeScript, Web Audio, vitest (`weasel-ui` project with `createFakeAudioContext`;
`browser` project with `OfflineAudioContext` via `renderEngine`).

**Spec:** `docs/superpowers/specs/2026-10-20-chart-fourth-arc-design.md` (row "Patchable audio graph").

## Global Constraints

- The package keeps "No weasel dependencies" (`packages/audio/package.json` description): import nothing from `@weasel-js/*`.
- Every param write goes through `writeParam` (`src/param.ts`); never assign `.value` on a live param.
- Every timed finish goes through `atAudioTime` (`src/audioTime.ts`) with injectable `Timers`, so tests drive it.
- Times are ms everywhere in the public API, as in the rest of the package.
- Default crossfade is the engine's `insertFadeMs` (default 15 ms). When `ctx.state !== 'running'`, every fade is 0 and finishes synchronously (same rule as `inserts.ts` `fade()`).
- Errors are prefixed `@weasel-js/audio: `.
- Source files stay under 400 lines and functions under 120 (`npm run check:size`).
- The changeset is `patch`. Never write a `bump-approved` marker.
- No test, typecheck, lint or build runs on this Mac. Run scoped tests with `onto do --kind test -- …`, and `npm run test:fleet` on the committed branch before merging.
- Browser tests are `*.browser.test.ts` files; they run under `--project=browser`.

## Review Focus

- **Edits while the context is suspended or locked** must apply at once and leave `settled()` resolved, never hang on a timer that waits for a stopped clock. → Task 2, `applies edits at once on a suspended context`.
- **A slider dragged at 60 Hz** (`set` called every frame on one param) must land on the last value with no jump between ramps. → Task 2, `retargets a ramp in flight from where it is`.
- **Removing a node and re-adding the same id inside one fade** must give a fresh node and let the old one finish leaving and be disposed once. → Task 2, `re-adds an id that is still fading out`.
- **A connection that would close a cycle** must throw and leave the graph unchanged, since Web Audio mutes a delay-free cycle. → Task 2, `rejects a connection that closes a cycle`.
- **`replace` on a node that is still crossfading from an earlier `replace`** must keep only the newest def and dispose both older ones. → Task 3, `replaces twice inside one fade`.

---

## File structure

| File | Owns |
|---|---|
| `packages/audio/src/graph/types.ts` | `GraphNodeDef`, `GraphTarget`, `GraphPatch`, `AudioGraph`, `AudioGraphOptions` |
| `packages/audio/src/graph/fader.ts` | `createFader`: one ramped `GainNode` between two nodes, with fade-in, fade-out-then-cut, and cancel |
| `packages/audio/src/graph/createAudioGraph.ts` | node wrappers, connections, cycle check, `set`, `remove`, `apply`, `settled`, `dispose` |
| `packages/audio/src/graph/replace.ts` | `replace`: crossfade one def into another inside a wrapper |
| `packages/audio/src/graph/sources.ts` | `createFileSourceNode`, `createOscillatorNode`, `createNoiseNode` |
| `packages/audio/src/graph/processors.ts` | `createGainNode`, `createPanNode`, `createMixNode`, `insertNode` and the four effect adapters |
| `packages/audio/src/impulse.ts` | `impulseResponse`: a generated decaying-noise impulse for reverb |
| `packages/audio/src/analyser.ts` | widen `createAnalyserTap`'s `ctx` to `BaseAudioContext` |
| `packages/audio/src/createAudioEngine.ts` | `engine.graph(bus?)` |
| `packages/audio/src/synthVoice.ts` | none; `noiseBuffer` is imported as is |
| `packages/audio/src/index.ts` | exports |

Tests sit beside each file: `graph/createAudioGraph.test.ts`, `graph/replace.test.ts`,
`graph/sources.test.ts`, `graph/processors.test.ts`, `graph/graph.browser.test.ts`, plus a case
in `createAudioEngine.test.ts`.

## Interfaces (the contract the live-runner plan consumes)

These are pinned. The runner plan is written against exactly these names.

```ts
// graph/types.ts
/** What a node factory returns and the graph wraps. `inputs` is empty for a source. */
export interface GraphNodeDef {
  readonly inputs: Readonly<Record<string, AudioNode>>;
  readonly output: AudioNode;
  /** Continuous params. `rampMs` is always passed; the graph supplies its fade when the caller gives none. */
  readonly params: Readonly<Record<string, (value: number, rampMs: number) => void>>;
  /** Sources only. `when` is context seconds. Called when the graph starts, or on add/replace
   *  while it runs. A source must be startable again after `stop`. */
  start?(when: number): void;
  /** Sources only. Stop at `when` (context seconds). */
  stop?(when: number): void;
  /** Called once, after the node has faded out of the graph. */
  dispose?(): void;
}

/** A connection's far end: a node's named input port, or the graph's output. */
export type GraphTarget = { node: string; port: string } | { output: true };

export type GraphPatch =
  | { kind: 'add'; id: string; def: GraphNodeDef }
  | { kind: 'remove'; id: string }
  | { kind: 'replace'; id: string; def: GraphNodeDef }
  | { kind: 'connect'; from: string; to: GraphTarget }
  | { kind: 'disconnect'; from: string; to: GraphTarget }
  | { kind: 'set'; id: string; param: string; value: number; rampMs?: number };

export interface AudioGraphOptions extends Partial<Timers> {
  /** Crossfade for every structural edit, and the default ramp for `set`, in ms. Default 15. */
  fadeMs?: number;
}

export interface AudioGraph {
  add(id: string, def: GraphNodeDef): void;           // throws on a live duplicate id
  remove(id: string): void;                           // no-op on an unknown id
  replace(id: string, def: GraphNodeDef): void;       // keeps connections and taps; throws on unknown id
  connect(from: string, to: GraphTarget): void;       // idempotent; throws on unknown id/port or a cycle
  disconnect(from: string, to: GraphTarget): void;    // no-op when not connected
  set(id: string, param: string, value: number, rampMs?: number): void; // throws on unknown id/param
  /** Applies in order; each patch calls the method of the same name. */
  apply(patches: readonly GraphPatch[]): void;
  /** Start every source now, and every source added later, until `stop`. */
  start(): void;
  /** Fade the graph's output to silence over `fadeMs`, then stop every source. */
  stop(): void;
  playing(): boolean;
  has(id: string): boolean;
  ids(): string[];
  /** Listens to a node's output; survives `replace`; disposed with the node. */
  tap(id: string, opts?: AnalyserTapOptions): AnalyserTap;
  /** Resolves once no fade is in flight. */
  settled(): Promise<void>;
  /** Cancels fades, stops sources, disposes every def and tap, disconnects from the destination. */
  dispose(): void;
}

export function createAudioGraph(
  ctx: BaseAudioContext, destination: AudioNode, opts?: AudioGraphOptions,
): AudioGraph;

// AudioEngine (createAudioEngine.ts)
/** A graph feeding `bus`'s input (default: the first bus). Disposed with the engine. */
graph(bus?: string): AudioGraph;
```

Node factories (all take `ctx: BaseAudioContext` first; every name below is a `params` key):

| Factory | Options | Ports | Params |
|---|---|---|---|
| `createFileSourceNode(ctx, { buffer: AudioBuffer; loop?: boolean })` | `loop` default `true` | none | `rate`, `level` |
| `createOscillatorNode(ctx, { wave?: OscillatorWave; frequency?: number })` | defaults `'sine'`, 440; `OscillatorWave = Exclude<Waveform, Inharmonic>` | none | `frequency`, `detune`, `level` |
| `createNoiseNode(ctx, { color: NoiseColor })` | | none | `level` |
| `createGainNode(ctx, { gain?: number })` | default 1 | `in` | `gain` |
| `createPanNode(ctx, { pan?: number })` | default 0 | `in` | `pan` |
| `createMixNode(ctx, { inputs: readonly string[] })` | ≥1 port name | each name | each name (that input's level, default 1) |
| `filterNode(ctx, FilterEffectOptions)` | as `createFilterEffect` | `in` | `frequency`, `Q`, `gain` |
| `delayNode(ctx, DelayEffectOptions)` | as `createDelayEffect` | `in` | `time`, `feedback`, `mix` |
| `reverbNode(ctx, ReverbNodeOptions)` | `Omit<ReverbEffectOptions, 'impulse'> & { impulse?: AudioBuffer; seconds?: number }`; with no `impulse`, it uses `impulseResponse(ctx, seconds ?? 2)` | `in` | `mix` |
| `compressorNode(ctx, CompressorEffectOptions)` | as `createCompressorEffect` | `in` | `threshold`, `knee`, `ratio`, `attack`, `release`, `makeup` |

Discrete settings (oscillator `wave`, noise `color`, filter `type`, a file's `buffer`, reverb `seconds`) are not
params: the runner changes them with `replace`, which crossfades.

---

### Task 1: A fader and the graph's types

**Files:**
- Create: `packages/audio/src/graph/types.ts`, `packages/audio/src/graph/fader.ts`
- Test: `packages/audio/src/graph/fader.test.ts`

**Interfaces:**
- Consumes: `writeParam` (`src/param.ts`), `atAudioTime`, `Timers`, `defaultTimers` (`src/audioTime.ts`).
- Produces: the types above, and
  ```ts
  export interface Fader {
    readonly gain: GainNode;
    /** Ramp to 1 over `ms`. */
    open(ms: number): void;
    /** Ramp to 0 over `ms`, then disconnect both ends and call `done`. Idempotent. */
    close(ms: number, done?: () => void): void;
    /** Disconnect now, canceling any pending close. */
    cut(): void;
  }
  export function createFader(ctx: BaseAudioContext, timers: Timers, from: AudioNode, to: AudioNode): Fader;
  ```
  A new fader starts at gain 0, already connected `from → gain → to`.

- [ ] **Step 1: Write the failing tests** in `fader.test.ts`, using `createFakeAudioContext` with `state = 'running'` and the timer-map harness from `inserts.test.ts`:
  - `starts silent and wired through` — `gain.gain.value === 0`; `from.connectedTo` contains the gain; the gain's `connectedTo` contains `to`.
  - `opens with a ramp anchored at its current value` — after `open(20)`, the gain param's recorded events end with `setValueAtTime(0, t)` then `linearRampToValueAtTime(1, t + 0.02)`.
  - `closes, then cuts and reports done` — `close(20, done)`; before `_advance(20)` and running timers, `done` is not called and the gain is still connected; after it, `done` was called once and `from.connectedTo` no longer contains the gain.
  - `cut cancels a pending close` — `close(20, done)`, `cut()`, run timers: `done` is never called, and the gain is disconnected.

- [ ] **Step 2: Run them to see them fail**
  Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/audio/src/graph/fader.test.ts`
  Expected: FAIL, cannot resolve `./fader`.

- [ ] **Step 3: Write `types.ts` exactly as in Interfaces, and `createFader` in `fader.ts`.** Connect with `from.connect(gain)` and disconnect with `from.disconnect(gain)`, so a consumer's other edges from `from` survive. A `close` with `ms === 0` finishes synchronously.

- [ ] **Step 4: Run them to see them pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/audio/src/graph/types.ts packages/audio/src/graph/fader.ts packages/audio/src/graph/fader.test.ts
  git commit -m "add a ramped fader for audio graph connections"
  ```

### Task 2: `createAudioGraph`: nodes, connections and params

**Files:**
- Create: `packages/audio/src/graph/createAudioGraph.ts`
- Test: `packages/audio/src/graph/createAudioGraph.test.ts`

**Interfaces:**
- Consumes: Task 1's `createFader`, the types; `createAnalyserTap` (after Step 3 widens it).
- Produces: `createAudioGraph` and `AudioGraph` as pinned above. `replace` throws `not yet` here and is filled in by Task 3.

Each wrapper holds `def`, `ins: Record<port, GainNode>` (each wired to `def.inputs[port]`),
`out: GainNode` (fed by `def.output`), and its faders keyed by target. The graph's own output is
a `GainNode` wired to `destination`; `stop()` ramps it to 0.

- [ ] **Step 1: Write the failing tests** with a test-local `testNode(ctx, ports = ['in'])` that returns a `GraphNodeDef` over fake gains, with a `level` param that records its calls and a `dispose` spy:
  - `wires a node to the output through a fader that opens` — `add('a', src)`, `connect('a', { output: true })`; `allPaths(aOutput, destination)` has length 1; the fader's gain ends ramping to 1.
  - `connects to a named port` — `connect('a', { node: 'b', port: 'in' })` reaches `b`'s `def.inputs.in`.
  - `throws on an unknown node, port or param` — `connect('x', …)`, `connect('a', { node: 'b', port: 'nope' })`, `set('a', 'nope', 1)` each throw a message naming the id, port or param.
  - `throws on a duplicate live id` — second `add('a', …)` throws.
  - `connect is idempotent` — connecting twice leaves exactly one path.
  - `disconnects with a fade, then cuts` — after `disconnect`, the path still exists until the fade's timers run; then `allPaths` is empty. `disconnect` of an absent edge does nothing.
  - `rejects a connection that closes a cycle` — `a → b`, then `connect('b', { node: 'a', port: 'in' })` throws `/cycle/`; `reachesCycle(aIn)` is false and the edge count is unchanged.
  - `removes a node by fading its edges, then disposes it once` — `remove('a')`: `has('a')` is false at once; its paths remain until the fade completes; then `dispose` was called once and every edge to and from it is cut.
  - `re-adds an id that is still fading out` — `remove('a')`, `add('a', fresh)` inside the fade; after settling the old def's `dispose` ran once, the fresh def is wired, and `ids()` is `['a']`.
  - `set passes the graph's fade when no ramp is given` — `set('a', 'level', 0.5)` calls the recorder with `(0.5, FADE)`; `set('a', 'level', 0.5, 0)` with `(0.5, 0)`.
  - `retargets a ramp in flight from where it is` — on a `createGainNode` param: `set(…, 0.2)`, `_advance(5)`, `set(…, 0.8)`; the second write's events start with `setValueAtTime(<value at 5 ms>, now)`.
  - `applies edits at once on a suspended context` — `state = 'suspended'`; `connect`, `disconnect`, `remove`; `settled()` resolves with no timers run, and the removed def is disposed.
  - `apply runs patches in order through the same methods` — one `apply` with add, add, connect, set, remove gives the same edges and spy calls as the method calls.
  - `starts sources on start and on add while playing; stop fades out then stops them` — a source def with `start`/`stop` spies: `start()` calls `start(ctx.currentTime)`; an `add` afterward calls it too; `stop()` ramps the output gain to 0 and, after the fade, calls `stop` on every source; `playing()` follows.
  - `taps a node's output and disposes the tap with the node` — `tap('a')` returns an `AnalyserTap` whose node is connected from `a`'s wrapper `out`; after `remove('a')` settles it is detached.
  - `dispose cancels fades and tears everything down` — with a close pending, `dispose()`: no timer remains, every def's `dispose` ran, the output gain is disconnected from `destination`.

- [ ] **Step 2: Run them to see them fail**
  Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/audio/src/graph/createAudioGraph.test.ts`
  Expected: FAIL, cannot resolve `./createAudioGraph`.

- [ ] **Step 3: Widen `createAnalyserTap(ctx: BaseAudioContext, …)`** in `src/analyser.ts`; nothing else in that file changes.

- [ ] **Step 4: Implement `createAudioGraph`.** The cycle check walks the graph's own edge set (not the Web Audio graph) from `to.node` looking for `from`. A removed wrapper leaves the id map at once and is tracked in a `leaving` set until its faders close, so `has`, `ids` and a re-`add` see only live nodes. `settled()` resolves when no fader has a close pending and no output fade is in flight.

- [ ] **Step 5: Run them to see them pass** (same command). Expected: PASS.

- [ ] **Step 6: Commit**
  ```bash
  git add packages/audio/src/graph/createAudioGraph.ts packages/audio/src/graph/createAudioGraph.test.ts packages/audio/src/analyser.ts
  git commit -m "add a patchable audio graph with faded connections and taps"
  ```

### Task 3: `replace` crossfades one def into another

**Files:**
- Create: `packages/audio/src/graph/replace.ts`
- Modify: `packages/audio/src/graph/createAudioGraph.ts` (call it from `replace`)
- Test: `packages/audio/src/graph/replace.test.ts`

**Interfaces:**
- Consumes: the wrapper shape from Task 2, `createFader`.
- Produces: `export function replaceDef(ctx: BaseAudioContext, timers: Timers, w: NodeWrapper, next: GraphNodeDef, ms: number, playing: boolean): void`. Export `NodeWrapper` from `createAudioGraph.ts` as an internal type; not in `index.ts`.

The wrapper's stable `ins` and `out` stay. The old def's output feeds `out` through a fader that
closes; the new def's output feeds `out` through one that opens; each `ins[port]` feeds both defs
until the old one's fader closes. A port the new def lacks has its incoming edges closed. A port
it adds starts unconnected.

- [ ] **Step 1: Write the failing tests:**
  - `keeps connections and taps across a replace` — `a → b → output`, `tap('b')`, `replace('b', next)`: after settling, `allPaths(aOut, destination)` passes through `next`'s nodes and not the old ones, and the tap's analyser is still connected from `b`'s `out`.
  - `crossfades rather than switches` — immediately after `replace`, both defs' outputs reach `out`, the old fader ramping to 0 and the new ramping to 1.
  - `disposes the old def once, after the fade` — `dispose` is not called before the timers run, and is called once after.
  - `replaces twice inside one fade` — `replace(b, d2)`, `replace(b, d3)` before timers: after settling only `d3` is wired, and `d1` and `d2` were each disposed once.
  - `starts a replacement source when the graph is playing` — with `start()` called, `replace('src', nextSource)` calls `nextSource.start` and, after the fade, `old.stop`.
  - `closes edges into a port the new def lacks` — `a → b.side`, `replace('b', defWithoutSide)`: after settling `a` reaches nothing through `b`, and `connect('a', { node: 'b', port: 'side' })` now throws.

- [ ] **Step 2: Run them to see them fail**
  Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/audio/src/graph/replace.test.ts`
  Expected: FAIL, `replace` throws `not yet`.

- [ ] **Step 3: Implement `replaceDef` and call it from `AudioGraph.replace`.**

- [ ] **Step 4: Run them to see them pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/audio/src/graph/replace.ts packages/audio/src/graph/replace.test.ts packages/audio/src/graph/createAudioGraph.ts
  git commit -m "crossfade a graph node into its replacement, keeping its connections"
  ```

### Task 4: Source nodes: a looping file, an oscillator, noise

**Files:**
- Create: `packages/audio/src/graph/sources.ts`, `packages/audio/src/periodicWave.ts`
- Modify: `packages/audio/src/synthStarters.ts` (use `periodicWave`)
- Test: `packages/audio/src/graph/sources.test.ts`

**Interfaces:**
- Consumes: `GraphNodeDef`; `writeParam`; `noiseBuffer` (`src/synthVoice.ts`); `Waveform`, `NoiseColor` (`src/types.ts`). The `PeriodicWave` built for a partials array is made inside `createSynthStarters` (`src/synthStarters.ts`, its `waves` cache). Move that into `src/periodicWave.ts` as `periodicWave(ctx: BaseAudioContext, partials: readonly number[]): PeriodicWave`, cached per context, and have both callers use it.
- Produces: `createFileSourceNode`, `createOscillatorNode`, `createNoiseNode`, and the type `OscillatorWave`, with the options, ports and params in the factory table. Each output is a stable `GainNode` (the `level` param); the inner `AudioBufferSourceNode` or `OscillatorNode` is made fresh on each `start`, because those nodes are single-use.

- [ ] **Step 1: Write the failing tests** against the fake context:
  - `a file source loops by default and restarts on each start` — `start(0)`, `stop(1)`, `start(2)`: two distinct buffer sources were created; each has `loop === true` and the given buffer; both connect to the output gain.
  - `a file source resumes where it stopped` — buffer of 2 s; `start(0)`, advance the clock 0.5 s, `stop(ctx.currentTime)`, `start(…)`: the second source's `start` was called with offset 0.5 (modulo the buffer's duration × `rate`).
  - `rate retunes the playing source` — `params.rate(1.5, 0)` writes `playbackRate` on the live source, and a later `start` uses 1.5.
  - `an oscillator takes its wave and frequency` — `createOscillatorNode(ctx, { wave: 'square', frequency: 220 })`; after `start`, `type === 'square'` and `frequency` is 220; `params.frequency(330, 10)` ramps it.
  - `a partials wave uses the shared periodic wave` — `createOscillatorNode(ctx, { wave: [1, 0.5] })` twice on one context: both oscillators got the same `PeriodicWave`, the one `periodicWave(ctx, [1, 0.5])` returns. The existing `createAudioEngine.synth.test.ts` still passes unchanged.
  - `noise loops the shared buffer for its color` — the source's buffer is `noiseBuffer(ctx, 'pink')`.
  - `level writes the output gain` — `params.level(0.25, 0)` sets the output gain to 0.25.
  - `stop before start is a no-op` — no throw.

- [ ] **Step 2: Run them to see them fail**
  Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/audio/src/graph/sources.test.ts packages/audio/src/createAudioEngine.synth.test.ts`
  Expected: FAIL, cannot resolve `./sources`.

- [ ] **Step 3: Implement the three factories.** The file source records the context time and offset at `start`, and computes the resume offset at `stop` as `(offset + (when - startedAt) * rate) % buffer.duration`.

- [ ] **Step 4: Run them to see them pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/audio/src/graph/sources.ts packages/audio/src/graph/sources.test.ts packages/audio/src/periodicWave.ts packages/audio/src/synthStarters.ts
  git commit -m "add file, oscillator and noise source nodes for the audio graph"
  ```

### Task 5: Processing nodes: gain, pan, mix and the effect adapters

**Files:**
- Create: `packages/audio/src/graph/processors.ts`, `packages/audio/src/impulse.ts`
- Test: `packages/audio/src/graph/processors.test.ts`, `packages/audio/src/impulse.test.ts`

**Interfaces:**
- Consumes: `GraphNodeDef`; `createFilterEffect`, `createDelayEffect`, `createReverbEffect`, `createCompressorEffect` and their option types (`src/effects.ts`).
- Produces: `createGainNode`, `createPanNode`, `createMixNode`, `filterNode`, `delayNode`, `reverbNode` (with `ReverbNodeOptions`), `compressorNode`;
  ```ts
  // impulse.ts — exported from index.ts; the live-runner plan builds its reverb impulses with this.
  export interface ImpulseResponseOptions {
    /** How far the tail falls by its end, dB. Default 60 (an RT60). */
    decayDb?: number;
    /** Default 2. */
    channels?: number;
    /** Seed for the noise, so the same call makes the same buffer. Default 1. */
    seed?: number;
  }
  /** Noise under an exponential decay that falls `decayDb` over `seconds`. */
  export function impulseResponse(ctx: BaseAudioContext, seconds: number, opts?: ImpulseResponseOptions): AudioBuffer;
  ```
  and
  `export function insertNode(effect: InsertEffect, params: GraphNodeDef['params']): GraphNodeDef` — port `in`, output `effect.output`, `dispose` forwarded. The four adapters are `insertNode` calls.

- [ ] **Step 1: Write the failing tests:**
  - `gain and pan expose their one param` — `createGainNode(ctx, { gain: 0.5 })` starts at 0.5, and `params.gain(1, 10)` ramps it; `createPanNode` does the same for `pan`.
  - `mix has one port and one level per input` — `createMixNode(ctx, { inputs: ['a', 'b'] })`: `Object.keys(inputs)` is `['a', 'b']`; `params.b(0.3, 0)` writes only `b`'s gain; both reach `output`. `inputs: []` throws.
  - `the effect adapters map params onto the effect` — `delayNode(ctx, {})`: `params.time(500, 0)` writes `delayTime` 0.5, `params.feedback(0.5, 0)` the loop gain, `params.mix(1, 0)` wet 1 and dry 0; `params.feedback(1, 0)` throws a RangeError (the effect's own check). `filterNode` maps `frequency`, `Q`, `gain`; `compressorNode` maps `attack` and `release` from ms to seconds.
  - In `impulse.test.ts`: `impulseResponse makes a decaying noise tail` — `impulseResponse(ctx, 1.5)` on the fake context has length `round(1.5 * sampleRate)` and 2 channels; the RMS of the last 10% is at least 50 dB below the first 10% (default `decayDb: 60`); each channel's samples differ from the other's; two calls with the same `seed` return equal data, and different seeds don't. `seconds <= 0` throws a RangeError. The fake's `createBuffer` already returns real `getChannelData` arrays.
  - `reverbNode builds its impulse from seconds` — `reverbNode(ctx, { seconds: 1 })`: the convolver's buffer has duration 1; with neither `impulse` nor `seconds`, duration 2; a given `impulse` is used as is.
  - `insertNode forwards dispose` — a delay node's `dispose` disconnects its feedback loop.

- [ ] **Step 2: Run them to see them fail**
  Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/audio/src/graph/processors.test.ts packages/audio/src/impulse.test.ts`
  Expected: FAIL, cannot resolve `./processors`.

- [ ] **Step 3: Implement.** Where an effect has no setter for a param (filter `frequency`, compressor fields), write the exposed node's `AudioParam` through `writeParam`.

- [ ] **Step 4: Run them to see them pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add packages/audio/src/graph/processors.ts packages/audio/src/graph/processors.test.ts packages/audio/src/impulse.ts packages/audio/src/impulse.test.ts
  git commit -m "add gain, pan, mix and effect nodes for the audio graph"
  ```

### Task 6: `engine.graph`, exports, a real render, and the changeset

**Files:**
- Modify: `packages/audio/src/createAudioEngine.ts`, `packages/audio/src/index.ts`, `packages/audio/README.md` (a short "Patchable graph" section, if the README documents the engine's surface)
- Create: `packages/audio/src/graph/graph.browser.test.ts`, `.changeset/audio-patchable-graph.md`
- Test: `packages/audio/src/createAudioEngine.test.ts` (one case)

**Interfaces:**
- Consumes: everything above; `graph.input(bus)` from the engine's `BusGraph`.
- Produces: `AudioEngine.graph(bus?: string): AudioGraph`. `index.ts` exports `createAudioGraph`, every factory in the table, `insertNode`, `impulseResponse`, and the types `ImpulseResponseOptions`, `ReverbNodeOptions`, `AudioGraph`, `AudioGraphOptions`, `GraphNodeDef`, `GraphPatch`, `GraphTarget`, `OscillatorWave`.

- [ ] **Step 1: Write the failing tests**
  - In `createAudioEngine.test.ts`: `graph() feeds the first bus and is disposed with the engine` — `engine.graph()` with a source connected to `{ output: true }` reaches `engine.bus('sfx')`'s input, which `allPaths` can show; `engine.graph('nope')` throws `unknown bus`; after `engine.dispose()` the source def's `dispose` ran.
  - In `graph.browser.test.ts`, rendering through `renderEngineStereo` with its `later` hook (`ctx.suspend(at)`):
    - `sounds: an oscillator through a gain reaches the bus` — a 440 Hz oscillator → gain 0.5 → output, `start()`: `rms` over 0.1–0.4 s is within 10% of `0.5 · CENTER_GAIN · SQRT1_2` (verify the bus's pan law against `renderEngine`'s other tests before fixing the number).
    - `patching a running graph doesn't reset a delay's tail` — a 20 ms noise burst at t=0 → `delayNode({ time: 100, feedback: 0.5, mix: 1 })` → output. Render once untouched; render again with `later = { at: 0.15, run: (e) => graph.apply([add a gain node 'x', connect source → x, set delay mix 1]) }`. The repeat windows at 200 ms and 300 ms differ in `rms` by less than 1% between the two renders.
    - `removing a node fades rather than cuts` — an oscillator → output; `later.at = 0.2` removes it: no sample-to-sample step over the 15 ms after 0.2 s exceeds the largest step in 0.1–0.2 s by more than 10%, and the output is silent by 0.25 s.
    - `replace crossfades a wave change` — a sine replaced by a square at 0.2 s: the same step bound holds across the boundary.

- [ ] **Step 2: Run them to see them fail**
  Run: `onto do --kind test -- npx vitest run --project=weasel-ui packages/audio/src/createAudioEngine.test.ts`
  Run: `onto do --kind test -- npx vitest run --project=browser packages/audio/src/graph/graph.browser.test.ts`
  Expected: FAIL, `engine.graph` is not a function.

- [ ] **Step 3: Add `graph(bus?)` to `AudioEngine`.** It calls `createAudioGraph(ctx, graph.input(bus ?? busNames[0]), { ...timers, fadeMs: opts.insertFadeMs })` and keeps the result in a set, so that `dispose()` disposes every graph before `graph.dispose()`. Add the exports. If the README lists the engine's methods, document `graph` there in two or three lines.

- [ ] **Step 4: Write `.changeset/audio-patchable-graph.md`**
  ```md
  ---
  '@weasel-js/audio': patch
  ---

  Add a patchable audio graph: `engine.graph(bus)` returns nodes that can be added, removed, replaced, connected and re-parameterized while it plays, every edit crossfaded. New source nodes play a looping file, an oscillator or noise; gain, pan, mix, filter, delay, reverb and compressor nodes process. `impulseResponse(ctx, seconds)` generates a decaying-noise impulse, which a reverb node uses when it is given `seconds` rather than an `impulse`. `tap(id)` puts an analyser on any node. `createAnalyserTap` now accepts any `BaseAudioContext`.
  ```

- [ ] **Step 5: Run them to see them pass** (both commands above). Expected: PASS.

- [ ] **Step 6: Commit, then run the fleet on the branch**
  ```bash
  git add packages/audio .changeset/audio-patchable-graph.md
  git commit -m "add engine.graph and export the patchable audio graph"
  npm run test:fleet
  ```
  Expected: the run's log has `fleet-tree: N changed path(s) match <sha>`, the gate passes (typecheck, lint, `check:size`, `check:bumps`, `check:imports`), and no project fails. A failure in a file this branch doesn't reach is load, not a regression; say so and don't re-run.

---

## Self-review notes

- Spec coverage: add/remove nodes, connect/disconnect, live params with crossfades (Tasks 2 and 3);
  the graph feeds a bus (Task 6); a looping file source (Task 4); an analyser tap on any node (Task
  2, surviving `replace` in Task 3); the spec's OfflineAudioContext delay-tail test (Task 6). The
  stage types the runner needs (file, oscillator, noise, gain, pan, filter, delay, reverb,
  compressor, mix, output) each have a factory, and `output` is `{ output: true }`.
- Not here, by the spec: the runner, the stage palette, and Play and Pause, which are the live
  runner plan's job. It maps Play to `start()` and Pause to `stop()`; the file source resumes where
  it stopped, oscillators and noise restart.
