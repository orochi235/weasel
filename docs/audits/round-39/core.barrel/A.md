I couldn't write `.skulk/out/findings.md` because permission was denied, so here is the whole document.

# core.barrel findings (round 39)

No structural defect found. Every name I saw exported by two barrels resolves to the same binding: `TargetTransform`, `PRESET_CHROME`, `nodesAsShown`, `shownLookup`, and `ClipboardSnapshot`/`PasteCtx`/`PasteOmission`. No barrel, and no local module a barrel stars, re-exports a sibling package through `export *`. The bare `core/…` specifiers in scene.ts come out of the build as relative paths (dist/barrel/scene.js). One limit: the shell blocked my scripts, so the duplicate-name check was done by reading, not by a full list of names. What remains is barrel comments that describe API that doesn't exist.

## Ingestion comment calls `getContentHandlers` "deliberately not exported", but it doesn't exist
- where: packages/core/src/barrel/canvas.ts:146 (External-content ingestion block)
- scenario: a consumer reads the barrel to find out how to list the registered content handlers. The comment says `getContentHandlers` exists but is held back. No function by that name exists anywhere under packages/. The registry is exported, as `contentHandlerRegistry` at line 151, and has been reflectable since 3a0060215e. So the comment points to a name that isn't there and hides the real way in.
- evidence: read
- severity: low

## GestureSource comment tells "bare `<Canvas>` consumers" to supply their own, but `Canvas` is not exported
- where: packages/core/src/barrel/canvas.ts:115-117 (GestureSource / GesturePreviewSource export)
- scenario: the comment says `<SceneCanvas>` wires this seam and "bare `<Canvas>` consumers can supply their own". Line 7 of the same file says `Canvas` is `@internal` and not exported, so no consumer can mount a bare `<Canvas>`. A reader following the comment looks for an entry point that doesn't exist.
- evidence: read
- severity: low

## WeaselProvider heading says it mounts "all five kit-root contexts"; it mounts seven
- where: packages/core/src/barrel/canvas.ts:165 (WeaselProvider block)
- scenario: packages/core/src/WeaselProvider.tsx:58-71 nests IconRegistryScope, Deps, Actions, ActiveTool, Selection, Pointer and ToolsScope. The heading counts five. A reader working out whether they still need a separate `ToolsScope` or icon registry is working from the wrong count. They don't need either.
- evidence: read
- severity: low

## Viewport barrel lists `<MinimapCanvas>` among "the detached canvases below", but it is not exported here
- where: packages/core/src/barrel/viewport.ts:102-103 and 116-118 (Second view / Detached scene-view + minimap blocks)
- scenario: the comment calls `<MinimapCanvas>` "the opinionated minimap built on top" and one of "the detached canvases below". Nothing in this barrel exports it; it lives only in packages/minimap. A consumer who imports `MinimapCanvas` from `@weasel-js/core` on the comment's word gets an import error.
- evidence: read
- severity: low

## "Drag-action hooks: move / resize / rotate / insert / area-select" heading sits over a block with none of them
- where: packages/core/src/barrel/interactions.ts:17 (Drag-action hooks block)
- scenario: the move, resize, rotate, insert and marquee/lasso actions moved to `@weasel-js/editing` in 9566a40f92. Core keeps only `MoveOptions`/`ResizeOptions`/`RotateOptions` and the gesture primitives. The heading still promises those hooks from core, so a reader looks for them in the wrong package.
- evidence: read
- severity: low

## Files read
packages/core/src/barrel/canvas.ts
packages/core/src/barrel/chrome.ts
packages/core/src/barrel/editingSeams.ts
packages/core/src/barrel/icons.ts
packages/core/src/barrel/input.ts
packages/core/src/barrel/interactions.ts
packages/core/src/barrel/outlines.ts
packages/core/src/barrel/paint.ts
packages/core/src/barrel/paths.ts
packages/core/src/barrel/persistence.ts
packages/core/src/barrel/renderer.ts
packages/core/src/barrel/routing.ts
packages/core/src/barrel/scene.ts
packages/core/src/barrel/snap.ts
packages/core/src/barrel/viewport.ts

<!-- done: 5 findings, files read: 15 -->