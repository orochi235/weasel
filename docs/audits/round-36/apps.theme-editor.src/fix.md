fixed 45b389c94f | Scales layer crashes the app when the draft does not derive (A+B). The table now falls back to the last draft that derived. To make that possible, `DerivedDraft` now records the definition it was derived from.

fixed aed7b61eb8 | "Compare in preview" throws during render once the draft stops deriving (A+B). There is no generated variant while the draft fails to derive.

fixed 861dac2dfa | The semantic drawer's literal field turns a number or array into a string (A+B). The field now shows the value the way CSS writes it (`cubic-bezier(…)`) and parses it back to the type it came in as. The pins layer (`TokenLayer`) made the same mistake: a `type: 'number'` pin edited from `0.5` to `0.6` was saved as `'0.6'`. Both now go through one helper, `tokenValueFromText` in `theme/model.ts`.

fixed 4e2e9c21ca | Turning "Varies by" off and on leaves the drawer editing a branch the rule no longer has (B). If the chosen branch is not among the rule's values, the drawer picks one of its branches again.

fixed 201a502b01 | The swatch panel decides "pinned" by an anchor name that the sources and the hex pin share (B). A swatch now counts as pinned when an anchor has its color (hue, lightness and chroma), and clicking it unpins that anchor.

fixed d7681e9df6 | The gates editor shows a gate that varies by axis, or is a reference, as a default number, and moving its slider overwrites it (B). Such a gate is now shown as written, with no slider. The "unmet gates" explanation is skipped while any gate is held this way, because the constraints the app has are not the ones the deriver ran.

fixed df306d7d49 | A reload while the draft does not derive drops the whole undo history (B). A saved history that passes through the state the editor reopens on is restored and stepped back to that state, with the later steps left to redo. A history that never passes through that state is still dropped.

fixed ba300dd0ef | The palette lab's saved history sits under its live state's key prefix, so every save of the state also reads and parses the history, up to a megabyte (B). The history moved to `weasel.theme-editor.palette-history`, and a history saved under the old key is moved over on load. The reviewer's suggested `live-history` would not have worked: the prefix match is a plain string match, so it still starts with `…live`.

fixed ce195e6cda | Undo on the theme prefs page puts back every leaf (B). Each undo step now records, and puts back, only the leaves it changed.

fixed d0fec2ecd8 | Saving a preset under a built-in's name does nothing and says nothing (B). Save is disabled for that name, and a status line says the name belongs to a built-in preset.

fixed 3e05eadcda | ThemeEditor crashes when the theme list comes back empty (A). It now shows a "No themes to edit" message with a Name field and Create. The same crash happened when discarding the last unsaved theme, and this covers it too.

fixed 6802457a16 | Inspect reports tokens from `@media` / `@supports` rules that do not apply (A). Those rules are now skipped when the page does not meet them. A condition the environment cannot test still counts.

Extra defects: the `TokenLayer` number-pin bug and the discard-last-theme crash, both above, fixed in the same commits.

No changesets: `apps/theme-editor` has no `package.json`, so it is not a published package and nothing a consumer sees changed. No `docs/unruled.md` entries: none of the fixes needed a behavior call nobody had made.

Checks:
- **Tests, each file alone with `--maxWorkers=1`:** pass.
  - PresetBar 2/2
  - SwatchPanel 7/7
  - ThemeEditor 8/8
  - ThemeWorkbench 15/15
  - TokenLayer 10/10
  - RampsLayer 9/9
  - SemanticDrawer 3/3 (new file)
  - presets 15/15
  - inspect 2/2
  - useLabHistory.persist 11/11
  - useLabHistory 5/5
  - usePrefsHistory 1/1 (new file)
  - SemanticsLayer 12/12
  - ThemePrefs 6/6
  - PaletteLab 5/5
  - autoReset.surfaces 11/11
  - ScalesLayer 6/6
- **`typecheck:packages`:** not applicable, since it covers only `packages/` and no package changed. Instead I ran the TS 7 compiler on `apps/theme-editor` alone. No errors in changed files. One error in an untouched file remains: `main.tsx(1,8) TS2882` on the `tokens.css` side-effect import.
- **eslint on every changed file:** pass.
- **`npm run check:size`:** pass.
- **`npm run check:changesets`:** pass.
- **Browser tests:** none touched; `ThemePrefs.narrow.browser.test.tsx` was not run.
- **Tree:** clean, with 12 commits on top of the frozen commit.