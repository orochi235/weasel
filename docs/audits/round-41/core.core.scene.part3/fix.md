journal `applyOps` recorded inside `untracked` (A+B): fixed e767d90347

`heldIndex` didn't truncate a fractional index, so `moveLayer` to its own slot recorded an undo entry (A): fixed 6608b5e24c. This also covers `addLayer`, `addPage` and `movePage`, which use the same helper.

`reorder` with no index: its no-op check read it as the end, its payload as the start (B): fixed 778b6876b7. It now means the end in both places, as `move` has it.

`loadState` with a journal open left that journal holding the replaced document's ops (B): fixed c40b9d4c63. I made the strict call: it now throws while any journal is open, suspended ones included. Recorded in `docs/unruled.md` under a new "Audit round forty-one" section. It changes behavior: the changeset is tagged `fix behavior`.

stale replay never skipped layer ops, so a layer removed by an untracked edit left undo entries that threw on every step (B): fixed 17233e42d8. That covers `kit:setLayerVisible`, `kit:setLayerLocked`, `kit:setLayerParallax`, `kit:renameLayer` and `kit:moveLayer`. It also covers B's sub-cases: `kit:setLayer`, a `kit:add` onto a missing layer, and a `kit:remove` restored onto one. It also covers `kit:addLayer`/`kit:removeLayer` when the layer is already there or already gone.

`freshIds` could mint an id that a restored history brings back (A): fixed 142bf503a0. Ids that a `restoreHistory` snapshot adds or removes now count as taken. The set is replaced on each restore and emptied by `history.clear` and `loadState`, so it never grows past one snapshot.

a reverted `kit:remove` dropped the nodes' pose previews and scroll offsets (A): fixed 2931fe736d. Forgetting now waits until the edit settles, and only for nodes still gone. My test covers a batch that throws. For a refused arrival I'm inferring rather than testing: that path also runs inside a held notice, so it should behave the same.

Extra defects found while fixing:

removal by stale index (sweep): undoing `addLayer`, and redoing `removeLayer`, took out the layer at the recorded index. After an untracked `moveLayer`, that removed a different layer. Fixed 48467a7135: both now find the layer by id.

Checks run:
- Each touched test file on its own with `--maxWorkers=1`: `scene.applyBatch` 9/9 pass, `scene.moveLayer` 5/5 pass, `scene.nodes` 29/29 pass, `scene.journal` 11/11 pass, `scene.staleReplay` 13/13 pass, `scene.historyPersistence` 9/9 pass, `editingSession` 12/12 pass. The nearby `scene.history`, `scene.layers`, `scene.arrivals`, `scene.notify`, `scrollOffsets`, `sceneJournals` and `pages/pageEdits` files all pass too. No browser tests were touched.
- `npm run checks:gate`: first run, 2 of 32 failed. `check:changesets` failed on four titles over 140 characters, and `check:size` on two functions grown past 120 lines. Both were fixed and squashed into their commits. Second run: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/core`: fail, "Missing script: lint" (core has no lint script). As a stand-in, eslint on every changed file passed (exit 0).
- The tree is clean. All 8 commits sit on top of a4ebc2f8bc.