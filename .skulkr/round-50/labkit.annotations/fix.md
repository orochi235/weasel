- Cross-target redo left on other targets' scenes, so a pane's Redo brings back a discarded change (A+B): fixed 193c9570bc
- SVG export copies a `{ px }` stroke's dashes in user units, so they come out `scale`× too long (A+B): fixed 0a1a6cd6de. The same fix also stops the export from dropping a stroke's `dashOffset`.
- Mark-list title typing makes one undo step per keystroke (A+B): fixed 968d79f43d
- Legacy save restored before its target has a content box is never migrated (A): fixed b0148f5785. Reads, paint, exports and `update` now convert such marks whenever the content box is known, and an update writes the converted form back.
- Export panels share radio `name`s, so two open panels steal each other's choice (A): fixed 9cec448411
- Restyle counter restarts at 1 when the palette remounts, so a new restyle folds into an old undo step (A): fixed 6c200dfcf9. The count now lives in a shared module, `markGesture.ts`, which the mark list also uses.
- Calibration picture-ref map grows by one entry per trial and never shrinks (A+B): fixed 81cc4efc8c
- Restyle across targets lands one undo step per target (B): fixed 70fe8932f5. Updates sharing a `coalesceKey` now undo and redo together across a store's targets, and still do after a save and load. Across trials it stays one step per trial, because each trial owns its own undo.
- `AnnotationOverlayProps.scene` doc describes one scene shared by every target (B): fixed 09feec469d. It's a doc-only change, so it has no changeset.
- Target with no content box reads its marks at 0×0, and a geometry write collapses them to the origin (B): fixed 54c9bccd4c. Reads now use the last content box with an area. This was a strict call, recorded in `docs/unruled.md`: `add`, and an `update` with `frac` or `points`, now throw on a target whose content box was never known; an update of meaning alone still lands.
- Status "—" stores `status: ''` instead of clearing it (B): fixed 48dd57e3a7
- API writes snap the world pose to 1/10,000 of the target (B): fixed fe385d7060. Rounding now applies only to what reads report.

Extra defects (from the gate):
- `check:numeric` failed on a hand-set `font-variant-numeric` in `apps/draw/src/dev/audits/Treemap.module.css`, present in the frozen tree: fixed 84ea91ee3a
- labkit's design-token check, run by `lint -w @weasel-js/labkit`, failed on the raw `2px` in the `font-size` of `packages/ui/src/components/SpanStrip/SpanStrip.module.css`, present in the frozen tree: fixed e5ffd20a00

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: history.test.ts pass (9), history.persist.test.ts pass (4), svgNodes.test.ts pass (12), markGesture.test.ts pass (3), Annotations.meaning.test.tsx pass (9), ExportMenu.test.tsx pass (8), calibration/trialPictures.test.ts pass (1), store.test.ts pass (43), AnnotationOptions.test.tsx pass (2), ui SpanStrip.test.tsx pass (15)
- Also ran: store.pbt.test.ts pass, store.shrunk.test.ts pass, frac.pbt.test.ts pass, store.style.test.ts pass, labMarks.test.tsx pass, and the whole labkit project pass (295 files, 2140 tests)
- Each new test was run against the code without its fix and failed. The exceptions are `markGesture.test.ts` and `trialPictures.test.ts`, which test new modules with no earlier version.
- Unrun: `calibration/calibration.browser.test.tsx` (browser)
- `npm run checks:gate`: pass, "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/labkit`: pass. `@weasel-js/ui` has no `lint` script.
- `npm run check:changesets`: pass, "OK — 2407 changeset(s)"
- Tree clean

tally: 16 of 16 fixed, 2 extra fixed