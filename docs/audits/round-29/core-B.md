# Audit 29 — core and its state (reviewer B)

## addPage / setPages / createPageRun accept a page id the document already has, and lay two pages on one slot
- where: packages/core/src/core/pages/pageEdits.ts:133 (addPage), :79 (setPages); packages/core/src/core/pages/pageNodes.ts:144 (pagePoses), :181 (createPageRun)
- scenario: a paged scene with pages `[A, B]`; `addPage(scene, { id: 'A', width: 300, height: 200 })`. `setPages` gets `[A, B, A']`: `pagePoses` is a Map keyed by page id, so `A` gets the third slot's pose and A''s size; the loop finds `pageNodeOf('A')` and rewrites the existing node instead of adding one; `orderPages` skips the third slot. Result: no page added, page A resized and moved to where a third page would be (overlapping B's run extent), and the run's pose sized for three pages. `createPageRun(scene, [A, A])` instead mints a second node for the same `Page.id`, both at the second page's pose, and `pageNodeOf('A')` answers only one of them. Nothing throws, though the same arc made `removePage`/`movePage`/etc. throw on an unknown id. Should throw on a duplicate page id (or `addPage` should mint via `nextPageId`).
- evidence: read
- severity: medium

## A node's `page`, `pageRun` and `units` objects are neither owned nor detached, so `toJSON()` and `pagesOf()` hand out the live objects
- where: packages/core/src/core/scene/serialization.ts:80 (serializeScene, `statedFields(n)`); packages/core/src/core/scene/declaredFieldSetters.ts:53 (kit:setPage/setPageRun/setUnits apply); packages/core/src/core/scene/kitOps.ts:140 (kit:add `Object.assign(node, statedFields(p))`); packages/core/src/core/pages/pageNodes.ts:103 (pageFromNode spreads `meta` by reference)
- scenario: pose and `data` go through `own()` on write (deep-frozen in dev) and `detach()` in `toJSON`, whose contract is that the snapshot "is the caller's to edit". The declared fields get neither. `const snap = scene.toJSON(); snap.nodes[k].page.meta['diagram:graph'] = x` (or `pagesOf(scene).pages[0].meta.foo = 1`, or mutating the `PageInfo` / `UnitScope` object later after passing it to `setPage` / `setUnits` / `addPage`) writes straight into the live node and into the history payloads that hold the same object — no op, no notification, undo cannot restore it, and in dev no freeze throws either. Same question (is a stored node value the scene's?) answered two ways.
- evidence: read
- severity: medium

## `registerOp` accepts a kind starting `revert:`, which collides with the name of another kind's inverse, so a restored history replays the wrong op
- where: packages/core/src/core/scene/sceneRecording.ts:152 (registerOp reserves only `kit:`); packages/core/src/core/scene/opTable.ts:112 (rebuild)
- scenario: a consumer registers kinds `"commit"` and `"revert:commit"` (a natural name for an "undo the commit" op). An undone `commit` entry's inverse op is named `revertName('commit')` = `"revert:commit"`. After `history.serialize()` → `history.restore(...)`, `rebuild("revert:commit", args)` checks `handlers.has(name)` first and returns the consumer's `revert:commit` *forward* op instead of `commit`'s revert, so redo/undo of that entry runs the wrong handler on the wrong payload. Registration should refuse the `revert:` prefix as it refuses `kit:`.
- evidence: read
- severity: low

## A `<CanvasView>` skipped for a duplicate id never registers once the view holding that id goes away
- where: packages/core/src/canvas/viewRegistry.tsx:201 (register); packages/core/src/canvas/CanvasView.tsx:270 (effect deps `[registry, registration]`)
- scenario: view A holds id `"detail"`; view B mounts with the same id (e.g. a panel opening while the previous one plays its exit and is still mounted) and is skipped with a console.error; `register` returns a no-op. When A unmounts, nothing re-runs B's effect (its `registration` memo is unchanged), so B stays mounted but is never painted or routed to until some unrelated prop of B changes. The skip is permanent rather than lasting only while the clash does.
- evidence: read
- severity: low

## A refining preset wins a layer slot or tool id but still throws on `selection` / `selectionChrome`
- where: packages/core/src/canvas/SceneCanvas/features.ts:280-281, :287 (oneOf) vs :272 and presetMerge.ts:26 (mergeByKey)
- scenario: preset `P3` declares `refines: ['select']` and supplies its own `selectionChrome` (or `selection` factory) along with layers. Its layers win over `select`'s by refinement, but `oneOf` ignores `refines` and throws "presets "…" and "…" both draw the selection chrome". The same "which of two presets' values wins" question is answered by refinement in `mergeByKey` and by "never" in `oneOf`, so a refinement cannot replace the one role a refinement most often would.
- evidence: read
- severity: low

## The scene's atomic rollback stops at the first revert that throws, leaving the edit half taken back and the selection unrestored
- where: packages/core/src/core/scene/appliedLog.ts:51-62 (atomically, catch block)
- scenario: inside a replay (`undo`) or `applyBatch`, registered ops `a` then `b` apply and `c` throws. The catch reverts `b` then `a`; if `b`'s `revert` throws (a consumer op's revert against state it did not expect), the loop exits: `a` stays applied, `env.setSelection(selectionBefore)` and `notify()` never run, and the caller sees `b`'s revert error in place of `c`'s original one. The history engine answers the same situation the other way — `applyUnwinding` (packages/history/src/entryOps.ts:48) reverts best-effort per op, logs a second failure, and rethrows the original — so the two rollback paths disagree.
- evidence: read
- severity: low

## The magnification check runs every 250 ms during a drag instead of once it settles, warning for each intermediate size
- where: packages/core/src/canvas/SceneCanvas/useMagnificationCheck.ts:35-37
- scenario: `timer ??= setTimeout(check, SETTLE_MS)` only arms when no timer is pending, so a continuous edit (resizing a container whose transform scales its children, a 2-second drag) runs `check` 250 ms after the first change, then again 250 ms after the next, and so on — a throttle, not the "after edits settle" the comment promises. Since the dedupe key includes the drawn size (`${id}:${size}:${declared}`), each intermediate magnification of the drag warns once, flooding the console, and `warned` grows by one key per distinct size for the life of the canvas. Clearing and re-arming the timer on each change gives the settle.
- evidence: read
- severity: low

<!-- done: 7 findings, files read: 90 -->
