Synth patch numbers go unchecked at the call: NaN envelope, duration, glide, filter or partial gain, a negative duration, a partial decay of Infinity (A+B): fixed daa0e33b97

Empty or NaN harmonic `wave` (A+B): fixed 0c6fb394d9

Voice rate of 0 or below: a node note throws a TypeError, a worklet noise mixes NaN into its bus (A+B): fixed 2d656dad35. This needed a behavior call nobody had made. My call is strict: a rate of 0 or below now throws `RangeError` on every voice kind, buffers and streams included, with no opt-in override. It is recorded in `docs/unruled.md`, and the changeset is tagged `fix behavior`.

`stream()` stops the playing stream before the bus, lock and dispose checks (A+B): fixed 18d4ccdff1

`StreamOptions.offset` is not checked (A): fixed 6e5454887d

The media-element source cache is per engine, so a second engine on the same context cannot stream the element (B): fixed 57687658c4. Which voice holds an element moved to the context too.

A NaN score mood throws a TypeError, and a running score freezes on its last bar (A+B): fixed 021e5ea217

`lookahead`, `tickInterval` and `insertFadeMs` are not validated, and a NaN fade half-wires an insert chain (A+B): fixed dd462c56fc. The same check is also added to `createScheduler`, `createInsertChain` and `createAudioGraph`.

`stop(fadeMs)` on a releasing voice cuts it dead (B): fixed cf33d03007

One event that throws at its play call stops the pattern player for good (B): fixed 721d6a7a0b. This also fixes `createScore`, which plays through a pattern player.

Extra defects found while fixing:

`release()` on a fading voice tore it down and cut the fade: fixed cf33d03007, the same commit as the `stop(fadeMs)` fix.

A non-finite rate or detune given straight to a voice kernel (`createNoiseKernel`, `retune`) was not checked: fixed 2d656dad35

Checks:
- Every non-browser test file under `packages/audio/src`, run one at a time with `--maxWorkers=1`: 83 ran, 0 failed. `createAudioEngine.stream.test.ts`, `patternPlayer.test.ts` and `createAudioEngine.patch.test.ts` were rerun on the final tip: pass.
- Unrun browser test files: none touched.
- `npm run typecheck:packages -- audio`: pass ("1/1 audio ok")
- eslint on every changed `.ts` file: pass (exit 0)
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("OK — 1730 changeset(s).")
- `npm run check:audio-worklet`: pass ("OK — the generated processor matches its source.")
- The tree is clean.