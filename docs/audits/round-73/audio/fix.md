Engine refuses empty `buses` or bad `voiceLimit` only after making its own AudioContext (A): fixed 53147fdc87

Same context leak (B): duplicate of A's context-leak finding, fixed by 53147fdc87

`stopAll`/`dispose` skip `catchUp`, so a stalled worklet voice is reported dropped (A): fixed b8a1ad1e65

`dispose` never fires `onDone` for a started worklet voice (A): fixed fef2b215f2

`setPan` keeps the old position's distance gain (A): fixed 9215a24647 (the worklet test's expectation for this change was updated in 86bf3935bf)

Duplicate bus names leave an unreachable fader wired to master (A): fixed 6a5d6b6b2a. This was a strict call: a repeated name now throws. It is recorded in `docs/unruled.md`.

One effect can go into two buses' insert chains (A): fixed a693785137

`patternVoicePeaks` returns `{}` for a non-finite step where the player throws (A): fixed df0a0b0541. `patternLength`, which is public, had the same hole and is fixed too.

Score names the wrong bar when a stall skips all of bar 0 (A): fixed 14620b1527

Kernel voices accept a NaN or Infinity `gain` (A): fixed 625e2aef8d. The worklet bundle was regenerated.

`createTickTimer` passes `Infinity` or delays past 2^31 − 1 ms straight to `setTimeout` (A): fixed aa2498d0a5. Both the fallback and the worker were affected. The reviewer also named `defaultTimers`, but that one is not a defect: it is internal, and every delay that reaches it is already capped (`atAudioTime`) or checked (the scheduler interval).

`stream(url)` starts fetching before the play is checked (A): fixed 917b58b966

Insert crossfade cut short by a suspension clicks on resume (B): fixed f9ca18bf53. This was a strict call: the fade now waits for the resume, so `inserts.settled()` stays pending through a suspension. It is recorded in `docs/unruled.md`.

Pattern player reports `isPlaying()` true forever on a disposed engine (B): fixed f1c8692739. This adds new API, `engine.disposed()`, with a `minor` changeset. It was also a strict call: `start()` on a disposed engine stays stopped rather than throwing. It is recorded in `docs/unruled.md`.

[r37-3] `stream()` stops the element's current stream before the new one is known to start (carried): not a defect (no longer applies). `restream` launches the new voice first and stops the earlier one only once the new one is playing.

[r37-10] A non-finite `insertFadeMs`/`fadeMs` throws halfway through a splice (carried): not a defect (no longer applies). `createInsertChain` and `createAudioEngine` both run `checkSpan` on the fade at construction, and `add` takes no fade of its own.

Extra defects:

The audio graph's fader close and transport output fade had the same suspension cut as the insert crossfade (sweep): fixed e0bbce361d. The fix is a shared `afterRamp` in `audioTime.ts`.

`check:timers` failed on a stale allowlist entry for `packages/labkit/src/trial/watch3d.ts`, which now waits through `after` (sweep): fixed 6f41baa603

Housekeeping commits: d28c2fa5cc shortens 13 audio changeset titles to under 140 characters. 86bf3935bf puts the JSDoc back on `createBusGraph` and `createVoicePool` (my edits had pushed it off), updates the worklet test for `setPan`, and fixes a type error in the new kernel test.

Checks:
- `npx vitest run --maxWorkers=1 packages/audio`: all 99 test files pass (778 tests), including every file I touched. These unrun browser tests sit near the change: `inserts.browser.test.ts`, `graph/graph.browser.test.ts`, `voiceKernel.browser.test.ts` and `endedBeforeStart.browser.test.ts`.
- `npm run checks:gate`: the first run failed 3 of 33 checks (typecheck, `audit:jsdoc`, `typecheck:packages`). After 86bf3935bf the rerun printed "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/audio`: fails with `Missing script: "lint"`, because the package has no lint script. eslint on every changed file passes (exit 0).
- `npm run check:changesets`: OK (673 changesets).
- `npm run check:audio-worklet`: OK.
- `npm run check:timers`: 0 computed timer delays.

The tree is clean.

tally: 15 of 16 fixed, 2 extra fixed