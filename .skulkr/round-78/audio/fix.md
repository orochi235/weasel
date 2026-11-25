- A voice's chain gain isn't seeded on `.value`, so a fade-in right after `play` starts from 1 or a stale level (A): fixed 670b8c74e3
- `writeParam` anchors a ramp at a `.value` that lags a step written earlier in the same task (A): fixed 670b8c74e3. This is the same root cause as the line above: a step now sets `.value` as well.
- The worklet voice's `onended`/`onDone` fires synchronously inside `engine.dispose()`, so an `onDone` that throws cuts it short (A): fixed 2c044f6c0d
- A late node synth voice skips its attack and loses part of its gate (A): fixed 8ffcbee4dd. This was a behavior call, recorded in `docs/unruled.md`.
- A bus `setGain(v)` step is skipped while a ramp to `v` is in flight (A+B): fixed 1288fd0847
- `AnalyserTap.dispose()` throws when the tapped node was disconnected first (A): fixed 28372c0388
- Linear rolloff reaches 0 at `maxDistance` only when `rolloffFactor` is 1, and keeps falling past it (A+B): fixed 4e3720c955. It now holds 1 − `rolloffFactor` beyond `maxDistance`, as a `PannerNode` does. This was a behavior call, recorded in `docs/unruled.md`.
- `scoreBar`'s `gain` is documented as "at most", but releases ringing over from earlier steps take the sum past it (A): fixed 15cff84a3f. This is a doc fix, so there is no test and no changeset.
- `engine.analyser('')` taps the master instead of the bus named '' (A): fixed d4509159ad
- `patternVoicePeaks` returns a table with `Object.prototype`, so an unused bus can read as a prototype member (A): fixed 192a72b53b
- A mute or solo during a bus ramp snaps the bus to the ramp's end (B): fixed 1288fd0847. This shares the commit with the step fix above, because both are the same `apply` rewrite. It now resumes to the ramp's original end, as a voice does. This was a behavior call, recorded in `docs/unruled.md`.
- A score's chord progression restarts on every cue change (B): fixed 55b8816d3f. `scoreBar` gains an optional `built` argument, so its changeset is `minor`.
- The exported `patternLength` accepts any `stepsPerBeat` and returns NaN or a fractional length (B): fixed d76aef3415
- An unknown `steal` policy (and listener `rolloff`) is silently run as the default (B): fixed da86e5ec44. Both now throw `RangeError`, with no override. This was a strict call, recorded in `docs/unruled.md`.
- A non-finite effect option throws the browser's TypeError before the package's RangeError (B): fixed 670b8c74e3. `initParam` now goes through `writeParam`'s check first. The test showing it, which fails before 670b8c74e3, is d1e9812e1f.
- [r37-3] `stream()` stops the element's current stream before the new one is known to start (carried): not a defect (no longer applies). `restream` stops the earlier voice only from the new voice's start callback.
- [r37-10] A non-finite `insertFadeMs`/`fadeMs` throws halfway through a splice (carried): not a defect (no longer applies). `checkSpan` refuses it when `createInsertChain` and `createAudioEngine` are constructed.

Extra (sweep), not counted in the tally:
- The redundant bare `.value` seeding in `insertRoute.link` and `buildSlot` was removed in 670b8c74e3, now that `writeParam` sets `.value` itself.
- This round's changeset titles were cut under 140 characters in a separate follow-up commit.

Checks:
- Every touched test file, run one at a time with `--maxWorkers=1`: pass. They are analyser, buses, buses.pbt, createAudioEngine.finite, createAudioEngine.synth, createAudioEngine, createAudioEngine.worklet, param, patternLoad, score and spatialize. Before committing I also ran all 101 test files under `packages/audio/src`, related audio test files, and `apps/site/demos/__tests__/platformerBed.test.ts`: pass.
- No `*.browser.test.*` file was touched.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run check:changesets`: pass ("OK — 911 changeset(s)"; none of this round's audio changesets is among the 31 with warnings).
- `npm run typecheck:packages -- audio`: pass ("1/1 audio ok").
- `npm run check:size`: pass.
- `npm run lint -w @weasel-js/audio`: not run, because the package has no `lint` script. Instead, eslint on the changed audio files: pass, and the gate's root `npm run lint`: pass.
- The tree is clean apart from `.skulkr/`.

tally: 17 of 19 fixed, 0 extra fixed