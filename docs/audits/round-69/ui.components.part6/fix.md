PatternPicker opacity dropped on a tile pick or image upload (A): fixed 2b9a8067a7 (the follow-up 3672533b7e moves its helper out of the component to stay under the size cap)

Drop mark shown in the gap just after the dragged tab, where releasing does nothing (A+B): fixed 32719ce8ea. `useReorderDragList` now sets `targetIndex` to `null` for every gap `isNoopDrop` rejects. That fixes the same wrong mark in ListEditor, EffectList, DataGrid, and TokenField as well as PageTabs. I removed PageTabs' partial checks for it.

Blank or all-space rename commits `''` (B): fixed 4b40bd9dda. A blank commit is now treated as an abandoned rename. This was my call, recorded in `docs/unruled.md`.

PaintInput writes a solid for a mixed or missing value when `kinds` leaves out `solid` (B): fixed b3966c7346 (changeset title shortened in b95c8fc21d). No body shows under the kind bar in that case. This was my call, recorded in `docs/unruled.md`; the rename's entry also landed in this commit.

No extra defects.

Checks:
- `npx vitest run --maxWorkers=1` on each file: useReorderDragList.test.tsx pass, PageTabs.test.tsx pass, PageTabs.along.test.tsx pass, PageTabs.hold.test.tsx pass, PatternPicker.test.tsx pass, PatternPicker.hold.test.tsx pass, PaintInput.test.tsx pass, PaintField.test.tsx pass. The other users of the reorder hook also pass: ListEditor (3 files), EffectList (2), DataGrid (2), TokenField, and ItemList (3).
- Unrun: PageTabs.browser.test.tsx and PatternPicker.browser.test.tsx (browser tests, not edited).
- `npm run checks:gate`: fail the first time (check:changesets: title over 140 characters; check:size: PatternPicker function 124 lines). After the fixes: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/ui`: fail, "Missing script: lint" (the package has none). The gate's root `npm run lint` passed.

tally: 5 of 5 fixed, 0 extra fixed