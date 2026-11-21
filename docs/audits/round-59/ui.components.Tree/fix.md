All ten distinct findings are fixed, one commit each, and the tree is clean. Nine of the fixes have changesets; the fixture cleanup has none because a consumer can't see it. Every behavior fix has a test that I watched fail before the fix and pass after it. I made one behavior call myself, the refused Alt+Right indent under a closed disabled branch (finding 8), and recorded it in `docs/unruled.md`.

- Click on a control in a linked treegrid row had its default prevented and lost focus to the row (A): fixed 735ce15579
- Drag under a selected immovable ancestor carried nothing and called `onMove([])` (A+B): fixed 0245cd5cc4
- Disabled rows moved by Alt+arrow, and a dragged selection carried them (A+B): fixed f7cea9f6f3. The pointer drag, the keyboard move and the carried selection now share one rule.
- Hover-expand opened a disabled branch (A+B): fixed e2ebe340a7. `expand` now refuses a disabled node or a held tree, as `toggle` does. Alt+Right no longer indents a row under a closed disabled branch, since the branch could not open to show it.
- Leave call to `onDragOutside` always said `'move'` (A+B): fixed 898c74c412
- Forwarded ref kept the old element after the `ul`/treegrid swap (A): fixed 44cc327acb
- With `onMove`, a plain click on an `href` row followed the link, and a Cmd/Ctrl/Alt click activated the row (A+B): fixed 6729b628e2
- Row tooltip kept a removed element and reopened on it (A): fixed b58491cd5e
- A disabled or read-only tree still drew external drop marks and answered `dropRef` (A): fixed 39d1bf28a2
- Two copies of `applyMove` in the fixtures, plus a package-path import in one (A+B): fixed 90dcfb895e. The stories and the property tests now share one implementation, and the import is relative.

Extra defects: none.

Checks:
- Tests, each file run alone with `--maxWorkers=1`, all pass:
  - `Tree.href.test.tsx` 14 passed (14)
  - `treeMoves.test.ts` 7 passed (7)
  - `treeMoves.pbt.test.ts` 6 passed (6)
  - `Tree.controls.test.tsx` 8 passed (8)
  - `Tree.drag.test.tsx` 35 passed (35)
  - `Tree.tooltip.test.tsx` 6 passed (6)
  - `Tree.hold.test.tsx` 12 passed (12)
  - `Tree.test.tsx` 35 passed (35)
  - `Tree.kitSettings.test.tsx` 8 passed (8)
  - `Tree.selectionKeys.test.tsx` 3 passed (3)
- Not run: `Tree.browser.test.tsx` imports the shared `applyMove` and is a browser test, so it cannot run here.
- `npm run checks:gate`: the first run failed because eight changeset titles were over 140 characters. I rewrote them and folded the fixes into their own commits. The second run: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/ui` has nothing to run: `@weasel-js/ui` has no `lint` script. `npx eslint packages/ui/src/components/Tree` passed (exit 0).
- `npm run typecheck:packages -- ui`: "1/1 ui ok".

tally: 16 of 16 fixed, 0 extra fixed