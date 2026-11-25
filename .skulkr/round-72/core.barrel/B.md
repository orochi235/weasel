# core.barrel findings (audit round 72)

## The interactions barrel's file comment promises keyboard action hooks and snapping it no longer exports
- where: packages/core/src/barrel/interactions.ts:2 (file comment / @packageDocumentation)
- scenario: typedoc renders this comment as the module page for these exports. It says "Drag and keyboard action hooks, snapping, and animation", but the file exports no keyboard hook (keybindings are in `barrel/input.ts`) and no snapping (that is all in `barrel/snap.ts`). The drag-action hooks moved to `@weasel-js/editing`, and d2ce386d67 retitled the block inside the file but not this header. So a reader looking for snap sources on this module page finds none. The header should name what the file holds: origin projections, transform option types and geometry, drag gesture hooks, pointer sessions, animation and `drawnBoxes`.
- evidence: read (whole file; compared against snap.ts and input.ts)
- severity: low

## The chrome barrel's selection-chrome heading promises "what draws and hit-tests it", but only option types are exported
- where: packages/core/src/barrel/chrome.ts:129 (section comment)
- scenario: 9246f9711b moved the selection chrome into `@weasel-js/editing`. The block under this heading now exports only types (`SelectionChrome`, the `*LayerOptions` types, `SelectionHandleStyle`, `PointRegionShape`), with nothing that draws or hit-tests. A consumer reading the heading looks in core for the selection layer factories and finds none, and the heading never names editing as their home.
- evidence: read (block at lines 129–139; git log shows the move)
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

<!-- done: 2 findings, files read: 15 -->
