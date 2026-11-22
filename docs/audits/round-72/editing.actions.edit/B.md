## A selected `'inherit'` child of a selected container is written an explicit paint, so it stops inheriting
- where: packages/editing/src/actions/edit/createPaintAction.ts:95 (writeFor), :141-146 (start, bases), :160 (inheritors filter)
- scenario: a group G with `fill: red` holds child C with `fill: 'inherit'`; the operands (or explicit `params.ids`) name both G and C, and `setFill` runs with `color: '#00f'`. C's base is resolved at start to G's old paint (red), so `merge` gives blue ≠ red and `writeFor` writes `fill: { paint: blue }` to C; C is also dropped from `inheritors` because `startData` has it. After the commit C holds its own blue fill and no longer follows G: a later fill change on G leaves C behind. The file's own rule ("an `'inherit'` node that would take the paint it already inherits is left alone, so it goes on inheriting") should apply against the paint it will inherit after this run, i.e. leave C alone when an ancestor in the same run takes the same value.
- evidence: read (outcome inferred from `baseOf`/`writeFor`/`paintInheritors`; not run)
- severity: medium

## `setFill`/`setStroke` accept any non-`undefined` `color`, unlike every numeric paint param
- where: packages/editing/src/actions/edit/setFill.ts:48,52-58 (initialState, readParams); packages/editing/src/actions/edit/setStroke.ts:54,58-64
- scenario: a caller (untyped JS, a picker emitting `color: null` on clear, or a bad binding param) passes `color: null` or a number. `initialState` keeps it (`??` only replaces `undefined`/`null` there, but `readParams` checks only `=== undefined`), so an onMove tick with `color: null` yields `{ color: null, paint: undefined }` and `merge` calls `paintWithColor(prev.paint, null)`, writing a solid paint built from `null`. The numeric siblings (`setFillOpacity`, `setStrokeOpacity`, `setStrokeWidth`, `setVertexColor`) all ignore a param that is not a valid value (`finiteOr`, `widthOf`, `rgbaOf`); the color actions answer the same question the other way.
- evidence: read
- severity: low

## Files read
packages/editing/src/actions/edit/createPaintAction.ts
packages/editing/src/actions/edit/deselect.ts
packages/editing/src/actions/edit/duplicate.ts
packages/editing/src/actions/edit/group.ts
packages/editing/src/actions/edit/ingest.ts
packages/editing/src/actions/edit/nudge.ts
packages/editing/src/actions/edit/paintActionTestUtils.ts
packages/editing/src/actions/edit/selectAll.ts
packages/editing/src/actions/edit/setFill.ts
packages/editing/src/actions/edit/setFillOpacity.ts
packages/editing/src/actions/edit/setStroke.ts
packages/editing/src/actions/edit/setStrokeOpacity.ts
packages/editing/src/actions/edit/setStrokeWidth.ts
packages/editing/src/actions/edit/setVertexColor.ts

<!-- done: 2 findings, files read: 14 -->
