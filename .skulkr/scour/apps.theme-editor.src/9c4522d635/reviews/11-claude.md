# Findings: apps.theme-editor.src

## A saved history whose last step is a coalesced burst is dropped instead of stepped back to the state the page opens on
- where: apps/theme-editor/src/useLabHistory.ts:30 (stepsBackTo)
- scenario: The theme editor stores a draft only while it derives, so after a reload it opens on the last draft that derived. Its saved history ends on the newer state, and `stepsBackTo` should find how many undos lead back. It reads `forwardOps[0].args.before` of each entry. But `coalesceEntry` (packages/history/src/entryOps.ts:124) sets `top.forwardOps = ops` on every merge. A coalesced entry's `forwardOps[0]` is therefore the *last* tick's swap, and its `before` is the state one tick before the end. The state before the burst lives only in `baseOps[0]`. Example: the draft derives as D0, and the user types `{a`, `{ac`, `{acc` into a pin field. That is one coalesced entry ending at D3, and none of those three drafts derives. On reload the page opens on D0. `stepsBackTo` compares D0 against D2, gets no match, and returns null, so the whole saved history is discarded. It should have found one step back. The same happens on the palette lab whenever the live state lags the history across a coalesced slider drag.
- evidence: read (createSwapOp, recording.ts pushOrCoalesce, entryOps.ts coalesceEntry)
- severity: medium
- fix: apps/theme-editor/src/useLabHistory.ts
- size: line
- cause: reads forwardOps where coalescing keeps the original before in baseOps
- confidence: likely

## Dragging a lightness slider on a ramp with no `lightness` writes an object, not the two-number tuple
- where: apps/theme-editor/src/theme/ramps.ts:84 (writeParam)
- scenario: Take a lightness ramp whose `lightness` is absent, or anything other than an array. `LightnessParams` (layers/RampsLayer.tsx:79) still draws "First L" / "Last L" sliders at 0, because `readParam` answers undefined. Dragging one runs `writeParam(entry, 'lightness.0', v)`. The `top` there is not an array, so the call falls through to `{ ...undefined, '0': v }` and writes `lightness: { "0": v }`. derive requires `Array.isArray(l) && l.length === 2` (packages/theme/src/engine/entries.ts:117), so the ramp stays invalid however the slider moves. The array case only works once the tuple already exists.
- evidence: read
- severity: low
- fix: apps/theme-editor/src/theme/ramps.ts
- size: line
- cause: object fallback used for an array-shaped parameter
- confidence: sure

## The hex "Pin" button pins a color that is already pinned, giving the generator two identical anchors
- where: apps/theme-editor/src/SwatchPanel.tsx:172 (Pin button / add)
- scenario: The swatch grid treats pinning as a toggle by color (`isPinned` and `colorOf`), so the same color never goes in twice from there. The hex row's Pin button checks only `full` and `HEX6`. Pin `#e0e11c`, then press Pin again: `add` renames the second one to `<name>-2` and appends an anchor of the same color. Two anchors at distance 0 make any non-zero `minDistance` gate infeasible, and they take two slots. The grid would have shown that color as pinned and offered to unpin it.
- evidence: read
- severity: low
- size: line
- cause: hex path skips the pinned-color check the grid applies
- confidence: likely

## The app root does not stop the page from scrolling
- where: apps/theme-editor/src/app.css:1
- scenario: `html`, `body` and `#root` get `height: 100%` and `margin: 0` but no `overflow: hidden`. The repo's rule is that the root never scrolls and that anything taller scrolls inside its own pane. Under `max-width: 900px`, `.workbench` switches to `height: auto` (ThemeEditor.module.css). An absolutely positioned descendant that escapes its pane can also stretch the document. In either case the whole page scrolls: `scrollTo(0, 5000)` leaves `scrollY` above 0.
- evidence: read
- severity: low
- size: line
- cause: missing overflow: hidden on the root
- confidence: likely

## Files read
apps/theme-editor/src/AnchorList.tsx
apps/theme-editor/src/App.tsx
apps/theme-editor/src/HistorySlot.tsx
apps/theme-editor/src/LayerRail.tsx
apps/theme-editor/src/PaletteLab.module.css
apps/theme-editor/src/PaletteLab.tsx
apps/theme-editor/src/PalettePreview.tsx
apps/theme-editor/src/PinIcon.tsx
apps/theme-editor/src/PinRepair.tsx
apps/theme-editor/src/PresetBar.tsx
apps/theme-editor/src/SwatchPanel.tsx
apps/theme-editor/src/ThemeEditor.module.css
apps/theme-editor/src/ThemeEditor.tsx
apps/theme-editor/src/ThemePrefs.module.css
apps/theme-editor/src/ThemePrefs.tsx
apps/theme-editor/src/ThemePreview.tsx
apps/theme-editor/src/ThemeWorkbench.tsx
apps/theme-editor/src/TokenLayer.tsx
apps/theme-editor/src/TokenReference.tsx
apps/theme-editor/src/app.css
apps/theme-editor/src/historyStorage.ts
apps/theme-editor/src/icons.gen.ts
apps/theme-editor/src/labTestSetup.ts
apps/theme-editor/src/layers/RampsLayer.tsx
apps/theme-editor/src/layers/ScalesLayer.tsx
apps/theme-editor/src/layers/SemanticDrawer.tsx
apps/theme-editor/src/layers/SemanticsLayer.tsx
apps/theme-editor/src/main.tsx
apps/theme-editor/src/palette/ConstraintsPanel.tsx
apps/theme-editor/src/palette/copicColors.ts
apps/theme-editor/src/palette/crayons.ts
apps/theme-editor/src/palette/legoColors.ts
apps/theme-editor/src/palette/unmetGates.ts
apps/theme-editor/src/presets.ts
apps/theme-editor/src/theme/api.ts
apps/theme-editor/src/theme/draft.ts
apps/theme-editor/src/theme/draftStorage.ts
apps/theme-editor/src/theme/entries.ts
apps/theme-editor/src/theme/exportFiles.ts
apps/theme-editor/src/theme/fixtures.ts
apps/theme-editor/src/theme/inspect.ts
apps/theme-editor/src/theme/issues.ts
apps/theme-editor/src/theme/model.ts
apps/theme-editor/src/theme/ramps.ts
apps/theme-editor/src/theme/scales.ts
apps/theme-editor/src/theme/semantics.ts
apps/theme-editor/src/theme/starter.ts
apps/theme-editor/src/useFlash.ts
apps/theme-editor/src/useLabHistory.ts
apps/theme-editor/src/usePrefsHistory.ts

<!-- done: 4 findings, files read: 50 -->
