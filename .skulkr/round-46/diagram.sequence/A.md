I couldn't write `.skulk/out/findings.md` because the write was denied, so the whole findings document follows here.

# diagram.sequence: blind review findings (round 46)

## Editing a sequence with a locked part throws, even though its regions still accept presses
- where: packages/diagram/src/sequence/layer.ts:56 (placedSequences); packages/diagram/src/sequence/commit.ts:35 (rebuild)
- scenario: A user clicks a part node such as `root/msg:m1`, the select action selects it, and the host's Lock command locks it. The root stays unlocked. `placedSequences` only checks `scene.isLocked(root)`, so the part regions, the drag and the author tools all still work on that root. On release, `commitSequence` calls `rebuild`, which calls `scene.removeMany(childrenOf(root))`. Core's lock guard then throws "cannot remove … locked" inside the batch. `redrawSequences` (commit.ts:75) decides the other way: it skips any sequence whose root *or any part* is locked. So one question gets two answers, and the one editing uses ends in a throw.
- evidence: read (`lockGuard.ts:53` throws on a locked id; `isLocked` covers the node, its ancestors and its layer, not its descendants)
- severity: medium

## Dragging a head into or out of a box leaves the box drawn around a non-member
- where: packages/diagram/src/sequence/edit.ts:125 (moveParticipant); actions.ts:70 (proposed)
- scenario: Participants are A B C, with a box whose members are `[A, B]`. The user drags C's head to the left of B, so the order becomes A C B. `addBox` (author.ts:93) keeps a box's members side by side, "since a box spans every column between its ends". `moveParticipant` has no such rule. The layout draws the box as the union of A's and B's heads (layout.ts:75), so C ends up inside it. `columnsOf` (columns.ts:78) then pads the A|C and C|B gaps as box borders, and that padding lands inside the drawn box. Dragging a member out past a non-member does the same.
- evidence: read
- severity: medium

## On a theme that isn't 12px sans-serif, a new sequence's lifeline misses the click
- where: packages/diagram/src/sequence/authorActions.ts:55 (firstAt)
- scenario: The user clicks empty canvas with the Participant tool. `firstAt` lays out the one-participant data with `DEFAULT_FONT` (12px sans-serif) and no theme. `startSequence` then draws it through `sequenceSpecs` with `themeFont(diagramThemeOf(scene))`. The night theme uses `ui-monospace, monospace` 12, and a user theme can be 16px. "Participant 1" plus padding is wider than the 80 minimum, so the head width depends on the font. `columns[0].x` therefore differs between the two layouts, and the lifeline doesn't stand at the click's x as the doc promises. The y can be off too, through the head height.
- evidence: read
- severity: low

## Dragging a message or fragment leaves its number digit or type label behind
- where: packages/diagram/src/sequence/actions.ts:37 (carries); specs.ts:156, 191
- scenario: With `autonumber` set, the user drags message m1 to another row. `carries` moves the parts whose `id` is m1 or whose `target` names it. The number's circle (`msg:m1/number`) has id m1, so it moves. Its digit (`msg:m1/number/text`) has neither an `id` nor a `target`, so it stays at the old row. A fragment's type text (`frag:f/type`) has the same gap: the tab moves and the word "loop" stays put.
- evidence: read
- severity: low

## An activation still open at a destroy runs past the cross to the diagram's foot
- where: packages/diagram/src/sequence/rows.ts:251 (walkRows)
- scenario: The steps are `activate B`, a message from A to B, `destroy B`, then more rows. B's lifeline ends at the destroy, but the open bar is only closed at the end, at `bottom + SEQ.footer`. So the activation bar runs past the X and down a lifeline that no longer exists.
- evidence: read
- severity: low

## `SEQ_ARROWS` lookups go through the prototype chain
- where: packages/diagram/src/sequence/authorDrags.ts:83 (arrowOf); authorSteps.ts:63 (insertMessage) and :217 (setMessageArrow)
- scenario: Binding params or stored tool options can carry `arrow: 'constructor'` or `'toString'`. `SEQ_ARROWS['constructor']` returns `Object`, not `undefined`, so the `?? SEQ_ARROWS.sync` fallback never runs. That function reaches `insertMessage`, whose `typeof === 'object'` test fails, and `SEQ_ARROWS[fn]` is `undefined`. The message is inserted with no `line` and no `head`. `setMessageArrow` has the same hole. specs.ts already uses `getOwn(MARKERS, …)` for this kind of lookup.
- evidence: read
- severity: low

## `setMessageArrow` treats an explicit `both: false` or `async: false` as a change
- where: packages/diagram/src/sequence/authorSteps.ts:219 (setMessageArrow)
- scenario: A message is `{ line: 'solid', head: 'arrow' }`, with no `both`. Calling `setMessageArrow(data, id, { line: 'solid', head: 'arrow', both: false })` compares `undefined === false`, which fails. The function rebuilds an identical message and returns new data, so the caller commits an empty undo entry.
- evidence: read
- severity: low

## Files read
packages/diagram/src/sequence/actions.ts
packages/diagram/src/sequence/author.ts
packages/diagram/src/sequence/authorActions.ts
packages/diagram/src/sequence/authorDrags.ts
packages/diagram/src/sequence/authorParams.ts
packages/diagram/src/sequence/authorPlace.ts
packages/diagram/src/sequence/authorSteps.ts
packages/diagram/src/sequence/columns.ts
packages/diagram/src/sequence/commit.ts
packages/diagram/src/sequence/edit.ts
packages/diagram/src/sequence/fixture.ts
packages/diagram/src/sequence/index.ts
packages/diagram/src/sequence/layer.ts
packages/diagram/src/sequence/layout.ts
packages/diagram/src/sequence/metrics.ts
packages/diagram/src/sequence/rows.ts
packages/diagram/src/sequence/select.ts
packages/diagram/src/sequence/selected.ts
packages/diagram/src/sequence/specs.ts
packages/diagram/src/sequence/textEdit.ts
packages/diagram/src/sequence/toolOptions.ts
packages/diagram/src/sequence/tools.ts
packages/diagram/src/sequence/trait.ts
packages/diagram/src/sequence/types.ts

<!-- done: 7 findings, files read: 24 -->