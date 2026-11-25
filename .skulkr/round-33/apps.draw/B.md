# Audit round 33, area apps.draw — findings

## Trait-schema watcher watches two paths that no longer exist and misses the files the extractors actually read
- where: apps/draw/vite-plugin-trait-schemas/extract.ts:24 (watchedFilesFor)
- scenario: `packages/core/src/canvas/SceneCanvas/useBuiltinShapeTools.tsx` and `packages/core/src/interactions/actions/registry.tsx` are gone from the tree. Meanwhile extract-shapes reads `packages/editing/src/presets/tools.ts` and extract-node's types now live in `packages/core/src/core/scene/nodeTypes.ts`, and neither is watched. Edit either one with the dev server running → `cached` is never cleared, no full reload fires, and the Bundle Inspector keeps showing stale schemas until the server restarts. It should watch the files each extractor reads (ideally the extractors should export their source lists so the two can't drift apart).
- evidence: read (`ls` confirms both paths are missing; extract-shapes.ts:24 SOURCE)
- severity: low

## extract-node reads a file that only re-exports the node interfaces, so the SceneNode schema is always empty
- where: apps/draw/vite-plugin-trait-schemas/extract-node.ts:24-36 (extractNode)
- scenario: `NodeBase`, `MarkNode`, `GroupNode` and `Node` are declared in `packages/core/src/core/scene/nodeTypes.ts`. `scene/types.ts:64-65` only imports and re-exports them. `sf.getInterface('MarkNode')` on types.ts returns undefined (it only finds local declarations), so every variant hits `continue`. The result is `{ kinds: [], variants: [] }` with a source line of 1, and it never throws, so `safe` doesn't log anything. It should read nodeTypes.ts, or resolve the exported declarations.
- evidence: read (grep: interfaces at nodeTypes.ts:14,111,119,126; types.ts has only the re-export)
- severity: medium

## extract-shapes finds no shape data for any kit shape: the editing preset calls `createXTool(insert)` and never `makeLeaf`
- where: apps/draw/vite-plugin-trait-schemas/extract-shapes.ts:43-79 (extractShapes)
- scenario: In `packages/editing/src/presets/tools.ts`, each binding is `rect: createRectTool(insert)` (and likewise for the other shapes). There is no `makeLeaf` call and no object literal, so rect/ellipse/line/polygon/star all get empty pose and data, no renderer, and the note "no createable literal found — selection-only or fully delegated". That note is wrong: these are the creating tools. The 9566a40f92 retarget changed SOURCE but kept the makeLeaf walk. `lasso: createLassoTool(ctx.toolOptions.lasso ?? {})` matches the `{}` fallback, so the select-only lasso shows up as a shape kind with the note "pose is synthesized outside this hook". pencil, pen and text have no binding in the file and are dropped without notice. The shapes panel therefore holds no real information.
- evidence: read (tools.ts:27-55)
- severity: medium

## extract-actions catalogs only undo and redo: `defineAction({...})` and factory calls aren't unwrapped, and editing's actions aren't read at all
- where: apps/draw/vite-plugin-trait-schemas/extract-actions.ts:42,71-93 (extractActions / unwrapObjectLiteral)
- scenario: `unwrapObjectLiteral` only looks through `as`, `satisfies` and parentheses. In the barrel `packages/core/src/interactions/actions/defaults/index.ts`, `containerScrollAction`, `viewportDragPanAction` and `viewportWheelPanAction` are `defineAction({...})` calls. `touchZoomAction` and `viewportZoomAction` are `createXAction()` calls. All five are skipped without notice. Only `undoAction` and `redoAction` (plain literals) come out. Separately, 9566a40f92 moved move, resize, rotate, clone, insert, marquee, lasso and clear-selection to `@weasel-js/editing`, and the extractor still reads only core's barrel. The inspector's actions catalog shows 2 entries. It should show every built-in action: unwrap `defineAction(arg0)`, and read editing's barrel too.
- evidence: read (defaults/index.ts; viewportDragPan.ts:67, containerScroll.ts:132, viewportWheelPan.ts:11, touchZoom.ts:97, viewportZoom.ts:227, undoRedo.ts:13,32)
- severity: medium

## The gesture catalog lists kinds no spec has and leaves out six that exist
- where: apps/draw/vite-plugin-trait-schemas/extract-gestures.ts:14-18 (GESTURE_IDS)
- scenario: `GestureSpec` (`packages/gestures/src/ui/spec.ts:307`) has the kinds key, keyHeld, wheel, pinch, click, doubleClick, contextMenu, drag, pointerDown, hover, longPress, multiTouch, multiTouchTap, drop, carry and paste. The catalog offers `dblTap`, `keyDown`, `keyUp` and `pointerdown` (which is an InputEvent kind, not a spec kind), which a binding can't use. It leaves out contextMenu, hover, longPress, drop, carry and paste. It also reads `PointerState` from core's `gestures/types.ts` while the spec union lives in `@weasel-js/gestures`. The 'drag' payload `{transform: GroupTransform}` is the move behavior's input, not the drag gesture's payload. The inspector teaches binding kinds that don't exist.
- evidence: read
- severity: low

## callback-source plugin never tags editing's tools and actions, which moved out of the include dirs
- where: apps/draw/vite.config.ts:47-51 (callbackSourcePlugin includeDirs)
- scenario: With `WEASEL_CALLBACK_SOURCE=1 npm run dev:draw`, the plugin rewrites only `packages/core/src/tools`, `packages/core/src/interactions/actions` and `apps/draw/src`. The move, resize, rotate, clone, insert, marquee and lasso actions and all the shape tools now live in `packages/editing/src/{actions,tools}` (9566a40f92), and the dispatcher lives in `packages/routing`. Callbacks from there get no `__source`, so the inspector's callback rows lose their "open in editor" links for most of what draw binds. The list should include editing (and routing). Also, the prefix test `id.startsWith(d)` has no trailing `/`, so `.../tools` also matches a sibling such as `.../toolsX`.
- evidence: read (vite.config.ts; vite-plugin-callback-source.ts:125)
- severity: low

## The `rotation` glyph's arrowhead points down while the arc arrives moving right
- where: apps/draw/icons/actions.mjs:69-73 (ACTIONS.rotation)
- scenario: `M16 10 A 6 6 0 1 0 10 16` is centered at (10,10) and runs counter-clockwise (sweep 0) the long way round: through the top and the left, arriving at the bottom (10,16). There its direction of travel is +x (rightward). The head `M10 16 L8 14 M10 16 L12 14` has barbs trailing up, so it points down, square to the motion. It reads as a hook rather than a rotate arrow. It also breaks docs/icons.md "An arrowhead goes on a straight run": the head sits on the arc's end with no straight run behind it. It should end the arc early and carry a right-pointing head (barbs trailing left) on a short horizontal run.
- evidence: read
- severity: low

## Files read
apps/draw/icons/actions.mjs
apps/draw/icons/index.mjs
apps/draw/tests-e2e/asset-editor.spec.ts
apps/draw/tests-e2e/delete-undo-zorder.spec.ts
apps/draw/tests-e2e/playwright.config.ts
apps/draw/vite-plugin-callback-source.ts
apps/draw/vite-plugin-trait-schemas.ts
apps/draw/vite-plugin-trait-schemas/extract-actions.ts
apps/draw/vite-plugin-trait-schemas/extract-gestures.ts
apps/draw/vite-plugin-trait-schemas/extract-node.ts
apps/draw/vite-plugin-trait-schemas/extract-ops.ts
apps/draw/vite-plugin-trait-schemas/extract-shapes.ts
apps/draw/vite-plugin-trait-schemas/extract.ts
apps/draw/vite.config.ts

<!-- done: 7 findings, files read: 14 -->
