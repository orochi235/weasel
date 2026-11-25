# Audit round 70 — editing.actions.edit

## A paint run on an `'inherit'` node that changes nothing still writes, replacing the inheritance with a concrete copy
- where: packages/editing/src/actions/edit/createPaintAction.ts:94-95 (refreshPreviews) and :167-170 (onEnd)
- scenario: a child has `fill: 'inherit'` under a group whose fill is `{ paint: solid('#ff0000') }`. Run `setFill` with `color: '#ff0000'`, or `setFillOpacity` with the inherited paint's own opacity, or `setStrokeWidth` with the inherited stroke's width. `merge` gets the resolved base (`bases`) and hands back a value equal to it. But `unchanged` compares that value with the raw start value (`startData…[dataKey]`, the string `'inherit'`), not with the base `merge` was given, so the node is previewed and committed: an undo entry for no visible change, and the child stops following later edits to the group's fill. The `merge` contract (lines 33-37: "handing back `prev`, or a value equal to it, leaves the node out") and the 2026-11-20 ruling in docs/unruled.md ("a run that would write what each node already wears … commits no undo entry") both say it should be left out. The fix is to compare against `bases.get(id)`, or against both.
- evidence: read
- severity: medium

## A paint action with explicit `ids` naming a locked node is enabled, then throws from the scene at commit
- where: packages/editing/src/actions/edit/createPaintAction.ts:64-69 (targetsOf), :184 (enabled), :165-175 (onEnd)
- scenario: a caller passes `params.ids` naming a node that is locked (by its own flag, an ancestor, or its layer). `targetsOf` filters only page structure, never locks. `enabled` answers `true` from `explicitIds(params) !== undefined` alone. `onEnd` builds `setData` for the locked node, and `commitOps` hands it to the scene, whose lock guard throws `Scene: cannot … it is locked` (packages/core/src/core/scene/lockGuard.ts:52-55). The selection path never hits this, because the selection never holds a locked id. The explicit-ids path skips that filter, so the action should either drop locked ids or report `ActionDisabledReason.Locked`, the way nudge does through `writesLocked` / `opsAnswer` (packages/editing/src/actions/lockedWrites.ts).
- evidence: read
- severity: medium

## Explicit `ids` naming missing nodes: the action stays enabled, previews nodes that don't exist, and commits nothing
- where: packages/editing/src/actions/edit/createPaintAction.ts:92-96 (refreshPreviews), :131-136 (start), :184-188 (enabled)
- scenario: `params.ids: ['gone']`, where no node `gone` exists. `start` skips it when building `startData` and `bases`, but `scratch.ids` still holds it. `refreshPreviews` then calls `merge(undefined, state)`, gets a fresh default fill, and calls `previews.set('gone', …)`, so `previewIds()` reports a node that isn't in the scene. `onEnd` skips it, so no undo entry is written. Separately, for every action without `writable`, `enabled` returns `true` whenever explicit ids are present, even `ids: []` or ids that are all missing or all page structure. `start` then returns `{}` and nothing happens, against the ruling that an edit which can change nothing is `NotApplicable`.
- evidence: read
- severity: low

## `setStrokeOpacity` on a stroke with no paint and no width writes a widthless stroke, where `setStroke` seeds width 1 in the same state
- where: packages/editing/src/actions/edit/setStrokeOpacity.ts:25-30 (merge) and packages/editing/src/actions/edit/setStroke.ts:24 (repaint)
- scenario: `setStroke` with `paint: null` on a node with no stroke leaves `stroke: {}`. Running `setStrokeOpacity` on that node gives `{ paint: solid(DEFAULT_STROKE_COLOR, α) }` with no `width`, because `base` is `{}` rather than `solidStroke(...)`. `setStroke` treats the same state (`paint == null && width === undefined`) as "no stroke yet" and seeds `width: 1`, the hairline its doc and `setStrokeOpacity`'s doc ("a node with no stroke yet gets a hairline one") both promise. So one question, what a paintless and widthless stroke turns into, has two answers.
- evidence: read
- severity: low

## `setStrokeWidth` validates `width` but passes `vertexWidths` through unchecked
- where: packages/editing/src/actions/edit/setStrokeWidth.ts:38, :43, :51 (initialState / readParams / merge)
- scenario: `width` goes through `widthOf`, which requires a finite number of zero or more. `vertexWidths` is taken as-is unless it is `undefined`. A param from untyped callers or a serialized binding (e.g. `vertexWidths: 3`) makes `merge` run `[...3]`, which throws `TypeError` inside `refreshPreviews` during `start`/`onMove`. Entries with `NaN` or negative widths are written verbatim, although the same action refuses those values for `width`. `setVertexColor` checks its `rgba` param the same defensive way (`rgbaOf`); this param gets no such check.
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
