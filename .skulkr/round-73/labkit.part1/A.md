## `DragDropCapability.pickUp` is declared and documented but nothing ever calls it
- where: packages/labkit/src/instrument/types.ts:206 (DragDropCapability.pickUp)
- scenario: an instrument declares `dragDrop.pickUp` expecting "the ability to drag existing items back out" (the interface's own doc). A press on an existing item on the canvas does nothing: no source file reads `pickUp` (grep finds it only in this type and in old specs), and `useDragDrop` only starts drags from `startDrag`, which only the palette calls. The option is silently dropped. It should either be wired up (hit-test, then `pickUp`, then a carry with `canvas.itemRemoved`) or removed from the type.
- evidence: read (grep over packages for `pickUp`)
- severity: medium

## `useJob.start` calls `begin` twice, and `run` gets a state derived from a different base than the one items fold into
- where: packages/labkit/src/job/useJob.ts:121-124 (start)
- scenario: `begin` runs once inside the `setState` updater, against `prev`, which is the trial's state with every pending update applied. It runs a second time against `stateRef.current`, the last state that rendered. If `start()` is called in the same tick as another `setState`, for example from a handler that edits state and then starts the job, `run` sees `begin(stale state)` while items fold into `begin(fresh state)`. Any non-idempotent `begin` (one that bumps a counter or mints an id) also runs twice, and in StrictMode the updater runs twice more. The run's input should come from the same computation the fold uses.
- evidence: read
- severity: low

## A layer change while a lightbox is open sends focus out of the modal, then back, and records the wrong return target
- where: packages/labkit/src/lightbox/useLightboxModal.ts:32-52 (useLightboxModal layout effect)
- scenario: `LightboxLayers` gets new `below`/`above` arrays while a lightbox is open (an inline array literal, or a ref landing), or `surface` changes identity. The effect cleans up and runs again. Cleanup hides the popovers, clears `inert` and focuses `returnTo`. The re-run then captures `document.activeElement`, now that outside element (fine), but whatever the user had focused inside the lightbox is lost: focus jumps to the close button, and the stack flickers out of the top layer and back. Teardown and re-lift should not move focus when `expanded` has not changed.
- evidence: read
- severity: low

## `liftStack` leaves earlier members lifted with no undo when a later `showPopover` throws
- where: packages/labkit/src/lightbox/modal.ts:79-84 (liftStack)
- scenario: a `<LightboxLayers below={[el]}>` entry is a stale ref, so the element is detached from the document. `showPopover()` throws `InvalidStateError` partway through the `forEach`, before the undo is returned. The members already lifted keep `popover`, scrim and layer attributes and stay in the top layer. `useLightboxModal`'s layout effect throws, so `inertOutside` and the cleanup never run, and the page is left dimmed. Disconnected members should be skipped (the doc already promises null entries are skipped), or the undo should be built incrementally.
- evidence: read
- severity: low

## Palette items cannot be used from the keyboard
- where: packages/labkit/src/dragdrop/Palette.tsx:16-24 (Palette)
- scenario: each item is a `<button>` whose only handler is `onPointerDown`, and that handler also calls `preventDefault`. Tabbing to an item and pressing Enter or Space does nothing: there is no keyboard path to place an item on the canvas. The control looks operable but is not.
- evidence: read
- severity: low

## `Instrument.undo` doc lists different default snapshot events than `UndoCapability.snapshotOn`
- where: packages/labkit/src/instrument/types.ts:270-272 (Instrument.undo) vs :211-213 (UndoCapability.snapshotOn)
- scenario: `Instrument.undo` says the trial snapshots on `state.change` and `config.change`. `snapshotOn` says the default also includes `guides.change`. A reader relying on the first doc misses that guide edits create undo steps. The same question gets two answers.
- evidence: read
- severity: low

## `@weasel-js/labkit/instrument` barrel omits capability types the root exports
- where: packages/labkit/src/instrument/index.ts:3-18
- scenario: a consumer importing from the `instrument` entry gets `CanvasCapability`, `DragDropCapability` and the rest, but not `StageCapability`, `OrbitCapability` or `InstrumentList`, all of which `types.ts` defines and `src/index.ts` exports. Typing a stage or orbit instrument through that entry fails to compile. The two barrels answer "what does instrument export" differently.
- evidence: read (whether a `./instrument` subpath is published was not confirmed; package.json grep matched only dragdrop/job/overview)
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

<!-- done: 7 findings, files read: 33 -->
