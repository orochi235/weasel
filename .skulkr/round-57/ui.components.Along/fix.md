- Whole-circle drag across the seam throws the scroll to one end (A): fixed 4a6fbd5a87
- Slot hosts' nested items never get `touch-action: none` (A): fixed 40d03132b0
- `useRunText` maps client points by bounding-box scale, wrong under a rotated ancestor (A): fixed d005b92679. It now maps through the row's band with `boxPoint`. `turnOf` was not a defect: the copy is laid in the root's frame, so the item's own transform is the right turn.
- `CurvedLabel` outside an `Along` is absolutely positioned (A): fixed 8a9ff88c9b
- `useItemLengths` keeps every key it has ever seen (A): fixed 1d83dbb93c, plus e1f45493eb (an effect dependency that lint flagged)
- `seenUnder` compares keys joined with `'\n'` (A): fixed 818e2c2232
- LensRim lab saves an uncapped list of marks (A): fixed fd0d8d0d57. It now keeps the last 100. The lab isn't shipped, so no changeset.

B.md was empty, so every finding came from A alone.

Extra:
- `BarAlong` read the More button's length from `useItemLengths` without listing `BAR_MORE` in its keys. Pruning would have dropped that length while the button was hidden, so `BAR_MORE` is now listed; this is in 1d83dbb93c.
- Two changeset titles were over the 140-character limit; shortened in a separate commit after it.

Checks:
- Each test file I touched, run one at a time: useRunScroll.test.tsx 14 passed, runRow.test.ts 1 passed, runText.test.ts 1 passed, CurvedLabel.test.tsx 6 passed, useItemLengths.test.tsx 2 passed, runSlots.test.tsx 7 passed, lab/LensRimView.test.ts 1 passed — pass
- Consumers: useRunRow.test.tsx 6, Bar.along.test.tsx 24, PageTabs.along.test.tsx 5, RadioGroup.along.test.tsx 4, segmentsAlong.test.tsx 11, SwatchGrid.along.test.tsx 16, Tabs.along.test.tsx 6 — pass
- Browser tests ran on this node: Bar.along.browser.test.tsx 12 passed, lab/LensRimView.browser.test.tsx 4 passed — pass
- `npm run checks:gate`: "checks:gate: all 32 passed" — pass. The first run failed on `check:changesets` (title length); I fixed it and reran.
- `npm run lint -w @weasel-js/ui`: the package has no `lint` script ("Missing script: \"lint\""), so its lint is the root `npm run lint`, which passed inside the gate.
- Tree clean apart from `.skulkr/`.

tally: 7 of 7 fixed, 1 extra fixed