# Audit round 35 — apps.draw.src.part3

## Setting a color on the active fill or stroke drops the alpha the swatch's paint editor stored in `opacity`
- where: apps/draw/src/tools/colorContext/ColorContextProvider.tsx:72 (colorKeepingAlpha), :128 (setSlotColor), :136 (focusedAlpha), :143 (setFocusedAlpha)
- scenario: The active-swatch editor is `FillStrokeSwatch` → `PaintEditorPopover` → `PaintInput`, which commits alpha into the paint's `opacity` slot and leaves the hex at six digits (`PaintInput.test.tsx`: "commits alpha into the opacity slot, not the hex" → `{ color: '#336699', opacity: 0.7 }`). `toolOptionPaint` also names that the one spelling of a tool-option paint. Set the fill to 40% in the swatch, giving `{ color: '#336699', opacity: 0.4 }`. Then pick a color with the eyedropper or loupe, which goes `usePickColor` → `setFocusedColor('#ff0000')` → `colorKeepingAlpha` → `mergeAlphaFromPrev('#ff0000', '#336699')`. `hexAlpha('#336699')` is 1, so the fill becomes `{ kind: 'solid', color: '#ff0000ff' }`: fully opaque, with `opacity` gone. The next shape is drawn opaque. It should keep the 0.4. `focusedAlpha` makes the same mistake and reports 1 for that paint, and `setFocusedAlpha` builds a paint with no `opacity`, writing the alpha into the hex in the other spelling.
- evidence: read (ColorContextProvider; paint/src/hexAlpha.ts `hexAlpha` reads only a 4/8-digit hex; ui PaintInput commits `opacity`; FillStrokeSwatch uses PaintEditorPopover → PaintInput)
- severity: medium

## A picked color paints the active swatch and the selection at two different alphas
- where: apps/draw/src/usePickColor.ts:14-15 (usePickColor)
- scenario: The active fill is at 50% alpha and the selected shape's fill is opaque. A pixel pick from the eyedropper returns a six-digit hex. `setFocusedColor(hex)` keeps the *active* paint's alpha, so the swatch shows the color at 50%. `begin('setFill', { color: hex })` goes through `setFill`'s `paintWithColor(prev.paint, color)`, which adopts the *node's* alpha, so the shape gets the color at 100%. The doc says a pick "is the swatch edit arriving from a different control". The swatch's own edit (`ActiveSwatches` onChange) commits `{ paint: next }`, the active paint verbatim, so swatch and selection agree there. After a pick they disagree. The fix is to dispatch the paint the context just computed, as `{ paint }`.
- evidence: read (usePickColor; packages/editing/src/actions/edit/setFill.ts "A 6-char color adopts the alpha of the node's existing paint"; ActiveSwatches.tsx commits `{ paint: next }`)
- severity: low

## Live symmetry's first group is made even while a redo is pending, which wipes the redo stack, though `standingOf` reports that state as "waiting"
- where: apps/draw/src/useSymmetry.ts:48 (standingOf) vs :59 (layout effect)
- scenario: `standingOf` returns `'waiting'` whenever no group is found and `scene.canRedo()` is true. The effect waits only if `group.current !== null` as well. Two cases have no group yet and a redo pending:
  - The user draws, undoes, and then turns Symmetry on from the View menu.
  - Draw reloads with Symmetry already on, the persisted session's undo history restores redo entries, and the document holds no symmetry group.

  In both, `group.current` is null, so the effect calls `ctrl.create(...)`. That is a new undo step and drops the redo entries. Turning on a view preference, or just loading the app, discards the user's redo history. `standingOf` and the effect give two answers to "wait while a redo is pending".
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

<!-- done: 3 findings, files read: 36 -->
