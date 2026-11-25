# Findings: labkit.part1 (round 50)

## `DragDropCapability.pickUp` is declared and documented but nothing ever calls it
- where: packages/labkit/src/instrument/types.ts:195 (DragDropCapability.pickUp)
- scenario: an instrument declares `dragDrop.pickUp` to let the user drag an existing item back out of the canvas, as the capability's doc promises ("optionally — … the ability to drag existing items back out"). No code in labkit reads `pickUp` (`useDragDrop` and `useTrialDragDrop` only use `palette`, `onDrop`, `onDragOver`), so pressing an existing item never starts a carry; the option is silently dropped.
- evidence: read (grep `pickUp` in packages/labkit/src finds only the declaration)
- severity: medium

## A drop is applied even where `onDragOver` just answered that it would be refused
- where: packages/labkit/src/dragdrop/DragDropRuntime.tsx:118 (useDragDrop, `sink.drop`)
- scenario: an instrument's `onDragOver` returns `{ ok: false, reason }` at some position; the trial draws the red "would be refused" ring there (feedbackLayer.ts). Releasing at that spot still runs `emit('canvas.itemAdded')` (taking an undo snapshot) and `setState(onDrop(...))`, so the drop the UI said would be refused lands anyway unless `onDrop` repeats the same check itself. The capability answers "is this drop accepted" in one place and the runtime ignores the answer in the other; the drop should be skipped (and no snapshot taken) when the last feedback was `ok: false`.
- evidence: read
- severity: medium

## A palette item dragged from one trial drops into any other trial's canvas, with no `onDragOver` probe there
- where: packages/labkit/src/dragdrop/DragDropRuntime.tsx:167 (paletteDropAction) / :96 (frame loop)
- scenario: a lab shows two trials whose instruments both declare `dragDrop` (different instruments, or two trials). Every trial's drop target binds the same carry type `labkit/palette-item`, and `startCarry` routes to whichever surface is under the pointer. Dragging an item from trial A's palette onto trial B's canvas: B's action calls B's `sink.over`, but B's frame loop bails because B's own `dragRef` is null, so B's `onDragOver` is never asked and no feedback ring is drawn; on release B's `sink.drop` hands A's `PaletteItem` to B's `onDrop` and snapshots B. An item from another instrument's palette (unknown `id`/`data`) reaches `onDrop`. The drop should be accepted only by the trial whose palette started the carry, or at least probed through the receiving trial's `onDragOver`.
- evidence: read (packages/routing/src/interactions/carry/carry.ts `surfaceAt` uses one global surface set; packages/labkit/src/trial/trialContent.tsx:55 mounts a target per drag-drop trial)
- severity: medium

## A palette item starts a carry on any mouse button, so a right- or middle-button drag drops an item
- where: packages/labkit/src/dragdrop/Palette.tsx:20 (Palette onPointerDown) → DragDropRuntime.tsx:134 (startDrag)
- scenario: right-press a palette item (which also opens the context menu) or middle-press it, move over the canvas and release: `startDrag` never looks at `e.button`, and `startCarry` does not filter buttons, so the release is a drop and `onDrop` inserts the item. Only a primary-button press should start a palette drag, as the dispatcher's own drags do.
- evidence: read
- severity: low

## Escape closes the outermost of two nested open lightboxes first, leaving the inner one open over a page no longer inert
- where: packages/labkit/src/lightbox/useLightboxModal.ts:44 (Escape listener)
- scenario: a `<Lightbox>` inside an expanded one (e.g. an image lightbox in an instrument inside a trial's lightbox; the expanded root is a `data-wzl-portal-host` so this is supported) is opened. Each registers a `keydown` listener on `document`; the outer one registered first, so on Escape it runs first, calls `preventDefault()` and closes the outer, and the inner one sees `defaultPrevented` and stays open. The outer's teardown then removes the `inert` it set on the rest of the page and returns focus outside, while the inner lightbox is still in the top layer. Escape should close the innermost (most recently opened) lightbox.
- evidence: read
- severity: low

## A controlled lightbox mounted `disabled` with `expanded` true opens when enabled, and its owner never hears it closed
- where: packages/labkit/src/lightbox/useLightboxState.ts:12 (useDisablingCloses)
- scenario: `<Lightbox disabled expanded onExpandedChange={…}>` on first render. `wasDisabled` starts equal to `disabled`, so the close-on-disable branch never runs: the lightbox shows closed (`expanded` is forced false) but `onExpandedChange(false)` is never called, and the owner still holds `true`. When `disabled` turns false, `expanded` becomes `true` and the lightbox opens — the reopen-on-enable that `useDisablingCloses` exists to prevent ("enabling it again does not reopen it"), and that the same props do not produce when `disabled` is set after mount.
- evidence: read
- severity: low

## Files read
packages/labkit/src/actionParamSchema.ts
packages/labkit/src/dragdrop/DragDropRuntime.tsx
packages/labkit/src/dragdrop/DragGhost.less
packages/labkit/src/dragdrop/DragGhost.tsx
packages/labkit/src/dragdrop/Palette.less
packages/labkit/src/dragdrop/Palette.tsx
packages/labkit/src/dragdrop/feedbackLayer.ts
packages/labkit/src/dragdrop/index.ts
packages/labkit/src/frames.stories.less
packages/labkit/src/icons.gen.ts
packages/labkit/src/index.ts
packages/labkit/src/instrument/defineInstrument.ts
packages/labkit/src/instrument/index.ts
packages/labkit/src/instrument/serializers.ts
packages/labkit/src/instrument/types.ts
packages/labkit/src/instrument/undo.ts
packages/labkit/src/job/index.ts
packages/labkit/src/job/types.ts
packages/labkit/src/job/useJob.ts
packages/labkit/src/kitSettings.ts
packages/labkit/src/layers/index.ts
packages/labkit/src/lightbox/Lightbox.less
packages/labkit/src/lightbox/Lightbox.tsx
packages/labkit/src/lightbox/LightboxContext.ts
packages/labkit/src/lightbox/LightboxLayers.tsx
packages/labkit/src/lightbox/index.ts
packages/labkit/src/lightbox/modal.ts
packages/labkit/src/lightbox/useLightboxModal.ts
packages/labkit/src/lightbox/useLightboxState.ts
packages/labkit/src/overview/OverviewMarks.tsx
packages/labkit/src/overview/TrialOverview.less
packages/labkit/src/overview/TrialOverview.stories.tsx

<!-- done: 6 findings, files read: 32 -->
