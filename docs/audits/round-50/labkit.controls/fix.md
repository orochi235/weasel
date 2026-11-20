- Uncontrolled panel loses all but the last write's unpin when one reset writes several leaves (A+B): fixed 45b1f1b3d4
- An alias row into `over` offers a reset that writes nothing (A+B): fixed 6adb94e5aa (the panel's own `prefs` source now reads and plans such paths in `over` too)
- An `inDialog` body's `update`, `drafts` and `each` go past the draft (A): fixed 73c7f5f78c
- A group drawn `as: 'section'` drops its `resettable` reset and its `.heading()` lift (A+B): fixed 844465011f
- A `.dialog` auto readout never quotes its value under `.quote()` (A): fixed 3ccd699dac
- AutoControls story says an auto row draws no control (A+B): fixed 7f4fd6fa62 (story text only, so no test and no changeset)
- `inDialog` ignores the row's `disabled`, so the dialog still opens and writes (B): fixed 6a5fff8a5e
- A matrix cell that aliases an enum opens a dropdown and stays open after a choice (B): fixed fb8c736904
- An uncontrolled panel's auto set never follows a new `schema` (B): fixed e3d2659804. This was a behavior call, now recorded in `docs/unruled.md`. The set starts afresh when the schema's leaf paths or start-auto paths change. It is kept across a schema that is resolved anew with the same ones, because `resolveConfigSchema` returns a new object on every call. So two trials of one shape in one mounted panel share pins, unless the lab keys the panel by trial.

Extra:
- `packages/ui/src/components/SpanStrip/SpanStrip.module.css` failed labkit's design-token check, which failed `lint -w @weasel-js/labkit` (sweep; this came from a recent main commit, not from this area): fixed 866cf65bc5. It computes the same values as before, so no changeset.
- `apps/draw/src/dev/audits/Treemap.module.css` failed `check:numeric` (sweep; outside this area): fixed bbf5c8f708. Composing the theme's `.numeric` also sets the numeric font family on that count.
- `ControlRow.tsx` went over the size cap (409 lines, 122-line function) because of my 6adb94e5aa: fixed f53ce09620. This is a follow-up to my own change, so I don't count it as an extra defect.

Checks:
- Each test file run alone with `npx vitest run --maxWorkers=1`: ControlPanel.autoOwn 3/3, ControlPanel.over 6/6, ControlPanel.sections 21/21, inDialog.cancel 6/6, inDialog 17/17, ControlMatrix.over 8/8, ControlMatrix 18/18, ControlMatrix.grid 4/4, ControlMatrix.conditions 5/5, ControlPanel.auto 20/20, ControlPanel.autoLive 10/10, ControlPanel.autoOptIn 3/3, ControlPanel.autoReport 8/8, ControlPanel.alias 5/5, headingControl 13/13, ResetGroup 2/2, compoundRows 6/6, ControlPanel.readouts 9/9, ControlPanel.drafts 8/8, ControlPanel.renderers 5/5, ControlPanel.conditions 6/6, inDialog.commit 6/6, ui SpanStrip 15/15. All passed.
- `npm run checks:gate`: the first run was 2 of 32 failed (check:size, check:numeric). After the fixes: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/labkit`: pass, exit 0. `@weasel-js/ui` has no lint script.
- I touched no browser test files. The tree is clean, and `.skulk/` is untouched.

tally: 13 of 13 fixed, 2 extra fixed