I couldn't write `.skulk/out/findings.md` because the write needed a permission that wasn't granted. Here is the whole document:

## Canceling a Simplify slider drag leaves Sand's saved tolerance, and the slider, at the canceled value
- where: apps/draw/src/ui/PathCommands/PathCommands.tsx:47 (SimplifySlider)
- scenario: drag the Simplify slider from 2.0 to 8.0, then press Escape.
  - During the drag, `onInput` has already called `onTolerance(8)`. That writes 8 through `setToolOption` into draw's tool option values, which are saved in prefs.
  - `onCancel` is only `simplify.onCancel`. It ends the action without keeping it and drops the draft (`useActionEdit` passes `onCancel: () => edit.cancel()` to `useEditDraft`).
  - The selection goes back to how it was. But `shown` falls back to `value` (`[{ value: tolerance }]`), which is now 8. So the slider reads 8.0, Sand's options row reads 8.0, and the saved tolerance stays 8 after a reload.
  - It should put back the tolerance from before the drag.
- evidence: read
- severity: medium

## Canceling an Offset slider drag leaves the slider at the canceled distance
- where: apps/draw/src/ui/PathCommands/PathCommands.tsx:73 (OffsetSlider)
- scenario: drag Offset from its default to 20, then press Escape.
  - `onInput` has already run `setDistance(20)`, and `onCancel` is only `offset.onCancel`, which drops the draft.
  - `shown` becomes `[{ value: distance }]`, which is 20, although nothing was offset. The slider claims an offset of 20 is applied, and the next drag starts from 20.
  - A commit resets `distance` to `DISTANCE.default`, but a cancel doesn't. A cancel should reset it to the value from before the drag (the default), as a commit does.
- evidence: read
- severity: low

## Files read
apps/draw/src/svgNote.ts
apps/draw/src/svgObj.ts
apps/draw/src/svgPages.ts
apps/draw/src/testIcons.ts
apps/draw/src/testScenes.ts
apps/draw/src/theme.ts
apps/draw/src/toolOptions.ts
apps/draw/src/tools/colorContext/ColorContextProvider.tsx
apps/draw/src/tools/colorContext/actions.ts
apps/draw/src/tools/colorContext/contribution.ts
apps/draw/src/tools/colorContext/depSchemaAugmentation.ts
apps/draw/src/tools/colorContext/index.ts
apps/draw/src/ui/Fillet/Fillet.module.css
apps/draw/src/ui/Fillet/Fillet.tsx
apps/draw/src/ui/Fillet/index.ts
apps/draw/src/ui/LastOperation/LastOperation.module.css
apps/draw/src/ui/LastOperation/LastOperation.tsx
apps/draw/src/ui/LastOperation/index.ts
apps/draw/src/ui/PathCommands/PathCommands.module.css
apps/draw/src/ui/PathCommands/PathCommands.tsx
apps/draw/src/ui/PathCommands/index.ts
apps/draw/src/useDocumentState.ts
apps/draw/src/useEditorAmbient.ts
apps/draw/src/useGrid.ts
apps/draw/src/useHoldContentUnderChrome.ts
apps/draw/src/useLastTool.ts
apps/draw/src/useMachineFontOutlines.ts
apps/draw/src/usePathOverlays.ts
apps/draw/src/usePickColor.ts
apps/draw/src/useRightSidebarWidth.ts
apps/draw/src/useRulers.ts
apps/draw/src/useSessionPersistence.ts
apps/draw/src/useSpacingHints.ts
apps/draw/src/useSymmetry.ts
apps/draw/src/useTextEditSession.ts
apps/draw/src/useViewBounds.ts

<!-- done: 2 findings, files read: 36 -->