- Pre-existing overlays go inert but ones that join later don't (A): not a defect. An overlay already open when the modal opens sits beneath it, like the first of two stacked dialogs, and `Dialog.contained.test.tsx` "keeps the box inert while a dialog stacked on it…" depends on that. The docstring was ambiguous, so I clarified it in 4cb16f5ff1 (comment only, no changeset).
- Selection summary's advice to use plural kind labels gives "pathses" (A): fixed 6129b61da1. The comment was wrong, not the code. It now says kind labels must be singular.
- DataGrid row activation fires on clicks into ARIA-role or `tabindex` controls (A): fixed ac7823cf12. All widget roles and `[tabindex]` now count as controls, except the row itself.
- DataGrid detail-row id breaks `aria-controls` when the row id has a space (A): fixed 55865fe2e7. The row id is `encodeURIComponent`-encoded. Nothing else in the area builds an id reference from a consumer string.
- ComboBox never shows `errorLabel` when a failed load leaves the old rows in place (B): fixed 30196f4b0e. The error alert now shows above the list whenever `loadError` is set.
- CycleButton with a `value` outside `options` shows option 0 as current and a click skips it (B): fixed 336f935c4c. I made the strict call: no option shows as current, a click goes to the first option and a shift-click to the last. It warns unless the new `allowUnlistedValue` is passed. The call is recorded in `docs/unruled.md`. This replaced an existing test that asserted the old behavior, which nobody had ruled on.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/ComboBox/ComboBox.test.tsx`: pass (27/27)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/DataGrid/DataGrid.test.tsx`: pass (27/27)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/CycleButton/CycleButton.test.tsx`: pass (12/12)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run check:changesets`: pass ("OK — 662 changeset(s)")
- `npm run lint -w @weasel-js/ui`: not run, because `@weasel-js/ui` has no `lint` script (npm reported missing script). The root `npm run lint` inside the gate passed.

tally: 4 of 6 fixed, 0 extra fixed