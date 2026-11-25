# Audit round 74 — labkit.part1 findings

## `DragDropCapability.pickUp` is declared and documented but nothing ever calls it
- where: packages/labkit/src/instrument/types.ts:206 (DragDropCapability.pickUp); packages/labkit/src/dragdrop/DragDropRuntime.tsx:91 (useDragDrop)
- scenario: An instrument declares `dragDrop.pickUp` so that existing items can be dragged back out of the canvas, which the interface's doc comment promises ("the ability to drag existing items back out"). Grepping `packages/labkit/src` for `pickUp` finds only the declaration. `useDragDrop` and `paletteDropAction` start a carry only from a palette pointerdown, and no hit-test anywhere calls `pickUp`. The option is dropped without any warning: a drag on an existing item does nothing, where it should pick the item up (or the field should not be offered).
- evidence: read (grep for `pickUp` across packages/labkit/src returns only types.ts:206)
- severity: medium

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

<!-- done: 1 findings, files read: 32 -->
