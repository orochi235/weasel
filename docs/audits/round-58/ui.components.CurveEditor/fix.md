- pinned-x endpoints hidden by `hideNonInteractive` though they still move in y (A) — fixed 79dcc4a765
- press on the curve beside a locked or hidden anchor drags it (A+B) — fixed 9aedd0dfa1
- an inverted x range breaks anchor order, pinned-x ends, and the spacing epsilon (A+B) — fixed b80617f71c
- bezier handle arrow keys go the wrong way on a falling segment (A+B) — fixed 732eac9f07
- undo, redo, and arrow keys run while a drag is in flight (A+B) — fixed fe6a8a3e8e
- a one-shot edit that changes nothing (Enter on the selected key or segment) still commits and records an undo step (A+B) — fixed 6b6a3230af
- two layers committing on one key leave a dead undo step (A+B) — fixed 2e330f74ac
- the selected segment's handles stay at the old key position during a key drag (A) — fixed 3d7c1ca1c2
- the RimContour story's partition layer swallows seam presses at any height and on any button (A) — fixed df490868ef (`apps/site/demos/LayeredCurveDemo.tsx` had the same missing primary-press check, fixed there too; no changeset, since stories and demos don't ship)
- a per-layer `--curve-line` recolors only the line, not the anchors or the default fill (A+B) — fixed 395a2799ba (its test is a `*.browser.test.tsx` and is unrun here)
- a click-empty or curve-press insert ignores the layer's `xClamp` (B) — fixed 892a5c2490
- arrow keys move anchors and keys backwards on an inverted axis (B) — fixed d7b873e65d
- dragging a handle on a flat keyframe segment zeroes its stored y (B) — fixed 9ba8cf24fe
- a drag in flight keeps editing and commits after the editor becomes disabled or read-only (B) — fixed 0856c838f3

No extra defects found beyond the demo's copy of the story bug, which is counted under that finding. I made no new behavior calls, so `docs/unruled.md` is unchanged.

Checks:
- `npx vitest run --maxWorkers=1` on each test file, one at a time: pass for `functionAnchorEdits.test.ts` (8), `anchorRules.test.ts` (2), `CurveEditor.arrowKeys.test.tsx` (7), `createKeyframeLayer.test.tsx` (32), `CurveEditor.history.test.tsx` (9), `CurveEditor.hold.test.tsx` (13), `LayeredCurveEditor.editProtocol.test.tsx` (9), `LayeredCurveEditor.stories.test.tsx` (2), `CurveEditor.test.tsx` (50), `CustomLayer.test.tsx` (7), `CurveEditor.cancel.test.tsx` (2) and `CurveEditor.controlled.test.tsx` (3).
- `CurveEditor.browser.test.tsx`: unrun (it needs a real browser).
- `npm run checks:gate`: the first run failed 2 of 32 (one changeset title over 140 characters, and a lint rule on `e.key === 'k'` in a test). I fixed both, folded the fixes into their own commits, and the rerun says "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/ui`: there is no such script in the ui package, and `apps/site` has no `package.json`. Instead I ran eslint on every changed `.ts` and `.tsx` file and the demo: pass.
- `npm run check:size`: pass. The tree is clean.

tally: 14 of 21 fixed, 0 extra fixed

(21 findings were listed, 10 from A and 11 from B; they make 14 distinct defects, and all 14 are fixed.)