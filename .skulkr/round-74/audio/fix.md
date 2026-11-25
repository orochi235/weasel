`afterRamp` canceled while the context was suspended still finished on resume (B): fixed 50e5a6e215

`afterRamp` ended a ramp halfway when the context was `'interrupted'` instead of `'suspended'` (A+B): fixed e212f95860

`setTempo` from a scheduler callback in the same pass as the next step started a second step chain, so every step played twice (B): fixed 84ba5fbb95

A non-looping pattern player's `stop()` did nothing after its last step had passed, leaving its voices sounding (A): fixed 4181fa7dfa

A sound handle from one engine played another engine's sound, because every cache numbered from `snd_1` (A): fixed 96c7b5d0a9

`play(undefined)` left a voice registered that never sounded, held a chain, and never reported `onDrop` (B): fixed a14aa40332

A fractional `voiceLimit` let one voice more than the limit sound (B): fixed e4e9a5c3aa. This was a behavior call: a limit that is not a whole number, `Infinity` included, now throws a `RangeError` rather than being floored. It is recorded in `docs/unruled.md`.

The voice kernel's noise-loop cache grew without bound across sample rates (A+B): fixed 67a7fa1aad. It now keeps the 8 most recently used.

`engine.stream` stopped the earlier stream before the new one had started, so a new one that was dropped left both silent (A): fixed 2d06ab2687. The earlier stream now stops only once the new one has started.

No extra defects found.

Checks:
- Every touched test file, one at a time with `--maxWorkers=1`: pass — audioTime (3), patternPlayer (29), patternPlayer.pbt (3), soundCache (12), createAudioEngine.onDrop (8), voicePool (16), createAudioEngine.context (9), voiceKernel (25), createAudioEngine.stream (18), score (11), createAudioEngine (40), createAudioEngine.worklet (23).
- `npm run checks:gate`: pass ("all 33 passed"). The only edits after that run were changeset wording; `check:changesets`, `check:size` and `check:audio-worklet` pass on the final tree.
- `npm run lint -w @weasel-js/audio`: unrun, because the package has no `lint` script ("Missing script: lint"). `npx eslint packages/audio/src`: pass. The gate's root `npm run lint`: pass.
- No browser test files touched. Tree clean.

tally: 9 of 9 fixed, 0 extra fixed