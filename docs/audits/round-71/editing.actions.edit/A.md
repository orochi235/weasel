## setFillOpacity / setStrokeOpacity turn a None paint back on in the default color
- where: packages/editing/src/actions/edit/setFillOpacity.ts:26 (merge); packages/editing/src/actions/edit/setStrokeOpacity.ts:26-28 (merge)
- scenario: a node set to None with `setFill { paint: null }` keeps its fill record minus `paint` (setFill.ts:20-23), or holds `fill: null`, which createPaintAction documents as "paints no fill". Dragging the opacity slider over it: `prev?.paint ?? solid(DEFAULT_FILL_COLOR)` writes a default-colored solid paint, so an opacity change makes a fill the user turned off visible. Should change only the alpha of a paint that exists, and leave a None fill unpainted. The stroke action does the same through `base.paint ?? solid(DEFAULT_STROKE_COLOR)`.
- evidence: read
- severity: medium

## setStrokeWidth handles "None stroke" two ways: `stroke: null` gets a default-colored stroke, a paint-less record stays unpainted
- where: packages/editing/src/actions/edit/setStrokeWidth.ts:59 (merge)
- scenario: a node with `stroke: null` (None) gets width 3 → `prev ?? solidStroke(DEFAULT_STROKE_COLOR)` gives it a visible default stroke. A node made None through `setStroke { paint: null }` holds `{ width: 1, … }` with no paint (setStroke.ts:20-23) → width 3 is written and the stroke stays invisible. The same user state, "no stroke paint", comes out differently depending on how None was stored. setStroke's `strokeUnderPaint` has a third rule again (a hairline only when there is neither a paint nor a width).
- evidence: read
- severity: low

## Test fake `FakeScene.get` returns `null` for a missing id, where the real scene returns `undefined`
- where: packages/editing/src/actions/edit/paintActionTestUtils.ts:17,53 (makeScene.get)
- scenario: `targetsOf` (createPaintAction.ts:71) and `rootsAmong` filter on `scene.get(id) !== undefined`. Under the fake, a stale or unknown id in `params.ids` or the selection returns `null`, which passes that filter, so the paint suites run a target list the real scene would have dropped. `enabled` then answers as if the id existed (no `NotApplicable` for an all-stale list), and tests built on this fake cannot catch a regression in that filtering. The fake should return `undefined`, as `Scene.get` does.
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

<!-- done: 3 findings, files read: 14 -->
