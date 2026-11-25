# Audit round 78 — apps.theme-editor.src

## Per-theme undo histories in localStorage have no reaper, so editing a few themes can fill the quota the drafts and live state need
- where: apps/theme-editor/src/theme/draftStorage.ts:16 (historyKey / draftHistory); apps/theme-editor/src/historyStorage.ts:27 (SAVED_CHARS), :41 (localHistoryStore.save)
- scenario: each theme you edit saves its history under `weasel.theme-editor.draft-history.<name>`, and each one can grow to `SAVED_CHARS` = 1,000,000 JSON characters. The palette lab's history is another 1M under `weasel.theme-editor.palette-history`. The only thing that removes a theme's key is `clearDraftHistory`, which `ThemeEditor.reload` and `ThemeEditor.discard` call. Saving, or a draft cleared because it is clean again, leaves the key in place. So does a theme whose file is later deleted: its key stays forever, because nothing lists or prunes these keys. The cap is per key, not for the origin. Long sessions on three or four themes reach the browser's ~5M-character localStorage quota. After that, `persistDraft`, `persistLive` and `persist` (presets) are refused: drafts show "not being kept in the browser", and a reload loses work. Meanwhile `save: (saved) => void writeLocal(...)` drops its own quota failure without a word. What should happen: a total bound across every history key (or eviction of the least recent theme's history), and pruning of keys for themes that no longer exist.
- evidence: read (grep shows `clearDraftHistory` called only from ThemeEditor.tsx:98 and :105)
- severity: medium

## The rail's Components count leaves out inherited components, though the Components layer lists them
- where: apps/theme-editor/src/theme/model.ts:51 (countTokens via ownTokenNames) vs apps/theme-editor/src/theme/entries.ts:35 (layerEntries, `components` branch)
- scenario: take a child theme of weasel that has no `components` of its own (the starter, or the `child` fixture). `layerEntries('components', …)` lists every component of `merged.components` whose provenance layer is `components`, so the page shows all of weasel's components. `countTokens` counts only `ownTokenNames(def, merged)`, which reads `def.components`, so `LayerRail` says "Components, 0 tokens" beside a full page. Seeds are counted differently too: the rail counts `Object.keys(def.seeds)`, while the seeds list leaves out any seed with no value at the current selection (`leafAt` undefined). The question "what is in this layer" gets two answers.
- evidence: read
- severity: low

## AnchorList's hints in the Ramps layer's gate editor point at a panel that isn't there
- where: apps/theme-editor/src/AnchorList.tsx:31-35 and :75-78, reused by apps/theme-editor/src/layers/RampsLayer.tsx:142 (GatesEditor)
- scenario: open "Edit gates" on an own categorical ramp. With no anchors, the list says "Pin one when the law would otherwise give you a different color…". With anchors, it says "Pick more from the panel below." The `SwatchPanel` that pins colors is mounted only in `PaletteLab`. The gate editor has no panel below and no way to add an anchor, so both hints send the user to a control that does not exist on this screen. The hint text should be passed in by the host, or left out where no picker exists.
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

<!-- done: 3 findings, files read: 50 -->
