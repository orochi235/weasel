## A list-valued pin in PinRepair cannot be typed: the controlled field round-trips each keystroke through parse and serialize
- where: apps/theme-editor/src/PinRepair.tsx:27 (edit) and :72 (Input value/onChange)
- scenario: a draft that does not derive has a `fontFamily` pin `['Inter']`. The row's Input shows `Inter`; typing `, ` gives `Inter, ` → `parseTokenValue('fontFamily', …)` reads one family → the pin becomes `['Inter']` → `value.text` re-serializes to `Inter`, so the comma (and any space, as in `Open Sans`) is eaten as it is typed. A `cubicBezier` pin mangles too: deleting the `4` of `0.4` leaves `0.`, which parses as `0` and the text snaps to `0`. Only pasting a whole value works. The field should hold the typed text and write the parsed value, not re-derive its text from the stored pin.
- evidence: read (parseTokenValue/readFontStack/fontStack in packages/theme/src/dtcg/value.ts; round trip inferred)
- severity: medium

## Step lists are read without the theme's scope in three places and with it in three others
- where: apps/theme-editor/src/theme/ramps.ts:44 (rampView), apps/theme-editor/src/theme/model.ts:43 (ownTokenNames), apps/theme-editor/src/layers/RampsLayer.tsx:112 (GatesEditor count)
- scenario: `declaredSteps(entry)` with no scope resolves no `{seeds.name}` step item and takes the axes from the entry's own `by`s (steps.ts:66-69). adoptGenerated, scaleTable and SemanticsLayer pass `merged`. A ramp whose `steps` names a seed (`['soft', '{seeds.mid}', 'strong']`) shows only two steps in the Ramps strip, counts two tokens in the rail and the "N of M overridden" header, and GatesEditor runs `generate` with `count` 2 while derive generated 3, so the unmet-gate explanation describes a different palette. Adopt generated, by contrast, does remove the pin on the seed-named step. Every caller should pass the merged definition as the scope.
- evidence: read
- severity: medium

## The theme prefs page's undo history has no limit
- where: apps/theme-editor/src/usePrefsHistory.ts:64 (usePrefsHistory)
- scenario: `createHistory(store, { coalesceWindowMs: 500 })` passes no `historyLimit`, which defaults to `Infinity` (packages/history/src/history.ts:59). Each step keeps before/after maps, including a split leaf's whole scope. A long session editing colors keeps every step in memory for the page's lifetime. useLabHistory caps the other two pages at 200 (`HISTORY_LIMIT`), so the same question gets two answers.
- evidence: read
- severity: low

## PinRepair's "named in the error" check matches any reference that appears as a substring of the message
- where: apps/theme-editor/src/PinRepair.tsx:42 (named)
- scenario: the error is `semantics.accent-fg: unknown reference {accent-fgx}`. A pin whose value is `{accent}` (a real token, not one of the draft's pins) is flagged as suspect and sorted to the top, because `error.includes('accent')` is true. A short ref like `{fg}` matches almost every message. The check should match the reference as a whole name, such as `{name}` or a word boundary.
- evidence: read
- severity: low

## A stored preset list can hold duplicate or built-in names, which collide as React keys and show twice
- where: apps/theme-editor/src/presets.ts:146 (savedOf); apps/theme-editor/src/PresetBar.tsx:53 (key={p.name})
- scenario: `savedOf` keeps every entry with a string name. It does not drop entries that repeat a name, or that use a built-in's name, such as a list written before a preset was made built-in, or one edited by hand. With a stored `Default`, the bar draws two `Default` chips under one key. React warns and may reuse the wrong chip, and the copy flash, keyed by name, lights both chips. `save` already refuses built-in names and replaces same-name entries, but the load path is not held to the same rule.
- evidence: read
- severity: low

## "Varies by" does nothing when switched off on a branch the rule lacks
- where: apps/theme-editor/src/layers/SemanticDrawer.tsx:199 (setVaries)
- scenario: a rule `{ by: 'mode', dark: {...} }` with a `light` mode. Pick Editing → light, so `current` is undefined, then turn "Varies by mode" off. `setVaries` returns early on `!current`, so the toggle silently stays on and no edit is made. Turning variation off should collapse to a branch the rule has (`present`).
- evidence: read
- severity: low

## The light and dark surface colors are defined twice, in PaletteLab and PalettePreview
- where: apps/theme-editor/src/PaletteLab.tsx:26 (SURFACES); apps/theme-editor/src/PalettePreview.tsx:124-133
- scenario: PalettePreview hard-codes `'#181a1e'` and `'#f5f5f6'` for its panes and decides "contrast gated here" with `bg === surface`. If either SURFACES value changes, no pane matches `constraints.surface`. The label then vanishes, and the panes no longer draw the surface the gate measured against. PalettePreview should take its panes from SURFACES.
- evidence: read
- severity: low

## pickRule and leafAt are two implementations of reading a leaf at a selection, and they differ on a `by` key
- where: apps/theme-editor/src/theme/semantics.ts:53 (pickRule); apps/theme-editor/src/theme/model.ts:107 (leafAt)
- scenario: `leafAt` refuses a selection value of `'by'`. `pickRule` does not: for an axis value literally named `by`, it returns the axis name string as the rule, where `leafAt` returns undefined. Seeds and pins are then read one way and semantic rules another. These should be folded into one helper.
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

<!-- done: 8 findings, files read: 50 -->
