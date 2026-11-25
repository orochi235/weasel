- carried line's pen reach ignored by the clip test (A): fixed 581cb8231f. The `inkSpanX` helper became `inkBox`, which covers both axes, and the clip test and the length bound now share it.
- `textObject` ignores a run's `lang` (A): fixed bffcb62847. This needed a behavior call nobody had made, so I made the strict one: any run that names a `lang` sends the text box to the rasterizer. It is recorded in `docs/unruled.md` (audit round 69).
- carried objects skip the auto-length bound (B): not a defect. `docs/unruled.md` (audit round 53) rules that an `lbxObjectsCommand` past the end is still written whole, and leaves skipping it as an open question.
- `rasterDpi` never validated (B): fixed 207c0344a5. `lbxConfig` now throws a `RangeError` for 0, a negative, NaN, or Infinity, and that covers `sceneToLbx` too, since it passes the value straight through.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/p-touch/src/lbx/writeLbx.test.ts`: pass (23 passed)
- `npx vitest run --maxWorkers=1 packages/p-touch/src/lbx/shapes.test.ts`: pass (11 passed)
- `npx vitest run --maxWorkers=1 packages/p-touch/src/lbx`: pass (48 passed)
- each new test failed before its fix: confirmed
- `npm run check:changesets`: pass
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/p-touch`: fail, because the package has no `lint` script ("Missing script"). Its files are covered by the root `npm run lint` in the gate, which passed.

tally: 3 of 4 fixed, 0 extra fixed