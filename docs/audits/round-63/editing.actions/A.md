# Audit round 63 — editing.actions

Note: the brief names frozen commit 1b4edb3a93db1759496d564da57eb13020b3d7d2, which is not in this
repository; the tree here is at 6f634fabe1 with no working-tree changes under the listed paths. Line
numbers cite that tree.

## A lasso drawn while zoomed in reads as a click and clears the selection, because its "tiny" test and vertex spacing are in world units
- where: packages/editing/src/actions/lassoSelect/behaviors/selectFromLasso.ts:16-22 (isTinyLasso, MIN_AREA = 4 world px²); packages/editing/src/actions/lassoSelect/action.ts:71,155-161,214-217 (DEFAULT_MIN_VERTEX_SPACING = 2 world px, endLasso)
- scenario: view scale 32. User lassoes a 50×50 screen-px loop around a small detail: that is ~1.56×1.56 world px, area ≈ 2.4 < 4, so `isTinyLasso` is true and `endLasso` calls `d.setSelection([])` (or `selectFromLasso` returns a clear op) — the selection is wiped instead of taking the enclosed nodes. The 2-world-px vertex spacing compounds it: at scale 32 a vertex is only recorded every 64 screen px, so a modest loop records fewer than 3 vertices and is "tiny" by count too, and a larger loop's polygon is a coarse approximation of the drawn path. The thresholds need to be screen-space (divided by the view scale, as `ctx.deps.view` is already required). The marquee answers the same "is this a click?" question differently — `areaSelect` treats any non-zero extent as an area (areaSelect.ts:96) — so at high zoom a marquee works where a lasso of the same size clears.
- evidence: read
- severity: medium

## Cut deletes the `operands` but copies whatever the clipboard dep's own selection reader names, so with host-supplied operands it deletes nodes it never copied
- where: packages/editing/src/actions/clipboard/action.ts:53-62 (clipboardCutAction.run); also clipboardCopyAction:28-34
- scenario: the `operands` dep is documented as "whatever the host supplies — the selection by default, or any other list" (core interactions/actions/operands.ts). `ClipboardDep.copy()` takes no ids; the kit's implementation (`useClipboard`/`useClipboardOps`, editing/src/clipboard) reads its own `getSelection()`. A host whose operands are a fixed list [A, B] while the scene selection is [C] (or empty) presses Cmd+X: `deleteEnabled` and `commitDeleteToScene(ids = operands)` remove A and B, while `deps.clipboard.copy()` puts C (or nothing) on the clipboard — the cut nodes are gone from the document and absent from the clipboard, so Paste cannot bring them back. Copy has the same split: it is gated on `requiresOperands` but copies the selection. Delete/duplicate and every other editing action act on operands, so the cut and copy pair answers "what is acted on" differently from the rest; the action should hand the ids to copy (or the dep should read operands).
- evidence: read
- severity: medium

## Make Boolean Group does not re-express an envelope operand's children, so they jump when the operand changes frame
- where: packages/editing/src/actions/pathfinder/booleanGroupAction.ts:43-62 (booleanGroupOps)
- scenario: an envelope (a node with `dependsOn: 'children'` and `derivePose`, e.g. an existing boolean group) is no frame: its children are stored in its parent's frame (swapOps.ts:44-72 `reframed` and the 2026-11-20 clone fix 7a5e072303 exist for exactly this). Select boolean group B1 inside a rotated or translated group R, plus a shape S at the root, and run Make Boolean Group. `groupingSite` puts the new group under the common container (the root); `booleanGroupOps` reparents B1 under the new group and writes B1's own (derived, overwritten on the next read) pose via `localUnder`, but B1's children keep their poses stored in R's frame while now being read in the root's frame — B1's contents jump by R's transform on screen, contradicting the doc's "nothing moves on screen". Only the operands themselves get `setPose`; their envelope children (and nested envelopes) need the same `localUnder(parent, world)` rewrite swapOps applies.
- evidence: read
- severity: medium

## `useAlign` / `useDistribute` write `setPose` on a selected derived-pose node, so an envelope group in the selection does not move (the actions move its sources)
- where: packages/editing/src/actions/align/align.ts:133-155 (useAlign); packages/editing/src/actions/distribute/distribute.ts:83-105 (useDistribute)
- scenario: the hooks document use "over a scene's adapter, pass `scene.composition`" and take a `scene` for drawn boxes. Selection = [envelope group G (`dependsOn: 'children'`, `derivePose`), rect R]; `align('left')`. The hook measures G's box, then pushes `setPose({ id: G, to })` — but a derived pose is not stored ("a node whose pose is derived cannot be written itself", core selectionSubtree.ts `shapeSources` doc), so G re-derives from its unmoved children and stays put while R moves. The `align.*` / `distribute.*` actions answer the same request through `moveEachOps`, which routes G's delta to its sources (`moveSources`) and moves it. The hooks also skip `withoutPageStructure` and the lock check the actions apply, so over the same scene the two entry points disagree on what aligns.
- evidence: read
- severity: low

## Reorder reports enabled with no `scene` dep, though its run does nothing without one
- where: packages/editing/src/actions/reorder/reorder.ts:82-83 (reorderEnabled) vs 145,192 (run)
- scenario: a host registers `reorder.forward` / `reorder.backward` with an `operands` dep but no `scene` dep (as 814994ab79 on 2026-11-20 fixed for flip, nudge and transform again). `enabled` returns `true` (`if (!scene) return true`), so the menu item and Cmd+] show as available and the dispatcher fires it — and claims the key from lower bindings — while `run` returns at `if (!selection || !scene) return`. It should answer `NotApplicable`, as flip (flip/action.ts:195) and transform again do.
- evidence: read
- severity: low

## Copy and Cut report enabled without a `clipboard` dep, so Cmd+C / Cmd+X are claimed and do nothing
- where: packages/editing/src/actions/clipboard/action.ts:27-34 (clipboardCopyAction: `enabled: requiresOperands`, run `deps.clipboard?.copy()`)
- scenario: the clipboard dep is consumer-published (core editDeps.ts: "The kit deliberately does not build one"). A canvas with a selection but no `clipboard` source: `enabled` checks only operands, so Cmd+C dispatches to `clipboard.copy`, which wins the key over any lower binding and runs `undefined?.copy()` — nothing is copied. Cut has the same split: `enabled: deleteEnabled` never looks at the clipboard, while its run returns at `!deps.clipboard` (line 56), so Cmd+X is claimed and neither copies nor deletes. Only Paste's `enabled` (`clipboard && !isEmpty()`) gates on the dep; Copy's and Cut's should too.
- evidence: read
- severity: low

## Files read
packages/editing/src/actions/align/action.tsx
packages/editing/src/actions/align/align.ts
packages/editing/src/actions/align/index.ts
packages/editing/src/actions/clipboard/action.ts
packages/editing/src/actions/clone/action.ts
packages/editing/src/actions/clone/behaviors.ts
packages/editing/src/actions/delete/delete.ts
packages/editing/src/actions/derivedBox.ts
packages/editing/src/actions/distribute/action.tsx
packages/editing/src/actions/distribute/distribute.ts
packages/editing/src/actions/distribute/index.ts
packages/editing/src/actions/distribute/plan.ts
packages/editing/src/actions/flip/action.ts
packages/editing/src/actions/flip/helpers.ts
packages/editing/src/actions/group/enterGroup.ts
packages/editing/src/actions/lassoSelect/action.ts
packages/editing/src/actions/lassoSelect/behaviors/selectFromLasso.ts
packages/editing/src/actions/lassoSelect/index.ts
packages/editing/src/actions/lassoSelect/options.ts
packages/editing/src/actions/lockedWrites.ts
packages/editing/src/actions/pathfinder/action.tsx
packages/editing/src/actions/pathfinder/booleanGroupAction.ts
packages/editing/src/actions/pathfinder/keymap.ts
packages/editing/src/actions/reorder/reorder.ts
packages/editing/src/actions/rotate/action.ts
packages/editing/src/actions/rotate/commit.ts
packages/editing/src/actions/rotate/frame.ts
packages/editing/src/actions/rotate/replay.ts
packages/editing/src/actions/rotate/session.ts
packages/editing/src/actions/select/areaSelect.ts
packages/editing/src/actions/select/clearSelection.ts
packages/editing/src/actions/swap/action.ts
packages/editing/src/actions/swap/swapOps.ts
packages/editing/src/actions/transformAgain/action.ts
packages/editing/src/actions/transformAgain/transformSelection.ts

<!-- done: 6 findings, files read: 35 -->
