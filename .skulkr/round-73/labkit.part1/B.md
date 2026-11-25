# Audit round 73 — labkit.part1 findings

## `DragDropCapability.pickUp` is declared and documented but nothing ever calls it
- where: packages/labkit/src/instrument/types.ts:206 (DragDropCapability.pickUp)
- scenario: an instrument declares `dragDrop.pickUp` to drag an existing item back out, as the capability's doc promises ("the ability to drag existing items back out") → no code in labkit reads `pickUp` (grep finds only the declaration), so pressing an item on the canvas never starts a carry; the option is silently dropped
- evidence: read (grep `pickUp` over packages/labkit/src: only types.ts:206)
- severity: medium

## `DragFeedback.reason` is never shown anywhere
- where: packages/labkit/src/dragdrop/feedbackLayer.ts:14 (withDragFeedback); packages/labkit/src/instrument/types.ts:244 (DragFeedback)
- scenario: `onDragOver` answers `{ ok: false, reason: 'Slot occupied' }` → the feedback layer draws only a red ring from `fb.ok`, and the ghost shows only `item.label`; `reason` (documented as "why not if it would not") reaches no renderer, so the field is silently dropped
- evidence: read (grep for `reason` in labkit dragdrop/trial: none read it)
- severity: low

## Nested lightboxes under one `<LightboxLayers>`: closing the inner one unlifts the outer's shared layers
- where: packages/labkit/src/lightbox/modal.ts:76 (liftStack), packages/labkit/src/lightbox/useLightboxModal.ts:36
- scenario: a `<Lightbox>` inside an open `<Lightbox>`, both under one `<LightboxLayers below={[buffer]}>` (nesting is a case `openOrder` exists for) → the inner one's stack includes the same `buffer`, already showing; `showPopover()` on it is a no-op, and on close the inner's undo runs `hidePopover()` and strips `popover`, `data-lk-lightbox-layer` and `data-lk-lightbox-scrim` from `buffer` while the outer is still open → the outer loses its shared buffer layer and its scrim/backing; the undo should leave alone elements it did not itself lift
- evidence: read
- severity: low

## A drop computes `onDrop` from the last rendered state instead of the state it lands on
- where: packages/labkit/src/dragdrop/DragDropRuntime.tsx:129 (sink.drop)
- scenario: `live.setState(live.capability.onDrop(world, item, live.state, live.config))` passes a value, not an updater; a state update queued between the last render and the release (a job's `onItem` fold via `setState(prev => …)`, a clock-driven state write) is overwritten by the drop's result computed from the stale `live.state` → the queued change is lost. `setState` accepts an updater; `prev => onDrop(world, item, prev, config)` would not lose it
- evidence: read
- severity: low

## `Instrument.undo` doc names the wrong default snapshot events
- where: packages/labkit/src/instrument/types.ts:282 (Instrument.undo)
- scenario: the doc says the trial snapshots "on `state.change` and `config.change`", but `UndoCapability.snapshotOn`'s doc and `DEFAULT_SNAPSHOT_ON` (trial/useTrialSnapshot.ts:19) also include `guides.change` → a reader of `Instrument.undo` setting `snapshotOn: ['state.change', 'config.change']` to "keep the default" silently loses guide undo steps; two places answer the default differently
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
packages/labkit/src/fontCascade.fixtures.tsx
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

<!-- done: 5 findings, files read: 33 -->
