## PinRepair converts a numeric pin's text per keystroke, so a decimal cannot be typed and a cleared or signed value turns the pin into a string for good
- where: apps/theme-editor/src/PinRepair.tsx:25 (edit) and :70 (Input onChange); apps/theme-editor/src/theme/model.ts:107 (keepNumberness)
- scenario: The `Input` is controlled by `value.text` and calls `onChange` on every keystroke, which runs `keepNumberness(text, value)` right away. Take a pin `{ value: 4, type: 'number' }`. Typing `0.` gives `Number('0.') = 0`, the pin becomes `0`, and the field redraws as `0`, so `0.5` can never be typed. Typing `-` first, or clearing the field, fails `Number.isFinite`, so the pin is stored as the string `'-'` or `''`. From then on `previous` is a string, and `-5` or `8` stays a string. The pin's numberness is lost and the definition now has a string where it had a number. The text should be held locally and converted on commit, or `previous`'s numberness should be kept rather than re-read from the last keystroke.
- evidence: read
- severity: medium

## SemanticDrawer's literal Value field loses a number for good once the field is cleared (untyped rule)
- where: apps/theme-editor/src/layers/SemanticDrawer.tsx:150 (RuleFields, literal branch); apps/theme-editor/src/theme/model.ts:111 (tokenValueFromText)
- scenario: Take a literal rule `{ value: 4 }` with no `type`. `tokenValueFromText(undefined, '', 4)` returns `''`, because `keepNumberness('', 0)` keeps the empty text. The next edit then sees `previous = ''` and `type = undefined`, goes through `parseTokenValue('string', '8')`, and stores the string `'8'`. Any number rule whose field is emptied on the way to a new value ends up with a string value. Like the PinRepair case, this comes from converting against the last value written rather than the original one.
- evidence: read
- severity: low

## "Discard the draft and reload from disk" clears the draft without waiting, then remounts from `loadDraft`, which can still return the draft
- where: apps/theme-editor/src/ThemeEditor.tsx:93-99 (reload); packages/editor/src/sessionStore.ts:206 (writeSession is async, flushes after awaits)
- scenario: `reload` calls `void clearDraft(name)`, which is `writeSession`: an async write that lands after `flushAll` resolves. It then calls `replace(fresh)` and `setGeneration`, and doesn't wait for the clear. The re-render calls `loadDraft(current.name)` synchronously and passes the result as `start`. If the clear has not reached storage by then, the new workbench, keyed by the new generation, opens on the draft the user just discarded rather than the file. Its persist effect then writes that draft back. `reload` should await `clearDraft` before it bumps the generation, or pass `start` explicitly.
- evidence: read (ordering confirmed in the code; whether `readStored` sees the pending clear through the shared record cache was not traced)
- severity: medium

## Save stays enabled while the draft does not derive, so a broken definition can be written to disk
- where: apps/theme-editor/src/ThemeWorkbench.tsx:301 (saveButton), :219 (save)
- scenario: The user edits a reference to `{nope}`, so `deriveDraft` throws. `derived` stays at `lastGood.current`, so the full workbench is drawn with the "does not derive" status. `dirty` is true, so Save is enabled, and `save()` calls `api.put(draft.name, draft, baseHash)` with the non-deriving draft. The persist effect deliberately refuses to store such a draft ("Only a draft that derives is stored"), but Save sends it to the file, which the dev server regenerates from. The two paths answer "may a non-deriving draft be kept" in opposite ways. Save should also be disabled when `error !== null`.
- evidence: read
- severity: low

## A stored preset named like a built-in is loaded alongside it: duplicate React keys, and one name for two presets
- where: apps/theme-editor/src/presets.ts:143 (savedOf); apps/theme-editor/src/PresetBar.tsx:30,51 (all, key={p.name})
- scenario: `save` refuses a built-in name, but `savedOf` doesn't filter one. A list stored under the key by hand, by an older build, or with a built-in renamed since, which holds `{ name: 'Default', … }`, gives `all` two entries keyed `Default`. React warns, can reuse the wrong chip, and `copied === p.name` flashes both. `savedOf` should drop entries whose name is a built-in's, as `save` does.
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
