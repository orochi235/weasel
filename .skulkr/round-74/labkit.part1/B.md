## `DragDropCapability.pickUp` is declared but nothing ever calls it
- where: packages/labkit/src/instrument/types.ts:206 (DragDropCapability.pickUp)
- scenario: an instrument declares `dragDrop.pickUp` to drag an existing item back off the canvas, as the capability's doc promises ("optionally … the ability to drag existing items back out"). No code in `packages/labkit/src` reads `pickUp` (grep finds only the type and old specs); `useDragDrop` only starts carries from the palette. A press on a placed item never calls `pickUp`, never emits `canvas.itemRemoved`, and the option is silently dropped. It should either be wired into the canvas press path or be removed from the public type.
- evidence: read (grep over packages/labkit/src for `pickUp`)
- severity: medium

## Closing a nested lightbox clears the surface scope its still-open outer lightbox set
- where: packages/labkit/src/lightbox/useLightboxModal.ts:44 (useLightboxModal, lift effect cleanup)
- scenario: a labkit surface (shared tiled buffer) sits above two nested `<Lightbox>`es; `openOrder` and `liftStack`'s "already lifted by an outer lightbox" path show nesting is supported. The outer one opens and calls `surface.scope(outerStack)`. The inner one opens and calls `surface.scope(innerStack)`. When the inner one closes, its cleanup calls `surface.scope(null)`. The surface has a single scope slot (`useTiledSurface.test.tsx`: `scope(null)` brings every tile back into scope), so every tile outside the outer lightbox starts painting into the shared buffer over the outer lightbox again. The cleanup should restore the scope that was there before, not clear it.
- evidence: read
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

<!-- done: 2 findings, files read: 32 -->
