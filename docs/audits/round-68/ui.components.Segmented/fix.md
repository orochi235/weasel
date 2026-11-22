Four findings in this area: each one held up against the code, each is fixed in its own commit with a test, and the full gate passes. The two CSS tests are browser tests, so they couldn't run here and I haven't seen them fail before the fix or pass after it.

- Flat bar on a curved `Along` shifts every segment after the first by 1px (A+B): fixed 73eb6ac554. The straight row's -1px overlap rules now apply only to the straight row's root, so they no longer beat the curved stylesheet's `margin: 0`.
- Disabled, Tall, Minimal, and AllowDeselect stories render a radiogroup with no accessible name (A+B): fixed 85c32d980f. I added an `aria-label` to each story's `args`, plus a jsdom test that renders every story and checks each bar has a name. The test failed on exactly those four before the fix. Stories aren't published, so there's no changeset.
- A canceled sweep's `document` listeners outlive the bar, and each further cancel adds another set (A): fixed d8ca87257d. The guard keeps its current teardown, runs it on unmount, and clears the old set before a new cancel adds its own. This also covers `ToggleChips` and `CheckboxGroup`, which use the same hook.
- A lone segment in a vertical flat bar loses its top corners' rounding (B): fixed 10a2edd5a0. I added an `:only-of-type` rule that rounds all four corners.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Segmented/SegmentedBar.stories.test.tsx`: pass (14 passed; 4 failed before the fix)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Segmented/segmentSweep.test.tsx`: pass (2 passed; both failed before the fix)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Segmented/SegmentedBar.sweep.test.tsx`: pass (12 passed)
- `packages/ui/src/components/Segmented/segmentsAlong.browser.test.tsx`: unrun (browser)
- `packages/ui/src/components/Segmented/segmentedControl.browser.test.tsx`: unrun (browser)
- `npm run check:changesets`: pass (OK, 139 changesets)
- `npm run checks:gate`: pass (all 33 passed, root `npm run lint` among them)
- `npm run lint -w @weasel-js/ui`: fail. `@weasel-js/ui` has no `lint` script, so npm reports a missing script; eslint over the tree passed as part of the gate.

The tree is clean apart from `.skulkr/`.

tally: 4 of 4 fixed, 0 extra fixed