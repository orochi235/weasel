Applying a theme drops widths and dashes, it keeps only colors (A): fixed 1a5c47147f. The builders and the theme write now share one `outlineOf` rule. A width or dash set in an item's own `colors` is recorded in a new `ownLine` trait field and kept.

Style edits on a sequence part never show, or are lost at the next redraw (A): fixed 2902e1dcf6. `diagramStyleOf` now returns `null` for a sequence and its parts, so the style edits leave them alone.

Style edits throw partway through on a locked node (A): fixed 54b27c318b. Question: no rule existed, so I made the call. Locked shapes, connectors and text rows are skipped and the rest are edited, as `applyDiagramTheme` already does. The call is recorded in `docs/unruled.md`; throwing up front on any locked id was the alternative.

A hand fill sends header text to the fill even when the theme names a `headerText` (A): fixed 2cd0a15a3b. `diagramScene` and the theme write already used `headerText`; `setDiagramColor` was the odd one out. `setDiagramColor` gains a `theme` option, so its changeset is `minor`.

`diagramThemeFrom` takes any object with a `roles` key unchecked (A): fixed 50b4ab1a60. It now checks with `diagramThemeErrors` and caches the result per value. A theme that fails falls back, with one development warning per value.

The theme-file check skips optional fields, non-finite sizes and an empty `series` (A+B): fixed 1d3df19c90.

`setThemeValue` makes partial roles and sparse arrays (A): fixed 4c4b10f123. Question: no rule existed, so I made the strict call. It now throws `RangeError` on a role, lane body or series index the theme lacks; appending one color at the end of `series` is still allowed. Recorded in `docs/unruled.md`.

`diagramThemeFromTokens` copies `--wzl-fg-muted` relative color syntax verbatim (B): fixed c0830a31f8. A token that doesn't parse as a color falls back to `paper`'s.

A text row clamped at size 1 doesn't come back on a theme round trip (B): fixed dd93899000. The size the step couldn't take is kept on the row's data as `unclampedFontSize`, and the next step moves from it. Setting the size by hand clears it.

The `defaultRole` doc contradicts what connectors do (B): fixed 5e1f878a7b. Doc-only, so no test and no changeset.

Extra defects found while fixing (sweep): building containers and pools ignores a style's dash while clusters honor it. I left that as is and made the theme write follow it through `outlineOf`, so building and applying agree; changing it would change how containers draw.

Checks:
- Each touched test file, one at a time, `npx vitest run --maxWorkers=1 <file>`: all pass
  - `sequence/style.scene.test.ts` 1/1
  - `theme/fromTokens.test.ts` 4/4
  - `theme/resolve.test.ts` 23/23
  - `theme/themeEdit.test.ts` 20/20
  - `theme/themeFile.test.ts` 10/10
  - `theme/themeFontSize.scene.test.ts` 3/3
  - `theme/themeHeaderText.scene.test.ts` 2/2
  - `theme/themeLine.scene.test.ts` 5/5
  - `theme/themeLocked.scene.test.ts` 4/4
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed on typecheck, changeset titles, `check:part-caches` and `check:proto-index`; those fixes were folded into each finding's own commit.
- `npm run lint -w @weasel-js/diagram`: not run, because the package has no `lint` script ("Missing script: lint"). Instead, eslint on every changed `.ts` file passes, and the gate's root `npm run lint` passes.
- `npx vitest run` over `packages/diagram/src`, `packages/diagram-formats/src` and `apps/chart`: 446 files, 3734 tests passed.
- No browser tests touched.