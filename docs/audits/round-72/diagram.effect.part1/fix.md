- A missing numeric param plays at the factory's default instead of the stage type's (A): fixed 96bd035d4e
- A level that leaves the plan keeps its old value in the graph (B): duplicate of the A finding above, fixed in the same commit 96bd035d4e (a plan that drops a level now rebuilds the node)
- `applyStructure` treats a batch with no adds as unapplied after a runtime throw (A): fixed e49c7800cc (adds `AudioGraph.check` to `@weasel-js/audio` so the runner validates first, and a throw after a passing check counts as landed)
- `ClusterTitleField` reports the rename twice, on Enter and again on the closing blur (A): fixed e97ec52249
- A reconnected wire keeps its hand-set route (A): fixed 1c8bdefc84
- Moving a cluster leaves inside wires' `{ near }` label points behind (A+B): fixed b369dcd401
- A wire repeating an earlier wire's id is edited through that id, so both wires change (A): fixed 6b15cc792b (`ensureWireIds` gives the repeat a fresh id)
- Editor connect and reconnect refuse rack's `~tap:` ports (B): fixed eb29cd58c7
- A wire minted into a freed id by a chain move takes the removed wire's label (B): fixed 37482b0f75
- Reorder moves index the whole `order.items` while the slots come from the boxed subset (B): fixed 4a4383ad69 (the reviewer found no look that triggers it today; the test reproduces it with an unboxed item)
- A chain reorder refuses a `many` input that a side wire already feeds (B): fixed dd6233dfd0 (`inputFed` in `edit.ts` is now shared with the editor's connect path)
- The live audio plan plays wires the chart does not draw (B): fixed 3896a9bae1 (correction: a wire starting at an input is drawn and flagged, not dropped; it is no longer played either)
- A cluster id with the reserved `~` prefix is not reported or refused (B): fixed c4bd1024af

Extra defects found while fixing: none.

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: pass. These were `audio/plan`, `audio/patches`, `audio/liveRunner`, `audio/livePreviews`, `audio/useLiveAudioRunner`, `audio/graph/createAudioGraph`, `clusterTitle`, `edit`, `clusterEdit`, `chainEdit`, `EffectEditor`, `editorReorder` and `check`. Also `packages/diagram/src` as a whole: 2743 passed.
- Unrun browser tests: `packages/diagram/src/effect/audio/liveRunner.browser.test.ts` and `packages/audio/src/graph/graph.browser.test.ts`. Both run on the real graph, which now has `check`.
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed `check:changesets` because four titles were over 140 characters; I fixed those and folded the fixes into their commits.
- `npm run lint -w @weasel-js/diagram` and `-w @weasel-js/audio`: neither package has a `lint` script (npm error, missing script). In their place I ran eslint on every changed file: pass. The gate's root `npm run lint` also passed.
- The tree is clean and every commit has its own changeset.

tally: 14 of 14 fixed, 0 extra fixed