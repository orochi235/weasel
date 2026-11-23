A dragged key sticks to its own echoed preview (A+B): fixed f95b9609e9. In dope mode, the snap stops are now the ones the drag was pressed with. Graph mode already did this: the gesture started at press keeps the press-time `snapX`.

A stale key pin survives the selection going null, so a controlled re-selection is dropped (A): fixed 00ea2cdacc.

Graph-mode lanes ignore the hold's tab order and focus attributes (B): not a defect. A disabled graph with no reason is `inert`, which takes every mark out of the tab order. With a reason, the graph is marked `data-held` and leaves the description to the timeline. `Timeline.hold.test.tsx` already covers both cases.

During an echoed dope drag the selection index points at a neighboring key (B): fixed ac67a9bfc8. The inspector now reads the drag preview's selection once the tracks show that preview. The preview is cleared on commit and on revert.

A disabled timeline changes its segment selection on an empty press or Escape (B): fixed 5eab64fa27.

[r59-8] A controlled `selection` leaves a selected segment selected beside it (carried): not a defect (no longer applies). A key selection that arrives through `selection` now drops the segment, and the test "closes when a consumer holding the selection selects a key" covers it.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Timeline/Timeline.test.tsx`: pass (63/63)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Timeline/timelineState.test.ts`: pass (6/6)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Timeline/Timeline.hold.test.tsx`: pass (11/11)
- The whole `Timeline/` directory: pass (260/260)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run check:changesets`: pass ("OK — 1007 changeset(s), 52 with warnings"; none of the warnings are in this round's changesets)
- `npm run lint -w packages/ui`: not run, because `@weasel-js/ui` has no `lint` script. `npx eslint` on the changed ui files: pass (exit 0).

tally: 4 of 7 fixed, 0 extra fixed