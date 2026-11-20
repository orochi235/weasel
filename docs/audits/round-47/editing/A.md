# Audit round 47 — area `editing` — findings

## A dropped weasel payload lands at the paste cascade offset, not where it was dropped (and not where its ghost was drawn)
- where: packages/editing/src/ingest/weaselJsonHandler.ts:75-81 (kitWeaselJsonHandler.handle)
- scenario: drag nodes copied from one kit canvas (text/plain weasel JSON, or the metadata-bearing SVG flavor) and drop them on another canvas at a point. `IngestCtx.point` is the drop's world point (contentHandlers.ts:30 — non-null for drops), but `handle` never passes it to `materializePaste` as `dropPoint`, on the stated assumption that "`ctx.point` is null for paste". The nodes land at `getPasteOffset`'s cascade from their copied position. Meanwhile `previewIngest`/`ghostBounds` (ghost.ts:36-37) draws the string's ghost at `arrivalBounds(at, …)` centered on the drop point, so the preview and the result disagree. Should thread `dropPoint: ctx.point` when non-null, as `useClipboardOps.paste` does for its own drop point. The history label is also hard-wired to 'Paste' for a drop.
- evidence: read
- severity: medium

## The kit `booleansAdapter` dep never supplies `getStrokeFrame`, so a counted stroke on a skewed or non-uniformly transformed leaf is outlined in world, not as drawn
- where: packages/editing/src/deps/booleans.ts:50-83 (useBooleansAdapterDepSource)
- scenario: a path leaf whose pose carries a `transform` (skew / non-uniform scale) or sits in such a frame, stroked and unfilled; run Union/Divide with `strokes: 'unfilled'` or `'include'`. `resolveOperand` (operands.ts:71) asks `adapter.getStrokeFrame?.(id)`; this adapter has no such member, so `strokeRegion` gets `frame = undefined` and builds a uniform-width world ribbon. The painter draws that stroke in the pose's frame (`poseFrameOf(pose)`, as defaultDrawOne.ts:106-114 reads it), so the stroke is skewed/stretched on screen and the Boolean result's ink differs from what was visible. `BooleansAdapter.getStrokeFrame`'s doc says "A counted world-width stroke is skewed and stretched with it"; the kit's own adapter — the one every Pathfinder action uses by default — silently drops that. `leafOf` already has `leaf.drawn`, from which `poseFrameOf(leaf.drawn.box)` would answer it. (No non-test `getStrokeFrame` implementation exists anywhere in `packages/`.)
- evidence: read
- severity: medium

## The kit binding sweep no longer reaches any editing preset: their ambient contributions, tools and chrome bindings fell out of the binding-id and collision tests
- where: packages/editing/src/integration/core/canvas/SceneCanvas/kitSweep.fixture.tsx:26,207-223 (sweepKit)
- scenario: the fixture claims "every action, preset and contribution the packages export as a value", and finds presets by walking each package's main-entry exports. Commit 17e237baf0 (2026-11-18) removed all 33 `…Preset` names from `@weasel-js/editing`'s main entry, leaving them only on `@weasel-js/editing/presets`; the fixture was not changed. The only preset-bearing value left on the main entry is `FEATURE_PRESETS`, a plain record with no `id`, so `Sweep.value` treats it as a factory bundle, finds none of the `contribution/contributions/ambient/tool/tools` keys, and drops it. So `Sweep.preset` never runs for an editing preset: their `ambient(...)` owners, `contributions`, `tools` and `includes` are not swept. `KIT_STANDARD_ACTIONS` still brings in the presets' `actions`/`toolActions`, so action bindings survive, but a binding that lives only on a preset's ambient contribution or chrome can now collide or lose its id with the tests still green. Fix: add `@weasel-js/editing/presets` (and `@weasel-js/core/presets`) to `modules`, or sweep `FEATURE_PRESETS`' values.
- evidence: read (git show 17e237baf0 -- packages/editing/src/index.ts; fixture last touched in 0d7681b836, before it)
- severity: medium

## Repeated Cmd+V stacks every paste exactly on the first: the OS-clipboard paste path never steps the cascade
- where: packages/editing/src/ingest/weaselJsonHandler.ts:77-84 (kitWeaselJsonHandler.handle), with packages/editing/src/clipboard/materializePaste.ts:33
- scenario: copy a node at (100,100), press Cmd+V three times. Cmd+V arrives as a DOM `paste` event, which `clipboard.pasteEvent` / `ingest` route to this handler (actions/clipboard/action.ts:67-73 — `clipboard.paste` deliberately has no key binding). Each time the handler parses the same OS-clipboard payload and calls `materializePaste`, whose offset is the scene adapter's constant `getPasteOffset()` = `{DUPLICATE_OFFSET, DUPLICATE_OFFSET}` (sceneAdapter.ts:288-292). That adapter relies on "the hook re-snapshots the just-created items, so repeated pastes stack one offset further each time" — which only `useClipboard.paste` does (useClipboard.ts:85, clipboardOps.ts:76-77). The handler keeps nothing between events, so all three pastes land at (100+d,100+d), one on top of another, while the menu/button `clipboard.paste` path cascades. The module doc says the two arrival paths are "indistinguishable in history"; they also differ in label: this path hard-codes 'Paste' and ignores `useClipboardOps`' `pasteLabel`.
- evidence: read
- severity: medium

## A drop of SVG and raster files together stacks the first of each kind on one spot: each kit handler restarts the cascade at 0
- where: packages/editing/src/ingest/imageHandler.ts:61,78 (embedFilesAsImageNodes), reached from svgHandler.ts:116 and imageHandler.ts:93
- scenario: drop `a.svg` and `b.png` at one point. `kit:svg` claims the SVG and calls `embedFilesAsImageNodes([a.svg])`; `kit:image` claims the PNG and calls `embedFilesAsImageNodes([b.png])`. Each call starts `let index = 0`, so both nodes are placed by `arrivalBounds(ctx, size, 0)` — centered on the same point, one over the other. `ghostBounds` (ghost.ts:30-37) numbers the claimable files across handlers 0, 1, so the drag preview showed them cascaded and the drop does not. The cascade index needs to be per arrival (e.g. carried on `ctx`), not per handler call.
- evidence: read
- severity: low

## A copied node whose data contains the text `</metadata>` cannot be pasted back from the SVG flavor
- where: packages/editing/src/clipboard/wireFormat.ts:72 (extractWeaselClipboardFromSvg), against embedWeaselMetadataInSvg at :61
- scenario: copy a text node whose content is `see </metadata> here` with an app `produceFlavors` that embeds the payload in its SVG (`embedWeaselMetadataInSvg`). `JSON.stringify` leaves `<` and `/` unescaped, and the embed escapes only `]]>`, so the CDATA holds a literal `</metadata>`. On paste, the extraction regex `<metadata…>([\s\S]*?)</metadata>` stops at that inner occurrence, the truncated JSON fails `sniffWeaselClipboardText`, and the function returns null: `kitWeaselJsonHandler` does not match the text/plain flavor (weaselJsonHandler.ts:30-33), so `kit:svg` takes it and the paste arrives as one embedded SVG image instead of the copied nodes. The embed should also break `</` (e.g. emit `<\/` inside the JSON, which JSON.parse reads back as `</`), or the extractor should read CDATA sections before looking for the closing tag.
- evidence: read
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

<!-- done: 6 findings, files read: 42 -->
