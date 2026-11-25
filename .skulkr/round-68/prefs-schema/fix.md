- Shown `min`/`max` under `places` rounded to the nearest place, so a shown bound could store a value past the leaf's (B): fixed 2516eec5ef
- `stops` come out descending under a decreasing unit (B): fixed 25ed766d73. The test that pinned the descending order now expects ascending. The slider already sorts stops, so the only visible change is in what `prefDisplayBounds` returns.
- A function unit's `step` was measured from stored 0, giving `Infinity` for a decibel unit (A): fixed 52ed17682e. This was my call, now recorded in `docs/unruled.md`: the step is measured at the leaf's `default`, else at `min` or `max`, and left as declared where none of those gives a finite distance.
- `visiblePrefSubtree` kept `hidden` fields inside union variants and list or map items (A): fixed 6a000539fd
- The entry pass hid a disabled item's switch field through the item's own `showIf` (A): fixed 41a2821976. The schema pass's item call gets the same treatment, but it can't fail there in practice, so no test covers that call.

Checks:
- `npx vitest run --maxWorkers=1 packages/prefs-schema/src/helpers.test.ts`: pass (28)
- `npx vitest run --maxWorkers=1 packages/prefs-schema/src/status.switch.test.ts`: pass (7)
- All of `packages/prefs-schema/src`: pass (23 files, 238 tests)
- The ui and routing consumers' tests (`PrefsForm`, `PrefsForm.renderValues`, `prefField.scale`, `prefField.places`, `menuHost`, `resolveMenu.values`): pass
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/prefs-schema`: not run, because the package has no `lint` script (npm reports a missing script)

tally: 5 of 5 fixed, 0 extra fixed