# Audit round 69 — area `editing` (blind reviewer)

## The canvas booleans adapter copies the source's `vertexColors` (and the rest of its data) onto every result, sized for a path the result no longer has
- where: packages/editing/src/deps/booleans.ts:75 (useBooleansAdapterDepSource → createPathNode)
- scenario: a path leaf with per-vertex fill colors (`data.vertexColors`, set by `setVertexColor`) is united, divided or trimmed with another shape. `createPathNode` builds the result's data as `{ ...rest, ...paint, path }` or `{ ...source.data, path }`, so the result keeps the source's `vertexColors` array, whose length and order belong to the source's vertices. The result path has a different vertex count. The canvas renderer stages vertex colors whenever the array is non-empty (`renderer/src/draw/pathPaint.ts:58`, no length check), so the result is drawn with colors that index the wrong vertices or run short. Only `createPathLayer` checks the length and drops a mismatch. The result should drop per-vertex data, as it already drops `fill`/`stroke` when the operation hands it a paint. The same blind copy also carries a polygon's or star's `generator` onto a piece. `settleShapeGenerator` refuses that generator later, but the properties panel still shows sides/points rows for it.
- evidence: read (the copy in deps/booleans.ts; the renderer's missing length check is read, and what it draws with a mismatched array is inferred)
- severity: medium

## A weasel paste that makes nothing lets kit:svg paste the same copy's SVG flavor as an image
- where: packages/editing/src/ingest/weaselJsonHandler.ts:89 (kitWeaselJsonHandler.handle)
- scenario: a copy from a kit canvas carries the weasel JSON flavor and a `text/plain` SVG flavor. The user copies an edge alone, so its endpoints are not copied, or a payload with one malformed item, which is ruled to paste nothing (unruled.md, 2026-11-18). Then they press Cmd+V. `materializePaste` returns null, either because `commitPaste` made nothing or because it omitted everything, and the handler returns before `ctx.consumedWeaselPayload = true`. Every decline path above it also returns before the flag is set: a parse failure, the "vanished" extraction. `kit:svg` runs next (priority -90) and finds the flag unset. If the SVG flavor carries no embedded metadata, kit:svg turns the `text/plain` SVG into a `pasted.svg` file and inserts it as an image node. Result: the paste the user was told omitted those nodes (`onOmitted`) still inserts a picture of them. A weasel payload that was recognized and parsed should mark the copy consumed even when the paste makes nothing.
- evidence: read (handler order and the flag's write position read; that draw's text/plain flavor lacks metadata in some configurations is inferred)
- severity: low

## Counting strokes changes whether an outline that inks nothing is an operand
- where: packages/editing/src/booleans/operands.ts:80 (resolveOperand)
- scenario: with `strokes: 'ignore'`, an outline node whose path is empty (say, text holding only spaces) is not an operand: `whole.commands.length > 0` is checked and `undefined` is returned. With `'unfilled'` (the built-in Pathfinder's `PATHFINDER_STROKES`) or `'include'`, the branch only checks `inks.length === 0`. If `parts()` returns parts whose paths are empty, the node becomes an operand with an empty path. So the same selection answers two ways. `countOperands`, which runs under `'ignore'`, does not count the node, while the run does. Under the run, Intersect with that node returns `empty-result` where the `'ignore'` path would intersect the remaining shapes, and Subtract can take the empty node as the back operand. The strokes branch should drop an operand whose combined ink has no commands, as the ignore branch does.
- evidence: read (whether a text painter's `parts()` yields empty-path parts for blank glyphs is inferred)
- severity: low

## Files read
packages/editing/src/actionGroups.ts
packages/editing/src/actionParamSchema.ts
packages/editing/src/booleans/booleans.ts
packages/editing/src/booleans/commit.ts
packages/editing/src/booleans/custom.ts
packages/editing/src/booleans/index.ts
packages/editing/src/booleans/operands.ts
packages/editing/src/booleans/pieces.ts
packages/editing/src/booleans/placement.ts
packages/editing/src/booleans/useBooleans.ts
packages/editing/src/booleans/useBooleansAdapter.ts
packages/editing/src/clipboard/clipboardOps.ts
packages/editing/src/clipboard/index.ts
packages/editing/src/clipboard/materializePaste.ts
packages/editing/src/clipboard/osClipboard.ts
packages/editing/src/clipboard/useClipboard.ts
packages/editing/src/clipboard/wireFormat.ts
packages/editing/src/deps/areaSelect.ts
packages/editing/src/deps/booleans.ts
packages/editing/src/deps/insert.ts
packages/editing/src/deps/lassoSelect.ts
packages/editing/src/deps/presetDeps.tsx
packages/editing/src/deps/resizePolicy.ts
packages/editing/src/engine.ts
packages/editing/src/engineStandardActions.ts
packages/editing/src/groups.ts
packages/editing/src/icons.gen.ts
packages/editing/src/icons.table.ts
packages/editing/src/index.ts
packages/editing/src/ingest/ghost.ts
packages/editing/src/ingest/imageHandler.ts
packages/editing/src/ingest/kitHandlers.ts
packages/editing/src/ingest/svgHandler.ts
packages/editing/src/ingest/weaselJsonHandler.ts
packages/editing/src/integration/core/canvas/SceneCanvas/kitActionParams.allow.ts
packages/editing/src/integration/core/canvas/SceneCanvas/kitSweep.fixture.tsx
packages/editing/src/integration/interactions/actions/pbt.fixture.ts
packages/editing/src/namedPresets.ts
packages/editing/src/presets.ts
packages/editing/src/selection/useSelection.ts
packages/editing/src/test-seams.ts
packages/editing/src/useStandardActions.ts

<!-- done: 3 findings, files read: 42 -->
