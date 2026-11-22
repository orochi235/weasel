Group runs over a locked member and throws from the scene, from A: fixed 57172b77f2 (my call, recorded in `docs/unruled.md`: Group is disabled with `Locked` while a member, its container, or a follower it moves is locked)

Paint actions write to locked targets, through `ids` or the selection, from A+B: fixed 9157067923 (my call, recorded in `docs/unruled.md`: disabled with `Locked` while any target is locked, and the run writes nothing; it does not skip the locked node and paint the rest)

Nudge's run moves the raw selection, page included, from A: not a defect (the move path already leaves pages out; a probe test with a page and a shape selected left the page at x 0 and moved only the shape, and a page plus a locked node gets the same `Locked` answer from `enabled` and `run`)

Duplicate and Group take the raw selection, page included, from A: not a defect (`copyOps` and `groupPlan` both go through `rootsAmong`, which drops page structure first; a probe duplicate of a page and a shape added one node)

Paint write equal to the inherited paint detaches an `'inherit'` node, from A+B: fixed 649a3d3b81

setStrokeWidth with no usable width gives a strokeless node a default stroke, from A: fixed 926231caab

setFill and setStroke None on a node with no paint writes `{}` and an undo entry, from A: fixed 641d194594

Explicit `ids` naming missing nodes stay enabled and preview nodes that do not exist, from B: fixed b5e068f564 (an empty or all-missing `ids` is now `NotApplicable`)

setStrokeOpacity on a stroke with no paint and no width writes a widthless stroke, from B: fixed dc7877ab2b (`setStroke` and `setStrokeOpacity` now share one `strokeUnderPaint` helper)

setStrokeWidth passes `vertexWidths` through unchecked, from B: fixed feccfaaac5

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `paintInherit.test.ts`: pass (8)
  - `paintTargets.test.ts`: pass (5)
  - `group.locked.test.ts`: pass (1)
  - `setStrokeWidth.test.ts`: pass (6)
  - `paintUnchanged.test.ts`: pass (7)
  - `setStrokeOpacity.test.ts`: pass (9)
  - Also run unchanged as regressions: `group.test.ts` (25), `group.marks.test.ts` (2), `group.frame.test.ts` (4), `setFill.test.ts` (20), `setStroke.test.ts` (21), `setVertexColor.test.ts` (4) and `pageStructure.test.ts` (4), all pass.
  - Each new test failed against the code before its fix.
- `npm run check:changesets`: pass ("OK — 302 changeset(s)").
- `npm run checks:gate`: pass ("all 33 passed").
- `npm run lint -w @weasel-js/editing`: not run, because `@weasel-js/editing` has no `lint` script. The root `npm run lint` inside the gate passed.

tally: 8 of 10 fixed, 0 extra fixed