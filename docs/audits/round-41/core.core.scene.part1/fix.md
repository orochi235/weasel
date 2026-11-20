- Derivation memo kept the old value after a re-derive threw (A): fixed f549f277ff
- `bindOpToAdapter`/`bindOpToHistoryAdapter` dropped `caused()` (A+B): fixed 7601a7231f. This also covers two more spots: `outerOps.causing` now tests the bound op, so the op applies against the adapter, and `recorder.join` records the ops a joined op says it caused.
- `RebasedDep` had no `children`, so nested groups dropped out of a boolean group (A+B): fixed d80a6bd7c1
- An edit pass counted ops that changed nothing as applied, which stopped coalescing (A): fixed a90c8e6f3a
- `kit:removeLayer` and `kit:addLayer`'s revert spliced by the recorded index, not by id (A): fixed 64ad41b37e
- `pathFromParts` joined parts under `nonzero`, filling an `evenodd` part's holes (A): fixed 8093934239. A set holding an `evenodd` part is now unioned. A set where every part is `nonzero` keeps the cheaper join.
- A child that left and came back in one edit was reported as an arrival (B): fixed 3503842e6c
- `kit:addLayer` applied over a layer id the scene already holds (B): fixed db454c6e0a
- Layer `parallax` options were stored by reference and never owned (B): fixed b9846aacd9. They now pass through `own()`, so in development a write into them throws, as it does for a pose. The changeset tells consumers to pass a new object for each change. The only in-repo caller, `ParallaxDemo`, already builds fresh objects.

No extra defects found. Nothing went into `docs/unruled.md`, since every fix matches behavior that already exists elsewhere in the scene.

Checks:
- Each touched test file, alone with `--maxWorkers=1`: `scene.applyBatch`, `depMemo`, `rebasedChildren` (new), `editPass`, `scene.layerReplay` (new), `scene.layout` and `derivedParts` (new): pass. Also run as neighbors, before the last rebase: `derivedDep`, `derivedPose`, `derivedPath`, `scene.derived`, `unionOfChildren`, `nestedHit`, `layoutPass.*`, `scene.layers`, `scene.moveLayer`, `scene.replay`, `scene.history`, `scene.parallax`, `scene.serialization`, `scene.loadState`, `scene.ownership`, `scene.arrivals`, `canvas/derivedPath.composed`, every `NodeShape*` and `nodeShapes/*` file, every `pathEffects` file, editing's `move.reparentOps` and `runLifecycle`, and guides' `slots`: pass.
- `npm run checks:gate`: first run failed on `check:changesets` (titles over 140 characters) and `check:size` (`createArrivalWindow` 127 lines, `createRecorder` 121). I fixed both and folded the fixes into their commits. Rerun: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/core`: fail, "Missing script: "lint"", because core has no lint script. I ran `npx eslint` on every changed `.ts` file instead: pass.
- No browser tests touched. The tree is clean and nothing in `.skulk/` was committed.