TODO count is unchanged: no `docs/TODO.md` entries filed or retired.

- **A key dragged past `duration` lands where no window can show it** (A): fixed 067cd36bcc. Dragged, arrow-stepped and double-click-inserted keys now stop at the duration, in dope and graph mode.
- **The held key selection is never checked against the tracks** (A): fixed 7dd4c69552. The key and segment selections now follow one rule: each is dropped once its track's kind, label or key times change through an edit the timeline didn't send. A dropped key selection is reported as `null`. This was my call; it's recorded in `docs/unruled.md`.
- **Fold state is keyed by index path** (A): fixed 54d6bcdf64. Nested rows now fold by their timelines' labels (or kind, when unlabeled), counted among same-named siblings. This was my call; it's recorded in `docs/unruled.md`.
- **Inserting into an empty sampled track seeds a numeric `0`** (A): fixed af0aae7f6c. The new key takes the track's target value, or 0 when the track has no `interpolate` or `interpolator`. Otherwise nothing is inserted and it warns, unless the new `seedKey` prop supplies a value. This was my call; it's recorded in `docs/unruled.md`.
- **A nested bar ignores where its parent stops playing it** (A): fixed 5c2699de2c.
- **Graph-mode lanes ignore the hold's tab order and focus attributes** (B): not a defect. A disabled timeline with no reason renders its graph `inert`, with `aria-disabled` and `tabindex=-1`, so the marks already leave the tab order. With a reason, only the plot carries the reason, which is the curve editor's stated policy.
- **The key selection survives edits that move its index; the segment selection is dropped** (B): duplicate of the second item (A's key-selection finding), fixed in 7dd4c69552.
- **Delete on the transport, Graph switch or inspector deletes the selected key** (B): fixed 434d4dc5cc.
- **Nested-row marks are named by track-local time** (B): fixed 84f2f4ccd9. It also fixed the same naming in graph mode.
- **[r59-8] A controlled `selection` set by the consumer leaves a selected segment selected** (carried): not a defect (no longer applies). A key selection arriving through `selection` drops the segment, and the existing test "closes when a consumer holding the selection selects a key" covers it.

No extra defects were fixed. Two follow-up commits (c36cc18be1 and the one after it) only shorten changeset titles that `check:changesets` warned were over 140 characters.

Checks:
- Each test file, run on its own with `--maxWorkers=1`: `Timeline.test.tsx` 61 passed, `Lane.test.tsx` 63 passed, `lanes.test.ts` 18 passed, `keys.test.ts` 29 passed, `keys.pbt.test.ts` 4 passed, `timelineState.test.ts` 5 passed, `AnimatedTimeline.test.tsx` 18 passed, `Timeline.hold.test.tsx` 10 passed. Every new test failed against the frozen sources before its fix. No browser test file was touched.
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/ui`: can't run, because `@weasel-js/ui` has no `lint` script. The gate's root `npm run lint` passed.
- `npm run check:changesets`: "OK — 905 changeset(s)". The one remaining warning among the timeline changesets is on `timeline-fold-drops-selection.md`, which isn't mine.
- Tree is clean.

tally: 8 of 10 fixed, 0 extra fixed