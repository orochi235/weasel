useSceneStream disposes its memoized stream on effect replay, and a discarded render leaks an edit pass (A+B, counted as two) — fixed 35995be859, duplicates of each other
usePointerStylus misses an element from another window (A+B, counted as two) — fixed 2134fb170b, duplicates of each other; it also accepts any `Element` now, so an SVG one works (changeset `minor`, tagged `fix api`)
stableStringify writes NaN, the infinities, and null as one string (A) — fixed bdae4bad48
AreaSelectAdapter doc says the marquee needs its four methods (A) — fixed 1e144e173f
shapeKinds header says it imports nothing at runtime (A) — fixed 491957a50a
dropping a cell removes adopted nodes under or deriving from a streamed node (B) — fixed 757526f432
a cell load that throws partway through `scene.add` leaks the nodes it added (B) — not a defect (`scene.untracked` reverts its function's writes when it throws, as `Scene.untracked`'s doc says; the new test in `streamScene.test.ts` confirms the scene is left empty)

extra: undoing a recorded removal of a streamed child had no parent to restore it under once the cell dropped (sweep) — fixed 757526f432, part of the release fix, with its own test that fails without it

checks:
- `npx vitest run --maxWorkers=1` on `stableStringify.test.ts` (8 passed), `stableStringify.pbt.test.ts` (3 passed), `stream/streamScene.test.ts` (5 passed), `stream/useSceneStream.test.tsx` (2 passed), `stylus/usePointerStylus.test.tsx` (10 passed), and `teardown.test.tsx` (27 passed): pass
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/core`: not run, because `@weasel-js/core` has no `lint` script. The root `npm run lint` passed inside the gate.

tally: 8 of 9 fixed, 1 extra fixed