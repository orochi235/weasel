# Audit round 59 — ui.components.Tree

## A drag with onMove follows an href row's link on a plain click, and activates the row on a Cmd/Ctrl/Alt click
- where: packages/ui/src/components/Tree/useTreeDrag.ts:203 (useTreeDrag onPointerDown, `onClick`); packages/ui/src/components/Tree/TreeRowLead.tsx:54 (TreeRowBox onClick)
- scenario: a Tree with `onMove` and a node with `href`. A plain click under the drag threshold runs the threshold drag's `onClick`, which calls `onPress` (activation) and then `swallowNextClick(box, { keepDefault: true })`: the native click is stopped in capture before TreeRowBox's `onClick` can `preventDefault()`, but its default is kept, so the browser navigates to the href. Without `onMove` the same click is prevented and does not navigate (Tree.href.test.tsx asserts this). And a Cmd, Ctrl (non-Mac) or Alt click passes `isPrimaryPress`, so it activates the row (selects/toggles, calls `onAction`) and then the browser also opens the tab/download — the docs say those clicks "are the browser's, not activations". Expected: the drag path takes an href row's click the same way TreeRowBox does — prevent the default on a plain/Shift click, and leave a modified click alone without activating.
- evidence: read
- severity: medium

## Dragging a row whose selected ancestor is immovable carries nothing
- where: packages/ui/src/components/Tree/treeMoves.ts:56 (draggedIdsFor)
- scenario: selection {P, C} where P is `immovable` and C is P's child. Pressing and dragging C: `selected.has(C)`, so the filter runs; P is dropped as immovable, and C is dropped because `hasAncestorIn` finds P in `selected` (the check reads the raw selection, not the movable part of it). `ids` is `[]`: the ghost is empty, the drop mark still shows, and release calls `onMove([], target)` (isNoopMove/landsInside both pass for an empty list; `isNoopDrop([])` is false). The doc says "a node travels with a selected ancestor … and an immovable one stays behind" — C's ancestor stays behind, so C should travel itself. The same empty list reaches `handleMoveKey` (treeKeyboardMove.ts:33–34, `[].every` is true), so Alt+arrow on C silently does nothing. Expected: the ancestor test considers only ancestors that themselves travel.
- evidence: read
- severity: medium

## Alt+arrow moves a disabled row, which a drag refuses to start on
- where: packages/ui/src/components/Tree/treeKeyboardMove.ts:31 (handleMoveKey)
- scenario: a node with `disabled: true` in a tree with `onMove`. A pointer drag never starts on it (`stays` in useTreeDrag.ts:66 treats `disabled` like `immovable`), but focusing it (focus is allowed on disabled rows) and pressing Alt+Down calls `onMove([id], …)`, since the keyboard path checks only `immovable`. One decision — does a disabled row move — answered two ways. Expected: the keyboard path refuses a disabled node as the drag does.
- evidence: read
- severity: medium

## A drag resting over a disabled closed branch opens it
- where: packages/ui/src/components/Tree/useTreeDrag.ts:173 (update → hover.aim); packages/ui/src/components/Tree/treeUtils.ts:53 (useTreeFold.expand)
- scenario: drag a row over a collapsed branch with `disabled: true` and hold for `hoverExpandMs`. `resolveDrop` marks it `into` (it knows nothing of `disabled`), `hover.aim` arms the timer, and `expand` adds it to the expanded set with no `disabled` check, where `toggle` refuses a disabled node. `TreeNode.disabled` says the node "cannot be … expanded". The keyboard 'in' move (treeKeyboardMove.ts:39–40) likewise opens a disabled target parent through `setExpanded`. Expected: hover-expand (and the move's auto-open) skip a disabled branch, as `toggle` does.
- evidence: read
- severity: low

## Leaving an outside target reports effect 'move' even during a copy or link drag
- where: packages/ui/src/components/Tree/useTreeDrag.ts:134 (leaveOutside)
- scenario: a drag with Alt held (effect 'copy') goes outside, `onDragOutside` answers true, then the pointer comes back in or the drag ends. `leaveOutside` calls `onDragOutside(ids, null, 'move')` with a hard-coded 'move', so a consumer that keys its outside highlight on the effect sees a 'move' it was never in. Expected: pass the effect in flight.
- evidence: read
- severity: low

## Two copies of the move model in the Tree's fixtures
- where: packages/ui/src/components/Tree/Tree.fixtures.ts:5 (applyMove); packages/ui/src/components/Tree/tree.fixture.ts:44 (applyMove)
- scenario: stories (and tests importing Tree.fixtures) apply `onMove` through one implementation, while the property tests check the tree's helpers against a second, written differently (index counted against the original siblings by strip-then-filter vs. splice minus `siblingsBefore`). A change to what a `TreeDropTarget.index` means can be fixed in one and not the other, and the stories would then disagree with the model the PBT asserts. Expected: one applyMove both import.
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

<!-- done: 6 findings, files read: 26 -->
