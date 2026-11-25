Delete on a key on a folded nested row (A): fixed 383b0b959b

Delete on a stale held selection index reports a change that did nothing (A+B): fixed 383b0b959b

Marks before the window's start draw over the label column and take its presses (A+B): fixed 9aec0871fe

A disabled timeline's ruler swallows page scroll and Ctrl+wheel (A): fixed f892c6bcdd. This also makes `TimeRuler`'s `onWindowChange` optional, with its own `minor` `api` changeset.

A dope drag released on its own start time leaves its preview standing with no `onChange` or `onCancel` (A+B): fixed 1f702a9e72. This needed a behavior call nobody had made, so I made the strict one: the drag now sends `onInput` the tracks it began from, then calls `onCancel`. It is recorded in `docs/unruled.md` under "Audit round seventy (2026-11-22): ui's Timeline".

A key press that changes nothing leaves `refocus` set, and a later render moves focus to the selected key (B): fixed a39a1fd5ae

A nested row's end and its bar's length read a nested timeline's `duration` two different ways (B): fixed d09e9f8cd6

The press guard against keyboard edits is released by any pointer, not the one that pressed (B): fixed 5e1fc628a6

[r59-8] A controlled `selection` leaves a selected segment selected beside it (carried): not a defect (no longer applies; 28f3eda9fc makes a key selection that arrives through `selection` drop the segment, in `useKeyAndSegment`)

No extra defects found.

Checks:
- Each new test failed before its fix and passes after it.
- `npx vitest run --maxWorkers=1`: `Timeline.test.tsx` pass (47), `Timeline.hold.test.tsx` pass (10), `Lane.test.tsx` pass (56), `lanes.test.ts` pass (16), `TimeRuler.test.tsx` pass (19), `AnimatedTimeline.test.tsx` pass (18).
- `Timeline.browser.test.tsx` is new and unrun here (browser test).
- `npm run checks:gate`: pass ("checks:gate: all 33 passed"), including `check:changesets`, typecheck, and root `lint`.
- `npm run lint -w @weasel-js/ui`: fail ("Missing script: "lint""). The package has no lint script; the gate's root `lint` covers it and passed.
- The tree is clean apart from `.skulkr/`.

tally: 11 of 12 fixed, 0 extra fixed