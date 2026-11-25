Lasso thresholds in world units, so a deep zoom turns a real lasso into a click (A): fixed 9842175e32 (vertex spacing is now in screen px). b63aea2bc9 also dropped the 4-world-px² area threshold.
A flat lasso clears the selection while a flat marquee selects what it crosses (A): fixed b63aea2bc9. A lasso is a click only when it has fewer than three vertices, so a flat drag hit-tests like a flat marquee. This reverses 37daa58924's "sliver lasso is a click" in favor of the marquee's rule.
Pathfinder `enabled` checks the count on `operands` but `run` acts on the adapter's selection (A): fixed 726e1121d7
Clone records the raw drag delta for Transform Again when a behavior placed the copies elsewhere (A): fixed 3b3014f554. It now records the offset the copies actually moved, or forgets the last transform when the copies moved by different offsets.
A clone behavior that claims the commit with no ops still records a duplicate (B): fixed 3b3014f554. Nothing is recorded now. Telling `onSettled` `committed=true` is correct here: the `onSettled` contract says a claim with no ops counts as a commit.
`transformSelection` checks locks on the unfinished batch, so the lock guard throws on a follower's write (A): fixed 527c984fcd
Align, Distribute, Flip, and Swap `enabled` ignore the transform followers `run` commits through (B): fixed 527c984fcd. New shared `transformAnswer`/`commitTransform` helpers in `lockedWrites.ts` finish the batch once, and both `enabled` and `run` read that finished batch.
Transform Again on a locked rotate answers NotApplicable, not Locked (B): fixed 44240dcfb2
Make Boolean Group ignores locked operands (B): fixed 7e95b1f0c0. It is disabled with `Locked` like Group, `run` writes nothing, and `makeBooleanGroup` returns null.
Flip mirrors data-held geometry using only the parent frame's rotation, so it is wrong under shear or uneven scale (B): fixed 5f81bc9014. The frame is now read from three probe points and the mirror conjugated by the full linear map. Reproduced first: the line was off by 60 units under a shear of `[1, 0, 1, 1]`.

Extra: Nudge had the same unfinished-batch lock check as Align and the others (sweep): fixed 527c984fcd. The unused internal `translateSelection` was removed.
Extra: Transform Again on a resize of a locked node answered NotApplicable instead of Locked, and an existing test asserted the wrong reason (sweep): fixed 44240dcfb2

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: clone.container 5 passed, flip.shear 1 passed, selectFromLasso 9 passed, lassoSelect 21 passed, pathfinder/action 10 passed, booleanGroupAction 7 passed, transformAgain 18 passed, transformFinish 17 passed. Also passed: align 65, distribute 33, flip 33, swap 8, rotate 76, resize 147, nudge 16, nudge.subtree 4.
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: all 33 passed
- `npm run typecheck:packages -- editing`: pass
- `npm run check:changesets`: OK, no warnings on the new changesets
- `npm run lint -w @weasel-js/editing`: not run; the package has no lint script. The root `npm run lint` passed inside the gate.
- Browser tests: none touched.

tally: 10 of 10 fixed, 2 extra fixed