I couldn't write `.skulk/out/findings.md` because the write permission was declined, so here is the whole document.

# Audit round 46: diagram.sequence

## Any sequence edit throws when one of the root's parts is locked, though `redrawSequences` skips such a sequence
- where: packages/diagram/src/sequence/commit.ts:35 (rebuild), :45 (commitSequence)
- scenario: a host locks one part node (say `seq/head:a`) and leaves the root unlocked. `placedSequences` (layer.ts:56) checks only the root, so the part regions stay live. The user then drags another message, clicks with the Participant, Note or Mark tool, folds a text edit, or presses Delete. Each of these reaches `commitSequence` → `rebuild` → `scene.removeMany([...childrenOf(id)])`, which refuses the locked child (core `treeEdits.ts:115`, `refuse(nid, 'remove')`) and throws inside the batch. `redrawSequences` (commit.ts:75) checks the root and every child for a lock and leaves such a sequence as it stands. So the question "may a sequence with a locked part be rebuilt?" gets two answers: a theme change skips it, and every edit path throws. The edit paths should refuse up front, or `placedSequences` should leave such roots out, as the redraw does.
- evidence: read
- severity: medium

## A step drag's preview leaves the number badge's digit, the fragment's type label, and the fragment's own rows behind
- where: packages/diagram/src/sequence/actions.ts:37 (carries); packages/diagram/src/sequence/specs.ts:156, :191
- scenario (autonumbered message): the user drags message `m1` in an autonumbered sequence. `carries` takes the parts whose `id` is the step or whose text `target` names it. The badge body `msg:m1/number` carries `id: 'm1'`, so it moves. Its text `msg:m1/number/text` is pushed with neither a target nor an id (specs.ts:156), so the circle moves away and its digit stays put.
- scenario (fragment): the user drags fragment `f1`. The tab moves, but the `frag:f1/type` text ("alt") has no target (specs.ts:191), so it stays. The messages and notes inside the fragment aren't carried either. The frame slides away from its own contents even though the drop moves them with it.
- evidence: read
- severity: low

## A Participant click on empty canvas places the new lifeline using the default 12px font, while the sequence is drawn in the theme's font
- where: packages/diagram/src/sequence/authorActions.ts:55 (firstAt)
- scenario: the scene's theme comes from tokens with `font-ui` at 16px (fromTokens.ts:49), and the user clicks with the Participant tool on empty canvas.
  - `firstAt` lays out with `sequenceLayout(data, { measure })`, with no font and no theme, so at the default 12px.
  - "Participant 1" is wider than the 60px of text room that the 80px minimum head width leaves, so the column's x depends on the font size.
  - `startSequence` → `sequenceSpecs` lays out with `themeFont(diagramThemeOf(scene))` at 16px. That gives a wider head and a column further right.
  - The lifeline ends up offset to the right of the click, though it should stand exactly at the click's x.
- evidence: read
- severity: low

## Open activations on a destroyed lifeline are closed at the diagram's foot, so the bar runs past the destruction's cross
- where: packages/diagram/src/sequence/rows.ts:251 (walkRows)
- scenario: the data is `A->>+B: call`, then `destroy B`, with no deactivate. The destroy ends B's lifeline at that row (rows.ts:247–249). The leftover open bar is still closed at `bottom + SEQ.footer`, so B's activation bar is drawn below the lifeline's end and the X, down to the foot. It should close at `line.y1`.
- evidence: read
- severity: low

## `SEQ_ARROWS` is read through the prototype chain and without a guard, so an unexpected arrow name gives a message with no line or head, or throws
- where: packages/diagram/src/sequence/authorDrags.ts:83 (arrowOf); authorSteps.ts:63 (insertMessage), :217 (setMessageArrow)
- scenario: `arrowOf` guards against an unknown name with `?? SEQ_ARROWS.sync`.
  - A params value of `'toString'` or `'constructor'` (from a stored form or a host's `toolOptionValues`) gets past that guard, because `SEQ_ARROWS['toString']` is a function. `insertMessage` spreads that function, which adds nothing, so the committed message has no `line` and no `head`.
  - `setMessageArrow(data, id, 'foo')` reads `undefined.line` and throws a TypeError.
  - These lookups should use `getOwn`, as specs.ts:135 already does for `MARKERS`.
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

<!-- done: 5 findings, files read: 24 -->