# Audit round 76 — apps.theme-editor.src (blind reviewer)

## SemanticDrawer's number fields write NaN into the rule when cleared, where AnchorList guards it
- where: apps/theme-editor/src/layers/SemanticDrawer.tsx:83 (RuleFields: Alpha), :91 (Minimum), :111 (Offset)
- scenario: the user selects the contents of the Alpha field (a `ref` rule), Minimum (`contrast`) or Offset (`offset`), deletes them and commits. The number field commits NaN, as the comment in `AnchorList.setNumber` says it does for the same kit control. The drawer writes `{ ...rule, alpha: NaN }` (or `contrast.min: NaN`, `offset: NaN`) into the draft with no finiteness check. `ruleSummary` then renders "fg at NaN%", derive either throws or produces garbage, and the persisted draft or history carries NaN, which JSON stores as null. AnchorList answers the same input by keeping the previous value, so the two places decide this differently.
- evidence: read (the NaN-on-clear behavior is inferred from AnchorList's comment and from `NumberInput` passing `onChange` straight through to `UnitField`, not run)
- severity: medium

## PinRepair's Remove and Edit share one coalesce key, so an edit followed by Remove is a single undo step
- where: apps/theme-editor/src/PinRepair.tsx:104 and :108 (PinRepair)
- scenario: on the broken-draft screen, the user edits pin `x`'s text and then clicks Remove within 500 ms. Both writes use the key `pin:${token}`, so the history merges them into one entry. Undo does not bring back the edited pin: it goes straight back to the state before the edit, losing the edit. TokenLayer and RampsLayer do the same thing (`pin:${name}` for both edit/pin and reset/unpin), so a pin toggled twice within the window collapses to a no-op entry.
- evidence: read
- severity: low

## Jumping to an inherited component token opens the Components layer, which does not list it
- where: apps/theme-editor/src/ThemeWorkbench.tsx:262 (layerOf / jump), with apps/theme-editor/src/theme/entries.ts:30 (layerEntries)
- scenario: in a child theme that extends weasel (e.g. `child` in fixtures), the user turns on Inspect and clicks a preview button that reads a weasel component token. `layerOf` returns the provenance layer `components` and switches to it, but `layerEntries` lists only `ownTokenNames(def, merged)`, which leaves out inherited components. The layer opens with nothing highlighted (or "has no components"), and the token the user clicked cannot be found. Ramps, scales and semantics show merged entries, so only Components (and Seeds) behave this way.
- evidence: read
- severity: low

## Restored palette history steps bypass the state validation that loadLive applies
- where: apps/theme-editor/src/useLabHistory.ts:72 (useLabHistory restore), with apps/theme-editor/src/presets.ts:94 (stateOf)
- scenario: a palette history saved before a constraint existed, or edited by hand, holds `before`/`after` states whose `c` lacks that field or carries garbage anchors. `loadLive` sanitizes only the end state through `stateOf`. `savedHistoryOf` checks the history's shape, not its states. If the end state still matches, undo emits an unsanitized `LabState`, and the generator reads undefined/NaN out of it: the exact case `stateOf`'s docstring says it exists to prevent.
- evidence: read
- severity: low

## Semantic cell `produced` is undefined, not a string, for a pin over a token with no generated value
- where: apps/theme-editor/src/theme/semantics.ts:115 (semanticRows)
- scenario: a pin applies to a semantic token whose provenance has no `generated` record. `text(p.generated?.value)` calls `JSON.stringify(undefined)`, which returns `undefined`, so a `SemanticCell.produced` typed `string` holds undefined. SemanticDrawer's "Rule produced" column then renders an empty `<code>` instead of a placeholder such as "—".
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

<!-- done: 5 findings, files read: 50 -->
