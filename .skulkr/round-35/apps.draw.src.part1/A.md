# Audit round 35 — apps.draw.src.part1

## drawBooleansAdapter hands Pathfinder page-local geometry as "world", so a boolean across pages lands wrong
- where: apps/draw/src/booleansAdapter.ts:11-15 (worldPathOf), :6-8 (outlineAt), :40-52 (createPathNode)
- scenario: draw's content lives under page nodes (`createPageRun` adds each page as a non-envelope group posed in the run's frame, so `definesFrame` is true and a child's pose is stored relative to its page). `worldPathOf` returns `pathInWorld(node.data.path, node.pose)` from the stored pose alone, and `outlineAt` reads `sceneNodeOutline`, which also goes by `node.pose` — neither composes the parent frame (`nodeFrameOf` / `scenePoseFrame(...).parentWorld`), as the kit's own slice dep does (`packages/core/src/canvas/deps/slice.ts:66`, `frame.world(node.id)`). Select a shape on page 1 and an overlapping-in-view shape on page 2 (a marquee across the gap, or shift-click) and run Union/Subtract/Divide: the page-2 operand is read at its page-local coordinates, as if it sat on page 1, so the result's geometry is wrong, and `createPathNode` then poses that mixed-frame path under the topmost source's parent. The `BooleansAdapter.getWorldPath` contract asks for world space. Expected: compose each operand into world (and localize the result into its new parent's frame), or refuse operands from different frames.
- evidence: read (booleansAdapter.ts; core pageNodes.ts:191-218, effectivePose.ts:355 definesFrame, nodeFrame.ts:24-36, slice.ts:66; booleansAdapter.test.ts only uses identity-posed groups at 0,0)
- severity: medium

## A layer row's gradient chip samples the midpoint in RGB and at full alpha, not in the gradient's own blend space
- where: apps/draw/src/LayersPanel.tsx:48-53 (paintChipColor)
- scenario: a fill `{ kind: 'linear', interpolate: 'oklch', stops: [blue, yellow] }` (or any gradient with `interpolate` set, or a paint-level alpha). `paintChipColor` calls `sampleGradientStops(fill.stops, 0.5)`, whose space defaults to `'rgb'`, so the chip shows the grey-ish RGB midpoint while the canvas and every other preview draw the ramp in its declared space (`packages/paint/src/paintPreview.ts:64-67` passes `paint.interpolate ?? 'rgb'` and fades by `paintAlpha(paint)`). Expected: the chip samples with `fill.interpolate` and the paint's alpha, as the paint previews do.
- evidence: read (LayersPanel.tsx; paint/src/gradient.ts:78; paint/src/paintPreview.ts:63-67)
- severity: low

## Files read
apps/draw/src/ActiveSwatches.tsx
apps/draw/src/App.tsx
apps/draw/src/CommandBar.stories.tsx
apps/draw/src/CommandBar.tsx
apps/draw/src/Editor.tsx
apps/draw/src/EditorStatusBar.tsx
apps/draw/src/LayersPanel.tsx
apps/draw/src/LoupeProvider.tsx
apps/draw/src/RightSidebar.tsx
apps/draw/src/Toolbar.tsx
apps/draw/src/Workspace.tsx
apps/draw/src/adapterPublishers.tsx
apps/draw/src/app.css
apps/draw/src/appCommands/actions.tsx
apps/draw/src/appCommands/depSchemaAugmentation.ts
apps/draw/src/appCommands/index.ts
apps/draw/src/booleansAdapter.ts
apps/draw/src/colorMode.tsx
apps/draw/src/constraintKeys.ts
apps/draw/src/docBackground.ts
apps/draw/src/docPersistence.ts
apps/draw/src/documentUnits.ts
apps/draw/src/drawDocument.ts
apps/draw/src/drawFeatures.ts
apps/draw/src/drawPrefsDialog.tsx
apps/draw/src/exportPage.ts
apps/draw/src/fileCommands.ts
apps/draw/src/fileNotices.ts
apps/draw/src/firstRunNotice.ts
apps/draw/src/fonts.ts
apps/draw/src/icons.gen.ts
apps/draw/src/icons.table.ts
apps/draw/src/loupePrefs.ts
apps/draw/src/main.tsx
apps/draw/src/menuBar.ts
apps/draw/src/menus.ts
apps/draw/src/newShapePaint.ts
apps/draw/src/nodeKinds.ts

<!-- done: 2 findings, files read: 38 -->
