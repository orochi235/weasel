A header's band keeps the previous theme's color after switching to a theme that names none (A+B): fixed d5eb65d0cc

A hand-set text color freezes a header row's text, which that color never reaches (A+B): fixed 9c89d99e67

A hand-set fill never comes back to the header text after a theme with `headerText` (A+B): fixed 6de30d8578

Theme edits (`setThemeValue`, `addThemeRole`, `renameThemeRole`) can produce a theme that `diagramThemeFrom` rejects, so the document falls back to `night` (A+B): fixed 82a6a7ec2f. This was a strict call: they now throw a `RangeError`. It is recorded in `docs/unruled.md`.

`diagramThemeFrom` falls back without a warning for an object with no `roles` (B): fixed d36f24394f

`setDiagramFontSize` accepts 0, negative sizes, and NaN (A+B): fixed b27838994d. This was a strict call: it now throws a `RangeError` before writing anything. It is recorded in `docs/unruled.md`.

`setDiagramColor('stroke')` gives a strokeless shape a stroke with no width (A+B): fixed 5ff61918a1. The new stroke takes its role's width and dash, through one shared `themeLine` helper that the theme path also uses now. Connectors are covered too.

Extra: none. eab5a8bc20 only shortens four of this pass's changeset titles under the 140-character warning.

Checks:
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run check:changesets` (after the title fix): "[changesets] OK — 795 changeset(s), 10 with warnings". None of the warnings are this pass's.
- `npm run lint -w @weasel-js/diagram`: the package has no lint script, so npm errored "Missing script". I ran eslint on every changed `.ts` file instead: pass (exit 0).
- Tests, each run on its own with `--maxWorkers=1`: pass.
  - `packages/diagram/src/theme/`: themeHeaderText.scene (5), themeEdit (21), themeEdit.scene (2), resolve (24), themeFontSize.scene (7), theme.scene (8), themeWrites (9), themeLine.scene (5), diagramColorOf.scene (4), themeLocked.scene (4), themeFile (10), bodyGrowth.scene (3)
  - `apps/chart/src/theme/`: ThemePanel (6), StylePanel (7), useThemeEdit (2)
- No browser tests were touched.

tally: 7 of 7 fixed, 0 extra fixed