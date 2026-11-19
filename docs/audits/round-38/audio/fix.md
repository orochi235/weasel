Synth voice's duration, envelope, filter, and glide numbers go unchecked, so the worklet mixes NaN into the bus (A+B) — fixed d8162e25c7 (strict call recorded in `docs/unruled.md`: a negative duration or glide time throws too)

A partial's non-finite gain makes every partial NaN (A) — fixed 96f24c347e

An unknown wave name is looked up through the prototype chain and kills the worklet bus processor (A) — fixed dc55ed57fb

An empty harmonic wave throws on nodes but plays silence in the worklet (B) — fixed 48d62977ed (also refuses non-finite levels)

An unknown filter `type` is a lowpass on nodes and an allpass in the kernel (A) — fixed 311af5ec9d (also `createFilterEffect`/`createFilterNode` and `biquadCoefficients`)

The `PeriodicWave` cache has no bound (A+B) — fixed e626e41845 (LRU of 64, keyed by normalized levels); A's half about the kernel's noise-loop map, keyed by any color string, is fixed 68030d1f00 (unknown colors refused, so the map holds at most 3 colors × sample rates)

A negative rate on a worklet noise voice reads before its loop and outputs NaN (A+B) — fixed 0d7773d9c9 (it plays backwards, as on nodes)

`setRate(0)` or a negative rate on a node note throws a TypeError and keeps throwing on every `setDetune` (A+B) — fixed 9469a1d768 (strict call recorded in `docs/unruled.md`: a note's rate must be above 0, on both paths)

A pattern event the engine refuses kills the player while `isPlaying()` stays true (A+B) — fixed c78644b125; the non-finite `step` that A also mentions is fixed 9be3e98b0c

`inserts.settled()` never resolves after a dispose mid-crossfade (A+B) — fixed 0bbb1eeea2

Non-finite `lookahead`, `tickInterval`, or `insertFadeMs` is taken unchecked (A) — fixed 52368cda4e (also `createScheduler` and `createAudioGraph`'s `fadeMs`)

`setMood` with a NaN axis freezes the score on its last bar (A) — fixed 651ee93a18

A score bar entered after a stall plays the previous bar's events on its first booked step (B) — fixed b891d206b0, on top of 861f240543, which adds a public `beforeStep` option to `createPatternPlayer` (minor changeset, `api new`)

Extra defects found while fixing:
- `createOscillatorNode` took unknown wave names, empty harmonic arrays, and partials unchecked — fixed 5823e8e747
- `createNoiseNode` took an unknown color unchecked — fixed 68030d1f00
- An empty `buses` list threw only after the engine had made its `AudioContext` and tick worker — now checked first, in 504ba127eb

Housekeeping commits:
- 6c1a78003c shortens nine changeset titles that `check:changesets` refused for length
- 504ba127eb is a split that `check:size` required: the fixes took `createPatternPlayer` and `createAudioEngine` past the 120-line function cap

Checks:
- vitest, one file at a time with `--maxWorkers=1`, touched files: createAudioEngine.lifecycle 18/18, createAudioEngine.synth 19/19, createAudioEngine.worklet 21/21, graph/createAudioGraph 33/33, graph/sources 22/22, inserts 24/24, patchCheck 10/10, patternPlayer 25/25, periodicWave 2/2, scheduler 33/33, score 9/9, scoreMood 9/9, voiceKernel 23/23 — pass
- vitest, untouched neighbors: voiceKernel.pbt, voiceKernel.shrunk, createAudioEngine.voices.pbt, inserts.pbt, scheduler.pbt, graph/sources.pbt, graph/sources.shrunk, graph/graph.pbt, worklet/voiceMixer.pbt, worklet/voiceMixer, createAudioEngine.noise, createAudioEngine, createAudioEngine.chains, createAudioEngine.booking, createAudioEngine.onDrop, createAudioEngine.stream, effects, graph/processors, biquad.pbt, patternPlayer.pbt, score.pbt, score.shrunk, scoreMood.pbt — pass
- Every new test was run against the code before its fix and failed.
- `npm run check:audio-worklet` — pass ("the generated processor matches its source")
- eslint on every changed `.ts` file — pass
- `npm run check:size` — pass ("no file or function grew past its cap")
- `npm run check:changesets` — pass ("OK — 1747 changeset(s)")
- `npm run typecheck:packages -- audio` — **unrun**. The hook refused it here as a suite-sized script on the controller, and the `onto do --kind typecheck` it pointed to failed: "this machine's own agent is not enrolled with it". The batch run's `gate` project will catch any type error.
- No `*.browser.test.*` file was touched.

The tree is clean.