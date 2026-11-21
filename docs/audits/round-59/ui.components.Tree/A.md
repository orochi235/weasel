# Audit round 59 — ui.components.Tree

## A click on a native control in a treegrid row with `href` gets its default prevented and its focus taken
- where: packages/ui/src/components/Tree/TreeRowLead.tsx:54 (TreeRowBox onClick)
- scenario: a node with both `href` and `controls` (say a checkbox, or the kit Checkbox whose hidden `<input>` takes the click) makes the row box an `<a role="row">` holding the control cell. A plain left click on the control bubbles to the anchor's `onClick`, which calls `e.preventDefault()` and focuses the row before handing off to `onPress` (which then correctly skips activation via `isInControlWithin`). `preventDefault` on a checkbox's click reverts its toggle, and focus leaves the control for the row. The control-in-row check has to come before `preventDefault`/`focus()`, as `onPress` and the drag's press handler already do.
- evidence: read
- severity: medium

## Disabled rows move by Alt+arrow though a drag refuses to start on them
- where: packages/ui/src/components/Tree/treeKeyboardMove.ts:31 (handleMoveKey)
- scenario: a drag on a node with `disabled: true` never starts (`stays()` in useTreeDrag.ts:66 checks `disabled || immovable`), but focusing the same disabled row and pressing Alt+Up calls `onMove` with it: the keyboard path checks only `immovable`. The same question — can this row be moved — is answered two ways on two paths. `draggedIdsFor` likewise leaves a selected disabled node in the carried set (a controlled `selectedIds` can hold one).
- evidence: read
- severity: low

## The row tooltip keeps a detached element after its row unmounts under the pointer, and reopens on it
- where: packages/ui/src/components/Tree/useRowTip.ts:28 (rest) / packages/ui/src/components/Tree/Tree.tsx:130
- scenario: the pointer rests on a child row with a `tooltip`, so `tip = {id, el}`. The child unmounts without a pointerleave — its parent folded by keyboard (Left on the focused parent), or the consumer filters `nodes` — so `clear()` never runs, and a rest timer still pending fires onto the removed element too. `tipNode` hides it only while the node is not visible; when the branch reopens (new element, same id) `tipNode` is found again and the tooltip opens anchored to the old detached element (positioned at 0,0 / off the row) without the pointer anywhere near. The same happens when the tree switches between `ul`/`li` and treegrid `div`s (a node gains `controls`), which remounts every row.
- evidence: read
- severity: low

## `onDragOutside(…, null, effect)` always reports `'move'`, even for a copy or link drag
- where: packages/ui/src/components/Tree/useTreeDrag.ts:134 (leaveOutside)
- scenario: Alt-drag (copy) a row out to a target that accepts it, then back inside or release: the outside target is told `effect: 'move'` on the leave call, after every move call said `'copy'`. A consumer that keys its preview on the effect sees the effect flip on the final call. The effect in flight is known in `update` and could be passed through.
- evidence: read
- severity: low

## The forwarded ref keeps a detached element after the tree switches between `ul` and treegrid `div`
- where: packages/ui/src/components/Tree/Tree.tsx:106 (useImperativeHandle) with Tree.tsx:136 (`List`)
- scenario: since 175c611f20 a treegrid draws its root as a `div` and a plain tree as a `ul`. A consumer whose `nodes` gain their first `controls` (or lose their last) flips `grid`, so React unmounts the `ul` and mounts a `div`; `treeEl.current` follows, but the handle is recomputed only on `[isEmpty]`, so the consumer's `ref` still points at the removed `ul` — focus calls, measuring and `contains` checks against it all go wrong. `grid` belongs in the deps beside `isEmpty`.
- evidence: read
- severity: medium

## A drag from a selected movable row under a selected immovable ancestor carries nothing and calls `onMove([], …)`
- where: packages/ui/src/components/Tree/treeMoves.ts:56 (draggedIdsFor), reached from useTreeDrag.ts:187
- scenario: select an immovable branch `A` and its movable child `a1` (Cmd-click both), then drag `a1`. `stays` lets the drag start (a1 is movable), but `draggedIdsFor` drops `A` as immovable and drops `a1` because it "travels with a selected ancestor" — the ancestor that does not travel. `ids` is `[]`: the ghost is empty, and on release `resolve([] …)` passes (`isNoopDrop([])` is false, `landsInside` false), so `onMove([], target)` is called. The ancestor test should only count ancestors that themselves travel. The keyboard path reaches the same empty set (treeKeyboardMove.ts:33) and silently does nothing.
- evidence: read
- severity: medium

## A Cmd/Ctrl/Alt-click on an `href` row activates it when the tree takes `onMove`
- where: packages/ui/src/components/Tree/useTreeDrag.ts:203 (onClick → onPress)
- scenario: a tree with `onMove` and a node with `href`. Cmd-click the row: `onPointerDown` opens a threshold drag on the container (capture at the press), the release below the threshold runs `onClick`, which calls `onPress(id, mods)` → `activate` → selection change and `onAction(id, {metaKey: true})`, regardless of `href`. The documented contract (TreeNode.href, Tree's "Activating") is that such clicks are the browser's and not activations; `TreeRowBox` honors it only on the path without a drag, and with the pointer captured on the container the anchor's click (and the browser's new-tab) may not happen at all. The href/modifier test (Tree.href.test.tsx:55) runs without `onMove`.
- evidence: read
- severity: medium

## A drag hover opens a disabled branch that every other path refuses to open
- where: packages/ui/src/components/Tree/treeUtils.ts:53 (useTreeFold expand), called from useTreeDrag.ts:173
- scenario: drag a row and rest over a closed branch with `disabled: true` for `tree.hoverExpandMs`: `hover.aim` → `expand(id)` adds it to the expanded set (and calls `onExpandedChange`). `toggle` (treeUtils.ts:46) refuses a disabled node, and TreeNode.disabled says it "cannot be … expanded". The two fold paths answer the question differently; `expand` should refuse what `toggle` refuses.
- evidence: read
- severity: low

## A disabled or read-only tree still marks and answers external drops
- where: packages/ui/src/components/Tree/Tree.tsx:110 / packages/ui/src/components/Tree/useOutsideDrop.ts:28 (hitAt)
- scenario: `<Tree disabled externalDrag={at} dropRef={drop}>` (or `readOnly`, or inside a `Disabled` scope): `hold.refuses` turns off `onMove` but `externalDrag`/`dropRef` are passed through untouched, so the tree draws a drop mark under the pointer and `dropRef.current.targetAt` returns a target, and the caller inserts into a tree whose Held section says nothing moves. `hitAt` should return null while the tree's hold refuses.
- evidence: read
- severity: low

## Two copies of `applyMove` for test/story trees, answering the move differently
- where: packages/ui/src/components/Tree/Tree.fixtures.ts:5 and packages/ui/src/components/Tree/tree.fixture.ts:44 (applyMove)
- scenario: stories use `Tree.fixtures.ts`'s, property tests check the helpers against `tree.fixture.ts`'s. They are separate implementations of "apply an onMove result" (different index adjustment code), so the stories can drift from the model the PBT trusts — one question, two pathways. Also `Tree.fixtures.ts` imports the package through `@weasel-js/ui/components/Tree` while its sibling imports relatively.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Tree/RowTip.tsx
packages/ui/src/components/Tree/Tree.fixtures.ts
packages/ui/src/components/Tree/Tree.module.css
packages/ui/src/components/Tree/Tree.stories.module.css
packages/ui/src/components/Tree/Tree.stories.tsx
packages/ui/src/components/Tree/Tree.tsx
packages/ui/src/components/Tree/TreeGhost.tsx
packages/ui/src/components/Tree/TreeRow.tsx
packages/ui/src/components/Tree/TreeRowLead.tsx
packages/ui/src/components/Tree/index.ts
packages/ui/src/components/Tree/tree.fixture.ts
packages/ui/src/components/Tree/treeDropAt.ts
packages/ui/src/components/Tree/treeFilter.ts
packages/ui/src/components/Tree/treeGridKeys.ts
packages/ui/src/components/Tree/treeGuide.module.css
packages/ui/src/components/Tree/treeKeyboardMove.ts
packages/ui/src/components/Tree/treeMoves.ts
packages/ui/src/components/Tree/treeRowKeys.ts
packages/ui/src/components/Tree/treeRowPointer.ts
packages/ui/src/components/Tree/treeTypes.ts
packages/ui/src/components/Tree/treeUtils.ts
packages/ui/src/components/Tree/useOutsideDrop.ts
packages/ui/src/components/Tree/useRowTip.ts
packages/ui/src/components/Tree/useTreeDrag.ts
packages/ui/src/components/Tree/useTreeNav.ts
packages/ui/src/components/Tree/useTreeSelection.ts

<!-- done: 10 findings, files read: 26 -->
