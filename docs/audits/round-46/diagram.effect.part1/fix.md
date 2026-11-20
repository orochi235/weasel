- Cluster drag hangs on a cluster loop, from `dragEdit`'s `depth` (A+B): fixed 932ae9d207
- `parentsOf` takes the last cluster naming a member, where the rest of diagram takes the first (A+B): fixed 653bb83cd3
- `checkPipeline` does not report a member that two clusters name (B): fixed 647d40ca7b. This adds a new problem kind, `duplicate-member`, which is a `minor` changeset, and a README table row.
- Two wires sharing an `id` make `EffectChart`/`EffectEditor` throw during render (A): fixed 40c13d7744. A repeated id is now drawn without the id and reported as `duplicate-wire`, also a `minor` changeset.
- `applySets` stops at the first failed param write but the plan still records the later writes as applied (B): fixed affc6d5985
- A node whose `build` throws freezes the live graph and names no stage (A+B): fixed dffec2c7e5
- One wire into a port its node lacks rolls the whole live graph back (A): fixed f51c4b569f. Strict call recorded in `docs/unruled.md`: only the bad edge is cut, and the error goes on the stage it enters.
- `sync` assumes a structural apply that throws changed nothing, though `graph.apply` keeps applying after an execution-time failure (B): fixed e2ec310269
- A `pause()` or `reset()` during `play()`'s unlock is undone once the unlock resolves (A): fixed f720290170
- `useFollowAudioRunner` never passes the runner `sources` that went back to `undefined` (A+B): fixed 2cc9014ce4
- Shipped audio nodes throw at build, not in `settings`, for a missing or unknown discrete setting (B): fixed dbdad25d6b. A missing setting now takes the stage type's default; recorded in `docs/unruled.md`. To check values in `settings`, `@weasel-js/audio` now exports `checkWave`, `checkFilterType` and `checkNoiseColor`, which is a `minor` changeset on audio. Reverb `seconds` ≤ 0 is still caught at build, but the build fix above now turns that into an error on the stage.

Extra commits:
- 2b33349e9a moves `buildablePlan` and `applyStructure` out of `createLiveAudioRunner`, because the function had grown past `check:size`'s 120-line cap. In the same commit, the play/pause guard now uses `createLatest`, as lint requires.
- 6ee553951e adds the `docs/unruled.md` entries.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, each touched file on its own: `liveRunner.test.ts` 17 passed, `nodes.test.ts` 9 passed, `useLiveAudioRunner.test.tsx` 7 passed, `check.test.ts` 16 passed, `clusterHandlers.test.ts` 1 passed, `clusterOrder.test.ts` 25 passed, `looks.test.ts` 4 passed. All pass.
- `packages/diagram/src/effect` as a whole: 59 files, 531 tests passed.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run had 5 failures (typecheck, typecheck:packages, check:changesets, check:size, lint); all were fixed before this run.
- `npm run lint -w @weasel-js/diagram` and `-w @weasel-js/audio`: fail with `Missing script: "lint"`, because neither package defines one. I ran `npx eslint` on every changed `.ts`/`.tsx` file instead, and it passes; root lint also passed inside the gate.
- `npm run check:changesets`: "OK — 2039 changeset(s)".
- No browser tests were touched, so none are left unrun. The tree is clean.