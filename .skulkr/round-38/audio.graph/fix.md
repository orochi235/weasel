**Findings**

Non-finite `fadeMs` accepted, then thrown from the middle of a later edit (A+B): fixed c1663aa4d9. I also refuse a negative `fadeMs`. That is my own strict call, and it is recorded in `docs/unruled.md`.

`replace` with the def already in place, or one def added under two ids, disposes a live def (A+B): fixed 9ec7f1d137. `add`, `replace` and `apply` now throw on any def the graph holds or has held, as the insert chain already does for effects. `replace(id, sameDef)` throws rather than doing nothing. That is my own strict call, and it is recorded in `docs/unruled.md`.

`settled()` resolves while a connect's or a replace's fade-in is still ramping (A+B): fixed efd14ba470.

A non-looping file stopped between its natural end and its `ended` event never rewinds, so the next start is silent (A): fixed 4e657e2331.

A source whose `start` throws stays marked running, and the `start`, `add` or `replace` is left half done (B): fixed 70f063b950. Each of those calls now changes nothing when a source's start throws.

`createOscillatorNode` accepts a non-finite `frequency` and throws only at the next start (B): fixed 2655fa5910.

**Extra**

`createEdits` went past check:size's 120-line function cap after the fixes above: fixed 5f54a74480, by moving the busy test and the `add` rollback into helpers.

`createInsertChain` takes a non-finite `fadeMs` the same way (`packages/audio/src/inserts.ts:86`, raised by A): not fixed. It is outside `audio.graph`, and the fixer for the inserts area could edit the same line.

**Checks**

- `npx vitest run --maxWorkers=1 packages/audio/src/graph/createAudioGraph.misuse.test.ts`: pass (6/6)
- `npx vitest run --maxWorkers=1 packages/audio/src/graph/createAudioGraph.test.ts`: pass (33/33)
- `npx vitest run --maxWorkers=1 packages/audio/src/graph/fader.test.ts`: pass (10/10)
- `npx vitest run --maxWorkers=1 packages/audio/src/graph/sources.test.ts`: pass (22/22)
- `npm run typecheck:packages -- audio`: pass (`1/1 audio ok`)
- eslint on the changed `.ts` files: pass (exit 0, no output)
- `npm run check:size`: pass (`sizes: no file or function grew past its cap.`)
- `npm run check:changesets`: pass (`[changesets] OK — 1736 changeset(s).`)
- Browser tests: none touched.
- Tree: clean apart from `.skulk/`.