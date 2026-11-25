# Audit round 78 — apps.theme-editor.src

## Scales layer labels a `factors` scale "geometric"
- where: apps/theme-editor/src/layers/ScalesLayer.tsx:56 (ScaleSection)
- scenario: `ScaleDef` takes exactly one of `step`, `ratio` or `factors` (packages/theme/src/definition.ts:58-68). A scale written with `factors: [1, 1.5, 2]` and no `step` gets the badge `geometric`, because the badge tests only `entry.step !== undefined`. It should say it is an explicit-factors scale. Its `factors` also has no row in the parameter panel (PARAMS lists base/step/ratio only), so the panel shows nothing but Base for it.
- evidence: read
- severity: low

## Unpinning a grid swatch also removes every other anchor that has the same color
- where: apps/theme-editor/src/SwatchPanel.tsx:111 (unpin)
- scenario: Pin `#fac80a` with the hex field, then pin LEGO "Bright Yellow" (same hex). Both anchors get added: the grid tile reads as pinned only after the first add, and the hex Pin button never checks `isPinned`. Clicking the tile to unpin it then filters out every anchor whose `colorOf` matches, so both pins go, the hand-typed one included. It should remove one anchor, the one that tile added.
- evidence: read
- severity: low

## "Reload from disk" can reopen the draft it just claimed to discard
- where: apps/theme-editor/src/ThemeEditor.tsx:99 (reload)
- scenario: `clearDraft` resolves `false` when the browser refuses the write (writeSession's refusals: a full quota, or an unreadable copy not yet kept aside). `reload` ignores that result and still bumps `generation`. The remount then runs `loadDraft(current.name)` during render, finds the old draft still stored, and passes it as `start`. The workbench opens on the stale draft (with its old `baseHash`) and not on the fresh file. The user is told nothing, and the conflict comes back on the next save.
- evidence: read
- severity: low

## Resetting a by-axis pin at a selection with no branch records an undo step that changes nothing
- where: apps/theme-editor/src/TokenLayer.tsx:50 (write), apps/theme-editor/src/theme/model.ts:150 (clearAt)
- scenario: `clearAt` returns `v` itself when the selection's branch is absent. `write` still calls `setPin(draft, name, rest)`, which builds a new definition object. `useLabHistory.update` skips only an `Object.is`-equal state, so a new undo entry "Reset <token>" is pushed with an identical before and after. The draft object also changes identity, which reruns derive and the persist effect. It should leave the draft untouched when nothing was cleared.
- evidence: read
- severity: low

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
