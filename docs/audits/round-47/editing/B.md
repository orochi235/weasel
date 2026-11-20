I couldn't write `.skulk/out/findings.md` because the write was refused, so the whole findings document is below.

# Audit round 47: area `editing` (blind reviewer)

The commit named in the brief (`44e73a944bea29d4d56fc7883fa302daec48ecf1`) isn't in this clone. HEAD is `782733b19c` with a dirty working tree, so these findings are against the working tree as it stands. Git commands also needed approval here, so I read the code directly and used no history.

## The kit's booleansAdapter never supplies getStrokeFrame, so a counted stroke on a stretched or skewed node is outlined at uniform world width
- where: packages/editing/src/deps/booleans.ts:37 (useBooleansAdapterDepSource)
- scenario: take a path leaf whose pose has a non-uniform scale or a skew (`drawn.box.transform`), stroked with a world-unit width. Run Union on it with `strokes: 'include'`. `resolveOperand` passes `adapter.getStrokeFrame?.(id)` to `strokeRegion`. Per `strokeRegion`'s doc, the canvas draws such a stroke skewed and stretched in the node's own frame (`poseFrameOf`). This adapter already holds the box (`leafOf(id).drawn.box`) but defines no `getStrokeFrame`. The ribbon is therefore outlined in world at uniform width: too thin or too thick on the stretched axis, and not skewed. The committed result does not match the stroke that was on screen. It should return `poseFrameOf(leaf.drawn.box)`. A grep of `packages/*/src` finds no implementation of `getStrokeFrame` anywhere, so the option is declared and read but never supplied.
- evidence: read
- severity: medium

## kitSweep no longer reaches any feature preset, so the binding-id and collision tests skip every preset's ambient, contributions and tools
- where: packages/editing/src/integration/core/canvas/SceneCanvas/kitSweep.fixture.tsx:204 (sweepKit) and :62 (Sweep.value)
- scenario: the fixture says it gathers "every action, preset and contribution the packages export as a value". It sweeps only the main entries. Editing's presets now live only on `@weasel-js/editing/presets`, and core's `view`/`viewTools` only on `@weasel-js/core/presets`. Core's barrels export no preset value. The only preset container left on the editing main entry is the `FEATURE_PRESETS` record, and `value()` handles it as a "factory bundle": it looks only for the keys `contribution`, `contributions`, `ambient`, `tool` and `tools`. That record's keys are names like `'tools:select'` and `select`, so `Sweep.preset` never runs for any kit preset. Actions still arrive through `KIT_STANDARD_ACTIONS`, but each preset's `ambient({})`, `contributions`, `tools` and `includes` are not swept. A binding collision or a missing id in a preset's ambient or contribution passes `kitBindingCollisions`, `kitBindingIds` and `kitBindingPhases`. The fix is to sweep `@weasel-js/editing/presets` and `@weasel-js/core/presets` as modules.
- evidence: read
- severity: medium

## kit:svg inserts an SVG string flavor beside the SVG file it came with, making two nodes where the ghost showed one
- where: packages/editing/src/ingest/svgHandler.ts:102 (kitSvgHandler.handle)
- scenario: a drop or paste carries both an `image/svg+xml` file and `text/plain` SVG markup, which are two spellings of one copy. Both match kit:svg, and `handle` pushes every string into `files` alongside the real file. The result is two image nodes. `IngestCtx.items` exists so a handler can tell that a string rides beside a file, and text-tools' handler declines in that case (`textHandler.ts:37`: `if ((ctx.items ?? items).some((it) => it.kind === 'file')) return;`). `ghostBounds` (ghost.ts:34) likewise draws one box per file and ignores strings when there are files. kit:svg is the one handler that answers this the other way. The only guard it has is `consumedWeaselPayload`.
- evidence: read
- severity: low

## kit:weasel-json ignores a drop's point and lands dropped nodes at the paste offset
- where: packages/editing/src/ingest/weaselJsonHandler.ts:75 (kitWeaselJsonHandler.handle)
- scenario: a user drags `text/plain` weasel clipboard JSON (or an SVG carrying it) onto a canvas. `IngestCtx.point` is the world drop point; per its doc it is null only for paste. The handler assumes "`ctx.point` is null for paste" and never passes `dropPoint: ctx.point` to `materializePaste`. The nodes land at the adapter's cascade offset from where they were copied, not where they were dropped. Meanwhile `previewIngest` draws the ghost at the drop point, and the image and SVG handlers place at `ctx.point` through `arrivalBounds`. This is separate from the open Cmd+V stacking item in unruled.md:1825.
- evidence: read
- severity: low

## writeOsClipboard leaves a rejecting promised flavor unhandled when there is no clipboard API
- where: packages/editing/src/clipboard/osClipboard.ts:28 (writeOsClipboard)
- scenario: `produceFlavors` returns `{ 'image/svg+xml': warmSvg(...) }` on a page where `navigator.clipboard.write` or `ClipboardItem` is missing (an insecure origin, an older browser). The early `return` on line 30 runs before the `text.catch(...)` loop on line 33 attaches any handler. If that promise rejects, the result is an `unhandledrejection`. On every other path the function deliberately swallows flavor rejections ("Chromium leaves a ClipboardItem's rejected promise unhandled").
- evidence: read
- severity: low

## useSelection seeds `initial` only into the first `scene` store it is given
- where: packages/editing/src/selection/useSelection.ts:121 (useSelection)
- scenario: `useSelection({ scene: a, initial: ['n1'] })` re-renders with `scene: b`, where store `b` holds no selection. `seeded.current` is already true, so `b` is never seeded, even though the option's doc says "`initial` then only seeds a store that has none yet". The flag tracks a boolean rather than which store was seeded.
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