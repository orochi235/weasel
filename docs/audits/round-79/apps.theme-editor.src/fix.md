Editing a token whose own pin varies by an axis the theme does not declare throws (A): fixed e3f00a6a08. This was my own call, recorded in `docs/unruled.md`: an edit replaces such a pin and a reset removes it, since that pin applies at no selection.

"Copy as tokens" copies a JSON fragment, not a token document (A): fixed 22087fa977

A stored palette `count` is accepted at any finite value (A): fixed a02e719f7d. The count is rounded into 5 to 32, and the slider's range now comes from the same `COUNT_RANGE`.

A draft history the browser refuses still holds a slot in the history order (A): fixed da5a57299a. A history refused even alone also drops the older history that theme held.

Editing a list-valued literal or pin as text turns the list into a string (B): fixed cc4f988e00. One `textTypeOf` now serves PinRepair, the semantic drawer, the token pages, and their entries.

TokenReference stays a text field for good once Edit is clicked (B): fixed bac7f4548b

`unmetGates` gives the hue gap and the pinned pair 0.01° of slack (B): fixed 06f713ac42. I checked that the generator's `meetsGates` measures the same hex hue exactly.

No changesets: `apps/theme-editor` is not a published package, and no earlier commit to it carries one.

Checks:
- `npm run checks:gate`: all 33 passed, the root `lint` among them. theme-editor has no workspace package of its own, so the root lint is its lint.
- Each touched or related test file run alone with `--maxWorkers=1`, all passed: `unmetGates.test.ts`, `draftStorage.test.ts`, `presets.test.ts`, `ConstraintsPanel.test.tsx`, `PalettePreview.test.tsx`, `PaletteLab.copy.test.tsx`, `model.test.ts`, `PinRepair.test.tsx`, `entries.test.ts`, `SemanticDrawer.test.tsx`, `SemanticsLayer.test.tsx`, `TokenLayer.test.tsx`, `ThemePrefs.test.tsx`, `ThemeWorkbench.test.tsx`, and `PaletteLab.test.tsx`.
- Unrun: `ThemePrefs.narrow.browser.test.tsx`, a browser test. TokenReference's new `display: contents` wrapper is the change it would cover.
- The tree is clean.

tally: 7 of 7 fixed, 0 extra fixed