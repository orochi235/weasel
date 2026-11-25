[r42-1] test-seams' header promises seams it no longer exports (carried): not a defect (no longer applies). The header now names the stroke-marker and content-handler resets, points to `@weasel-js/paint-kinds/test-seams` for the paint-kind reset, and describes path edit's dep source and stub. All of those are exported.

[r42-2] mesh.ts claims a `sideEffects` entry that core's package.json lacks (carried): not a defect (no longer applies). `packages/core/package.json` lists `./src/import-shims/mesh.ts` and `./dist/mesh.js` under `sideEffects`.

[r42-3] `ops.swap` is history's value swap, not a core op (carried): not a defect (no longer applies). The package doc now says `ops.swap` is `@weasel-js/history`'s `createSwapOp`, never touches the scene, and that swapping two nodes is editing's `swap` command.

[r42-4] engine.ts header says it carries "the actions and tools such a host binds" (carried): not a defect (no longer applies). The header and its generator in `scripts/gen-engine-entry.mjs` now say the actions a host binds are `@weasel-js/editing`'s.

[r42-5] the `@weasel-js/core/ops` example commits through an API that does not exist (carried): not a defect (no longer applies). `commitOps(deps, ops, label)` exists and core's main entry exports it through `barrel/paths.ts`, so the example matches its signature.

[r42-6] test-seams exports the same fixtures under two names each (carried): fixed a200bdcdb3. I kept `gridSnapSourceForTests`, `snapSessionDepForTests`, `pbtRunsForTests`, `pbtTallyForTests` and `pbtTimeoutForTests`, and dropped `gridSourceForTests`, `sessionDepForTests`, `runsForTests`, `tallyForTests` and `timeoutForForTests`. I renamed the 9 editing tests that imported the dropped names and updated the exports inventory. The new `test-seams.test.ts` checks that no value is exported twice; it failed before the fix. None of the dropped names was ever in a released changelog, so this needed no new changeset; I edited the pending one that announced them.

Extra, three pending changesets announced exports that won't ship (sweep): fixed 170f0db55c. Two of them listed `hitTestAreaForTests`, `useInsertDepSourceForTests` and `rectPoseForTests` as test-seams additions, but core no longer exports them. A third said `RegionQueryOptions`, `ScenePickSourceOptions` and `ViewPickGates` come from `@weasel-js/core/test-seams`, but they are in core's main entry.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `test-seams.test.ts` pass, `insert.pages.test.tsx` pass, `insert.reposition.test.ts` pass, `insert.test.ts` pass, `insertInto.deps.test.ts` pass, `placeAction.test.ts` pass, `snap.test.ts` pass, `dragActions.pbt.test.ts` pass, `dragLaws.pbt.test.ts` pass, `editActions.pbt.test.ts` pass
- `npm run check:changesets`: pass ("OK — 3209 changeset(s).")
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/core` and `npm run lint -w @weasel-js/editing`: neither package has a lint script (npm reports the script missing). The root `npm run lint` passed inside the gate.

tally: 1 of 6 fixed, 1 extra fixed