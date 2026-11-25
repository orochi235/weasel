# Audit round 33 — apps.draw findings

## Node extractor finds no variants: NodeBase/MarkNode/GroupNode/Node now live in nodeTypes.ts, scene/types.ts only re-exports them
- where: apps/draw/vite-plugin-trait-schemas/extract-node.ts:24-55 (extractNode)
- scenario: `packages/core/src/core/scene/types.ts:64-65` is `import type { … } from './nodeTypes'; export type { … }`. ts-morph's `sf.getInterface('NodeBase')`/`getInterface('MarkNode')`/`getTypeAlias('Node')` see only declarations in the file, so all return undefined → the index ships `{ kinds: [], variants: [] }` with source line 1, silently (no throw, so `safe` doesn't even warn). The Bundle Inspector's SceneNode panel is empty instead of showing the mark/group union. Should read `nodeTypes.ts` (or resolve the export via `getExportedDeclarations`).
- evidence: read
- severity: medium

## watchedFilesFor lists two deleted files and omits the files the extractors actually read, so dev HMR never refreshes the schema index for them
- where: apps/draw/vite-plugin-trait-schemas/extract.ts:24-41 (watchedFilesFor); apps/draw/vite-plugin-trait-schemas.ts:37-46
- scenario: `packages/core/src/canvas/SceneCanvas/useBuiltinShapeTools.tsx` and `packages/core/src/interactions/actions/registry.tsx` no longer exist. The shape extractor reads `packages/editing/src/presets/tools.ts` (extract-shapes.ts:24) and the node types live in `packages/core/src/core/scene/nodeTypes.ts`; neither is watched. Editing tools.ts during `dev:draw` leaves `cached` populated and the inspector shows the stale shape schema until the server restarts. The list is a hand copy of the extractors' SOURCE constants and has drifted; it should be derived from them.
- evidence: read
- severity: low

## Gesture catalog lists a nonexistent 'pointerdown' kind and omits six real GestureSpec kinds
- where: apps/draw/vite-plugin-trait-schemas/extract-gestures.ts:14-18 (GESTURE_IDS)
- scenario: the real kinds are `GestureSpec['kind']` (packages/gestures/src/grammar/specKinds.ts:8-25): key, keyHeld, wheel, pinch, click, doubleClick, contextMenu, longPress, drag, pointerDown, hover, multiTouch, multiTouchTap, drop, carry, paste (plus route names keyDown/keyUp/dblTap). The inspector shows a `pointerdown` entry no binding can use, and no entry for contextMenu, longPress, hover, drop, carry or paste. Hard-coded list, nothing checks it against the union.
- evidence: read
- severity: low

## Op catalog reads a fixed 7-file list and misses most op factories core exports
- where: apps/draw/vite-plugin-trait-schemas/extract-ops.ts:22-30 (SOURCES)
- scenario: core's ops directory also exports createSetDataOp, createSetHiddenOp, createSetLockedOp, createSetLayoutOp, createSetLayerOp, createSetDependsOnOp, createArrangeOp, createReorderOp, createMoveToIndexOp, createSetChildOrderOp (setData.ts, nodeFlags.ts, setLayout.ts, setLayer.ts, setDependsOn.ts, arrange.ts, reorder/*). None appear in the inspector's op list. The extractor should walk `ops/index.ts`'s exported declarations (that file is in the watch list, but nothing reads it).
- evidence: read
- severity: low

## Type-alias op args always yield an empty params list: getChildrenOfKind on a TypeLiteral never sees its members
- where: apps/draw/vite-plugin-trait-schemas/extract-ops.ts:96-101 (propertiesFromDecl)
- scenario: ts-morph `getChildren*` return the compiler's raw children, and a TypeLiteral's raw children are `{`, a SyntaxList, `}`; the PropertySignatures sit inside the SyntaxList. `aliasTypeNode.getChildrenOfKind(SyntaxKind.PropertySignature)` is therefore always `[]`, so any op whose args are `type X = { … }` shows no parameters. Should use `getMembers()` or `forEachChild` (as `propertiesOfTypeNode` in extract.ts does). No current op in the 7 files uses an alias, so latent today.
- evidence: read (ts-morph getChildren semantics from knowledge; not executed)
- severity: low

## Shape extractor's makeLeaf model is obsolete: every shape comes out empty, and polygon/star report a callback as shape data
- where: apps/draw/vite-plugin-trait-schemas/extract-shapes.ts:39-82 (extractShapes)
- scenario: `packages/editing/src/presets/tools.ts` has no `makeLeaf` call anywhere; its bindings are `rect: createRectTool(insert)`, `polygon: createPolygonTool({ ...insert, onCountChange })` etc. (lines 50-54). So rect/ellipse/line get empty pose/data with note "no createable literal found"; polygon and star fall to the object-literal branch, where the spread is skipped and the shorthand `onCountChange` becomes `data: [{ name: 'onCountChange', type: 'unknown' }]` with `renderer: 'PATH_PAINTER'` and a note blaming useInsertDepSource. `lasso` (line 34, a selection tool) is listed as a shape kind; pencil/pen/text are not in the file and vanish. The inspector's shape panel is wrong for every entry. Should read the insert dep's node factories instead.
- evidence: read
- severity: medium

## Action extractor drops every action declared through defineAction or a factory, leaving only undo/redo
- where: apps/draw/vite-plugin-trait-schemas/extract-actions.ts:34-43,71-93 (extractActions, unwrapObjectLiteral)
- scenario: of the barrel's exports, viewportWheelPanAction, containerScrollAction and viewportDragPanAction are `defineAction({ … })` calls (a CallExpression, which unwrapObjectLiteral returns null for), and touchZoomAction and viewportZoomAction are `createXAction()` calls; all are skipped silently. The catalog shows two actions. The move/resize/rotate/clone/insert/marquee/lasso/clear-selection actions moved to `@weasel-js/editing` (9566a40f92) and the extractor reads only core's barrel, so they are missing as well. Should unwrap `defineAction(arg)` to its argument and read editing's actions barrel too.
- evidence: read
- severity: medium

## Callback-source plugin still targets core's tool and action dirs; the actions and tools that moved to editing get no source links
- where: apps/draw/vite.config.ts:47-51 (callbackSourcePlugin includeDirs)
- scenario: with `WEASEL_CALLBACK_SOURCE=1`, only `packages/core/src/tools`, `packages/core/src/interactions/actions` and `apps/draw/src` are rewritten. The shape tools (`packages/editing/src/tools`), the move/resize/rotate/insert/marquee/lasso actions (`packages/editing/src/actions`, moved there in 9566a40f92) and routing's tool-offhand action (`packages/routing/src/interactions/actions`) are not, so `sourceOf` (apps/draw/src/dev/registryProbe.tsx:271) finds no `__source` and the inspector shows no "open in editor" link for their `enabled`/`invoker.*`/`onActivate` callbacks, which is most of what draw registers.
- evidence: read
- severity: low

## The draw `rotation` glyph's arrowhead points down while its arc arrives travelling right
- where: apps/draw/icons/actions.mjs:69-73 (ACTIONS.rotation)
- scenario: `M16 10 A 6 6 0 1 0 10 16` has sweep-flag 0, so it runs counter-clockwise on screen from (16,10) over the top and left and reaches (10,16) at the bottom of the circle moving +x. The head `M10 16 L8 14 M10 16 L12 14` has both barbs above the tip, so it points straight down, 90° off the stroke's direction, and it sits directly on the end of the curve with no straight run. docs/icons.md "Drawing rules" requires the head to sit on a straight run along the travel direction. It should be barbs at (8,14)/(8,18) or equivalent, after a short straight run.
- evidence: read (geometry computed by hand)
- severity: low

## 16 of draw's 21 glyphs are named nowhere, and the text-styling ones duplicate core's differently drawn copies
- where: apps/draw/icons/actions.mjs:19-113 (width, height, fontSize, bold, italic, underline, strikethrough, opacity, strokeWidth, rotation, cornerRadius, letterSpacing, lineHeight, position, fill, stroke)
- scenario: apps/draw/src names only `symmetry`, `releaseCompound`, `settings`, `record` and `playRecording` (appCommands/actions.tsx, recording/contribution.tsx). The rest appear only in the generated icons.gen.ts / icons.table.json. bold/italic/underline/strikethrough also exist as `core:*` (packages/core/icons/text.mjs:21-30, which docs/icons.md assigns text styling to), drawn differently: draw's versions are `<text>` elements that render in whatever system font is present, core's are paths. A draw caller writing `icon('bold')` gets the font-dependent duplicate instead of core's glyph. They should be deleted.
- evidence: read (grep for `icon('<name>'` and `draw:<name>` across apps/ and packages/)
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

<!-- done: 10 findings, files read: 14 -->
