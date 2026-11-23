- patternVoicePeaks hangs on an infinite span, reads 0 voices on NaN (A) | fixed d78d56963c. My own call, recorded in `docs/unruled.md`: it throws `RangeError` rather than counting the voice as held through every pass.
- node synth voice released before it sounds stays silent, unlike the worklet voice (A) | fixed 98611e5473
- `loadAll` record has a prototype (A) | fixed 74605b61b5
- timer-delay ceiling defined twice (A) | fixed 842f598046
- `checkSteal` carries `checkVoiceLimit`'s doc (A) | fixed d0535d4100
- `checkEventSteps` carries `eventsByStep`'s doc (A) | fixed 89dd00e8cc
- worklet or offline noise renders NaN when its tune overflows (B) | fixed 20998003c5. The kernel now clamps detune and the tune to float32 range, as a node does, and the worklet bundle is regenerated.
- `PatternPlayer.setDetune` and `opts.detune` accept a number that is not finite (B) | fixed 50c6441e5a
- voice stopped before its `when` stays in the scheduler queue (B) | fixed 1527f14c16. `Scheduler.schedule` now returns a cancel for its one event, so the changeset is `minor`, tagged `fix api`.
- [r37-3] `stream()` stops the element's current stream before the new one starts (carried) | not a defect (no longer applies): `restream` stops the earlier stream only from the new starter's started callback.
- [r37-10] non-finite `insertFadeMs` or `fadeMs` throws halfway through a splice (carried) | not a defect (no longer applies): `checkSpan` rejects it when the engine or chain is built, before any splice.

No extra defects found. One thing broke along the way: `createPatternPlayer` reached 124 lines, so `check:size` failed. I trimmed the function and squashed that into 50c6441e5a.

Checks:
- Each touched test file, run alone with `--maxWorkers=1`:
  - patternLoad.test.ts: pass (16)
  - patternPlayer.test.ts: pass (30)
  - soundCache.test.ts: pass (13)
  - voiceKernel.test.ts: pass (26)
  - createAudioEngine.synth.test.ts: pass (22)
  - createAudioEngine.queue.test.ts: pass (4)
- scheduler, createAudioEngine, booking and worklet tests: pass (108)
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run lint -w @weasel-js/audio`: not run, because the package has no `lint` script. eslint on the changed files: pass.

tally: 9 of 11 fixed, 0 extra fixed