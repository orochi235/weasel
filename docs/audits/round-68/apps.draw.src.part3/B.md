# Audit round 68 — apps.draw.src.part3

## Canceling a Simplify slider drag leaves Sand's tolerance pref at the canceled value, and the slider shows it
- where: apps/draw/src/ui/PathCommands/PathCommands.tsx:52 (SimplifySlider)
- scenario: drag the Simplify slider from 1.0 to 4.0, press Escape. `onInput` called `onTolerance(4.0)` on every preview, writing the `tools.sand.tolerance` pref. `simplify.onCancel` cancels the action and reverts `useActionEdit`'s draft to `value` — but `value` (`[{ value: tolerance }]`) is now 4.0, so the canvas preview is undone while the slider and the Sand brush's tolerance stay at 4.0. Should: the tolerance follows the edit's commit (write it in `onChange`, or restore the pre-drag value in `onCancel`). It also writes the pref at pointer rate during a drag, which `useRightSidebarWidth` explicitly avoids for the same store.
- evidence: read (useActionEdit.ts: draft reverts to `value` on cancel)
- severity: medium

## Canceling an Offset slider drag leaves the slider at the canceled distance
- where: apps/draw/src/ui/PathCommands/PathCommands.tsx:75 (OffsetSlider)
- scenario: drag Offset from 0 to 12, press Escape. `onInput` already did `setDistance(12)`, so `offset.onCancel` reverts the draft to `[{ value: 12 }]`; the offset preview is undone but the slider reads 12, and a following click-release commits from 12 rather than from the default. `onCancel` should reset `distance` (to `DISTANCE.default`, as `onChange` does), or `distance` should not track previews at all.
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
apps/draw/src/usePaintSelection.ts
apps/draw/src/usePathOverlays.ts
apps/draw/src/usePickColor.ts
apps/draw/src/useRightSidebarWidth.ts
apps/draw/src/useRulers.ts
apps/draw/src/useSessionPersistence.ts
apps/draw/src/useSpacingHints.ts
apps/draw/src/useSymmetry.ts
apps/draw/src/useTextEditSession.ts
apps/draw/src/useViewBounds.ts

<!-- done: 2 findings, files read: 37 -->
