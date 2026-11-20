- Target cache ignores the zoom and stroke setting the boxes are measured at (A+B): fixed 5bbe04450b. The cache key now also includes the session's `drawnBox` function. Each session builds a new one at the zoom and stroke setting it began with, so a later gesture measures again. A zoom in the middle of a drag keeps the boxes measured at press, the same zoom the subject's own box was measured at.
- Two spacing-hints presets given ids both add a `distanceReadout` contribution (A+B): fixed b2c176ea0f. When `id` is given, the readout is now named `<id>.readout`. An explicit `readout.id` still wins.
- Distance readout measures pose boxes while the spacing snap measures ink boxes (A+B): fixed 3fdbc652ab. The readout now measures through the `drawnBoxes` dep, and also requires `boundsIncludeStroke` and `view`.
- A spanned guide is picked anywhere along the whole line (A+B): fixed 8b2462ab28. `guideAt` now skips a press outside the guide's span, allowing `GUIDE_HIT_PX` past each end. This matches the guides layer's default `extent: 'span'`.
- Detaching the rulers leaves view, size, pointer and draft in place (B): fixed 1a172b88e0. Teardown now resets the state through `set` and notifies subscribers.
- `moveBy` test helper throws when given a scene but no ids (B): fixed c0f8a68d56. The helper isn't exported, so there's no changeset.
- Rulers' and distance readout's `leave` bindings have no `mods`, so leaving with a key held doesn't clear them (B): fixed e808d3adb8. Both now use `ANY_MODS`. The tests check the binding spec rather than going through `matchSpec`, because guides doesn't depend on `@weasel-js/gestures`.

No extra defects found. Nothing needed a ruling in `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: pass for `sources/targets.test.ts` (new), `spacingHints/preset.test.ts`, `spacingHints/distanceReadout.test.ts`, `spacingHints/distanceReadout.canvas.test.tsx`, `rulers/createRulers.test.ts`, `sources/testing/session.test.ts` (new), `sources/alignment.test.ts` and `sources/spacing.test.ts`.
- `npm run checks:gate`: the first run failed, because `check:changesets` found 5 changeset titles over 140 characters. I shortened them and folded the fixes into their commits by autosquash onto the frozen commit. The second run passed: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/guides`: fail, because the package has no `lint` script. In its place, `npx eslint packages/guides/src` passed, as did the root `npm run lint` inside the gate.
- `npm run check:changesets`: pass.
- Working tree clean, `.skulk/` untouched.

tally: 11 of 11 fixed, 0 extra fixed