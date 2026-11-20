# Findings — labkit.part1

## `DragDropCapability.pickUp` is declared and documented but nothing ever calls it
- where: packages/labkit/src/instrument/types.ts:195 (DragDropCapability.pickUp)
- scenario: an instrument declares `dragDrop.pickUp` to let items already on the canvas be dragged back out, as the interface's doc ("the ability to drag existing items back out") promises → pressing an existing item never consults `pickUp`; no code in labkit reads it (`grep pickUp packages/labkit/src` finds only the declaration). The option is silently dropped; either it should be wired (a press on the canvas hit-tests, calls `pickUp`, starts a carry with the returned item and applies the returned state) or removed from the type and its doc.
- evidence: read
- severity: medium

## A palette item dragged from one trial drops into any other trial's canvas, through that trial's `onDrop`, with no `onDragOver` feedback
- where: packages/labkit/src/dragdrop/DragDropRuntime.tsx:167 (paletteDropAction) / :28 (PALETTE_CARRY_TYPE)
- scenario: a lab shows two trials, A and B (different instruments, or the same one), each with `dragDrop`. Every trial's `PaletteDropTarget` binds a carry action for the one shared type `'labkit/palette-item'`, and the action takes whatever `ctx.carry.value` holds. Drag an item from A's palette and release it over B's canvas → B's dispatcher takes the carry and B's sink calls `B.dragDrop.onDrop(world, itemFromA, B.state, B.config)`, so B's instrument receives an item from a palette it never offered (an unknown `id`, foreign `data`), which can corrupt B's state or throw. Meanwhile B's `sink.over` runs against B's own `dragRef`, which is null (the drag lives in A's hook), so B never probes `onDragOver` and no accept/refuse ring is drawn — the drop is accepted with no feedback, and A's ring/ghost state never sees it. Expected: a drop is taken only by the trial (or the instrument) whose palette the carry came from — e.g. a per-hook carry type or an origin check on `ctx.carry.value` — and refused elsewhere.
- evidence: read
- severity: medium

## A drag that starts inside an open lightbox's content and is released over the margin closes the lightbox
- where: packages/labkit/src/lightbox/Lightbox.tsx:123 (onClick)
- scenario: open a `<Lightbox>` around DOM content (a Stage instrument's HTML, a table); press inside the frame, drag (e.g. selecting text, or any drag not using pointer capture) and release on the dimmed margin. The browser fires `click` at the nearest common ancestor of the press and release targets — the lightbox root — so `e.target === e.currentTarget` holds and `set(false)` closes the expanded view in the middle of the user's interaction. Expected: only a press *and* release on the margin closes it (track the pointerdown target, as dialogs' "click outside" usually does).
- evidence: read
- severity: low

## With one lightbox open inside another, Escape closes the outer one instead of the inner
- where: packages/labkit/src/lightbox/useLightboxModal.ts:44 (Escape effect)
- scenario: a `<Lightbox>` (e.g. an image) inside a trial that is itself inside an expanded `<Lightbox>` tile; open the inner one. Both lightboxes listen for `keydown` on `document` in the bubble phase; the outer registered first (it opened first), so its handler runs first, calls `preventDefault()` and closes the outer lightbox; the inner sees `defaultPrevented` and stays open, now lifted in the top layer over a page whose outer modal was torn down. Expected: Escape closes the innermost (most recently opened) lightbox only — e.g. listen on the root element, or keep a stack and let only the top one act.
- evidence: read
- severity: low

## A job's `run` is handed the state from before `begin`, not the state its items fold into
- where: packages/labkit/src/job/useJob.ts:127-131 (start)
- scenario: a job declares `begin` to clear the previous run's results and its `run` reads `state` (to skip work already present, or to size its total). `start` queues `setState(prev => begin(prev, config))` but passes `state: stateRef.current` — the pre-`begin` state — to `run`. The run therefore sees the last run's results that `begin` is about to clear, may skip them, and its items fold into the cleared state, leaving them missing. Expected: `run` receives `begin(stateRef.current, startConfig)` — the state the run actually starts from, as `begin`'s doc ("the state a run folds its items into, from the state as it starts") describes.
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

<!-- done: 5 findings, files read: 32 -->
