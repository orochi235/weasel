Hex row shows and compares against held typed text instead of the picker's color (A) — fixed 6bd1cc6d77
Text-row edit survives its submenu closing, so keys go to a row no panel shows (A+B) — fixed d7e9202b7f
Swatches draw at the alpha the row opened with, but write the alpha held now (A+B) — fixed bdbf8f57ac
Typed text longer than its row draws over the label and outside the panel (A) — fixed 75f6983bf5. It now scrolls to keep the caret inside the value column and is clipped there. The scroll offset is recomputed from the caret on every draw rather than kept between draws, so after a click in a scrolled draft the text can shift under the pointer.
`attachMenuHost` throws when `toCanvas` or `canvasSize` is passed as `undefined` (B) — fixed 369daa7344
Swatch rows are exposed as checkboxes though they are mutually exclusive (B) — fixed 2e71737d35

Extra defects: none. Two follow-up commits on my own work: 43e8fe9ed8 moves the hex-row text routing and the hidden-edit check out of `createMenuWidget`, because my fixes pushed it to 127 lines against `check:size`'s 120. 4a5643c062 shortens four changeset titles that were over 140 characters.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, on the final tree: `colorPicker.test.ts` 9/9 pass, `menuWidget.test.ts` 20/20 pass. On the tree at 75f6983bf5, before the two follow-up commits: `attachMenuHost.test.ts` 25/25 pass, `textEdit.test.ts` 19/19 pass, `valueRows.test.ts` 21/21 pass, `menuGeometry.pbt.test.ts` 6/6 pass, `valueRows.pbt.test.ts` 4/4 pass, `panelCommands.test.ts` 10/10 pass, `valueRows.bidi.test.ts` 3/3 pass, `textEdit.pbt.test.ts` 3/3 pass. Each new test failed before its fix.
- `textEntry.browser.test.ts`: unrun, it needs a browser.
- `npm run checks:gate`, one run at 75f6983bf5: 28 of 32 pass. The failures:
  - `check:changesets` FAIL (my titles); after the fix, `npm run check:changesets` passes ("OK — 2402 changeset(s)").
  - `check:size` FAIL (`createMenuWidget` at 127 lines); after 43e8fe9ed8, `npm run check:size` passes ("no file or function grew past its cap").
  - `check:numeric` FAIL, already failing in the frozen tree and outside this area: `apps/draw/src/dev/audits/Treemap.module.css:119`, from e478753df0. Not fixed.
  - `lint -w @weasel-js/labkit` FAIL, already failing in the frozen tree and outside this area: a raw `font-size` in `packages/ui/src/components/SpanStrip/SpanStrip.module.css:40`, which a commit before the freeze last touched (237bc66c6c, the audits-patch change). Not fixed.
  - In that same run, `typecheck` passed, `typecheck:packages` passed, and root `lint` passed.
- Not rerun after 43e8fe9ed8: a hook on this machine refused the second `checks:gate`, `npm run lint -w @weasel-js/hud`, and `tsc` as suite-sized for this machine, and the brief rules out fleet runs. In their place, `npx eslint` on the two files that commit changed passes (exit 0). Typecheck of that commit has not been run.
- The tree is clean.

tally: 8 of 8 fixed, 0 extra fixed