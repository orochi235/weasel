## Paint actions spread an `'inherit'` fill or stroke as an object, writing character-indexed garbage
- where: packages/editing/src/actions/edit/setFill.ts:19 (repaint); packages/editing/src/actions/edit/setStroke.ts:19 (repaint); packages/editing/src/actions/edit/setFillOpacity.ts:26 (merge); packages/editing/src/actions/edit/setStrokeOpacity.ts:25 (merge); packages/editing/src/actions/edit/setStrokeWidth.ts:41 (merge); packages/editing/src/actions/edit/createPaintAction.ts:70 and :130 (the `prev`/`start` handed to `spec.merge`)
- scenario: node data may hold `fill: 'inherit'` / `stroke: 'inherit'` (`INHERIT` is the string `'inherit'`, packages/paint/src/resolvePaint.ts:4; the SVG importer writes it, and `paintInheritors` in createPaintAction.ts:112 shows the action knows such nodes exist). Select such a node and run `setFill` with `color: '#ff0000'`: `repaint` returns `{ ...'inherit', paint: solid('#ff0000') }` = `{0:'i',1:'n',2:'h',3:'e',4:'r',5:'i',6:'t', paint}`, which is committed as the node's fill. `setFill` with `paint: null` (None) destructures the string into `{0:'i',…,6:'t'}`. `setFillOpacity`/`setStrokeOpacity` likewise write the index keys plus the kit *default* color (since `'inherit'.paint` is undefined), so changing only the opacity of an inherited fill also replaces its inherited color with `DEFAULT_FILL_COLOR`. `setStrokeWidth` takes `'inherit'` as truthy (`prev ?? solidStroke(...)` does not fire) and writes `{0:…,6:'t', width}` with no `paint`, so the stroke stops painting. Should treat `'inherit'` as a value of its own (resolve it, or start from the default / the inherited paint) rather than spreading it; `PaintActionSpec`'s `TValue` (`Fill`, `Stroke`) omits `Inherit`, which is why the types did not catch it.
- evidence: read (INHERIT definition, PaintData type in packages/core/src/core/scene/inheritedPaint.ts:16, and each merge function; no test in the area covers an inherit node)
- severity: high

## `setFillOpacity` / `setStrokeOpacity` write a NaN opacity for a non-finite `alpha01`
- where: packages/editing/src/actions/edit/setFillOpacity.ts:24-26; packages/editing/src/actions/edit/setStrokeOpacity.ts:23-29
- scenario: `alpha01: NaN` (a cleared numeric field, untyped JS caller) passes `pick('alpha01') ?? 1` and `params?.alpha01 ?? null`, and `paintWithAlpha` clamps with `Math.max(0, Math.min(1, NaN))`, which is `NaN`; the commit writes `paint.opacity: NaN`. Should be rejected (return `null` from `readParams`, fall back at `initialState`) as the area does elsewhere with `isFiniteNumber` (duplicate.ts:21).
- evidence: read
- severity: low

## `setStrokeWidth` writes a non-finite or negative width unchecked
- where: packages/editing/src/actions/edit/setStrokeWidth.ts:30-46
- scenario: `params.width` of `NaN`, `Infinity` or `-3` is copied straight into `stroke.width` (`readParams` only tests `!== undefined`), and committed. Same class as the opacity finding; `duplicate`'s `offsetOf` shows the area's own guard pattern.
- evidence: read
- severity: low

## `setVertexColor` splices an `rgba` of the wrong length, shifting every later anchor's color
- where: packages/editing/src/actions/edit/setVertexColor.ts:34-38 (merge)
- scenario: `rgba: [1, 0, 0]` (three channels, an untyped caller or a color picker dropping alpha) passes the guards — only `prev`, `index` and `rgba` truthiness are checked — and `next.splice(index * 4, 4, ...rgba)` removes 4 numbers but inserts 3, so `vertexColors` is no longer a multiple of 4 and every anchor after `index` reads a shifted RGBA. Non-finite channels are likewise written as-is. Should refuse an `rgba` that is not four finite numbers.
- evidence: read
- severity: low

## Paint actions stay enabled when the run would change nothing, against the 2026-11-10 ruling
- where: packages/editing/src/actions/edit/createPaintAction.ts:145-151 (enabled)
- scenario: docs/unruled.md:373 rules that an edit action that would change nothing is disabled with `NotApplicable`, its `enabled` asking the question its run answers (nudge does this with its params, nudge.ts:62). The paint actions' `enabled` only checks that operands are non-empty: `setVertexColor` on a selection with no `vertexColors` (merge returns `prev`, nothing written), or `setFill` with the color every selected node already has, reports enabled and then commits an empty batch. `enabled` receives `params` (4th argument) and could run `merge` over the operands the same way `onEnd` does.
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

<!-- done: 5 findings, files read: 14 -->
