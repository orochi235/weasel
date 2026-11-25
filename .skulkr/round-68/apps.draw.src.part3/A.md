# Audit round 68 — apps.draw.src.part3

## Canceling a Simplify or Offset slider drag leaves the slider, and Sand's tolerance pref, at the value that was canceled
- where: apps/draw/src/ui/PathCommands/PathCommands.tsx:52-57 (SimplifySlider), :75-79 (OffsetSlider)
- scenario: Both sliders write their resting value on every `onInput`: Simplify calls `onTolerance(next[0].value)`, which writes Sand's `tolerance` pref through `setToolOption` at pointer rate, and Offset calls `setDistance`. `useActionEdit`'s draft already shows the drag's value while it runs, and on `onCancel` it falls back to `value`. Here `value` has already been overwritten with the dragged value. So if the user drags Simplify from 1.0 to 8.0 and presses Escape, the preview is undone but the slider still reads 8.0, and Sand's tolerance option (its options row, and the persisted pref) is now 8.0, even though nothing was applied. Offset does the same: after a canceled drag to 12, the slider shows 12 against a selection that was never offset, while a committed drag resets it to `DISTANCE.default`. What should happen: a cancel restores the value from before the drag. Write the value on `onChange`, not on `onInput`, or restore it in `onCancel`.
- evidence: read (packages/ui/src/components/ActionEdit/useActionEdit.ts: `shown` is the draft, and cancel returns it to `value`)
- severity: medium

## Reset (D) and toggle-none write the default paints in a different spelling from every other color write
- where: apps/draw/src/tools/colorContext/ColorContextProvider.tsx:169 (toggleNone), :179 (reset)
- scenario: `setSlotColor` and `setFocusedAlpha` pass every paint they store in the shared `fill`/`stroke` tool options through `spelled` (`toolOptionPaint`: six hex digits, with any alpha as `opacity`). `toggleNone` and `reset` store `DEFAULT_FILL`/`DEFAULT_STROKE` as they are, which is `{ kind: 'solid', color: '#ffffffff' }` and `'#000000ff'` (8-digit, packages/paint/src/paintDefaults.ts). After pressing D, the shared fill option holds `#ffffffff`, where a picker setting the same white stores `#ffffff`. That is the mismatch `toolOptionPaint` exists to prevent ("so `#000` and `#000000ff` read as one value"), and the persisted prefs store gets the off spelling. Two code paths decide the spelling of a stored paint, and they disagree. What should happen: `toggleNone` and `reset` store `spelled(DEFAULT_FILL)` and `spelled(DEFAULT_STROKE)`.
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
