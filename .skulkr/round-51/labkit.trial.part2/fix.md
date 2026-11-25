- Canvas layers the layer list doesn't name drop below the listed ones after a reorder (A+B): fixed 1698a519e3
- `ctx.trial.setZoom` ignores the zoom range and pivots about world (0,0) (A): fixed fee9c83709
- After a reload, the first cross-redo check drops the redo both histories saved (A): fixed 165750af56
- An instrument history that mounts again while its trial stays open starts empty and is saved over the old one (A): fixed c71dd16aef
- A gesture on an `over` path that ends where it started leaves an empty undo step (A): not a defect. `docs/unruled.md` ("Ruled 2026-11-10") says the lab's `over` keeps its steps, since the trial cannot take them back.
- Chrome context memo misses every render because `view2d` is a new object each time (B): fixed 14b71007d7
- A layer toggle or reorder records an undo step that undoes nothing (B): fixed 1c4eaf0df6. The step now records an op over the trial's layer order and visibility. A saved history leaves these steps out, since layer state isn't saved and a nameless op would have cut off the steps before it.
- Canvas layer not named in `layers.ids` jumps to the bottom of the stack after a reorder (B): duplicate of A's layer-order finding (1698a519e3)
- An `alwaysOn` layer is drawn hidden when its visibility says false (B): fixed d806f3b2da
- The tool slot's chrome memo never holds because `setActiveTool` is a new closure each render (B): fixed 14b71007d7. The same commit as the `view2d` fix, because both break the same memo.
- A saved trial history is marked restored before `enabled` is checked, so it is lost if the instrument gains `undo` later (B): fixed 2d447496a3

Extra defects found while fixing:
- The undo bindings and the loupe bindings were also new objects every render, so the chrome context memo still missed after the two reported fixes (sweep): fixed 14b71007d7. Counted as one extra.

No `docs/unruled.md` entries were needed. Each fix that a consumer could notice has its own changeset; the two memo fixes share one changeset because they are one change.

Checks run:
- `npx vitest run --maxWorkers=1 <file>` on each touched test file at the final tip:
  - ownUndo.test.ts: pass (8)
  - savedUndo.test.ts: pass (3)
  - Trial.canvas.test.tsx: pass (11)
  - Trial.setZoom.test.tsx: pass (1)
  - chromeIdentity.test.tsx: pass (4)
  - useRestoredHistory.test.ts: pass (1)
  - useTrialLayers.test.ts: pass (4)
  - useTrialUndo.test.ts: pass (1)
- Every non-browser test file in `packages/labkit/src/trial` and `packages/labkit/src/scene`, one at a time: pass. This ran before the last formatting and comment-only changes.
- Each new test was also run against the pre-fix code and failed there.
- No `*.browser.test.*` file was touched, so none is unrun.
- `npm run checks:gate`: pass (all 32 passed). The first run failed `check:size` and the labkit lint, both from my changes; I fixed them and folded the fixes into their commits.
- `npm run lint -w @weasel-js/labkit`: pass
- `npm run check:changesets`: pass
- The tree is clean.

tally: 9 of 11 fixed, 1 extra fixed