From-center line `bounds` are twice the line's extent (A+B): fixed c6f9ae29eb

Space carry runs again after a dropped non-finite frame (A): fixed c084d737f3

Behavior's selection ops are overridden by the press's selection clear, and undo doesn't restore the prior selection (B): fixed e5aae59006

`placeAction` places at the release and ignores `params.press` (B): fixed 1d6f16c2e5

Behaviors' `onMove` get bounds with no minimum size and no line mirroring (B): fixed 036f0e9292. The preview, the commit, and the behaviors now all get their bounds from one function, `insertBox` in `shape.ts`.

A throwing behavior `onStart` leaves the selection cleared and the snap session open (B): fixed 328f133d30. `restoreSelection` moved to `session.ts`.

No extra defects found.

Checks:
- Every test file in `packages/editing/src/actions/insert/`, one at a time with `--maxWorkers=1`: pass. That includes the four files I touched: `insert.behaviorStart.test.ts`, `insert.reposition.test.ts`, `placeAction.test.ts` and `insert.test.ts`. It also includes the two files I added: `insert.lineCenter.test.ts` and `insert.behaviorSelection.test.ts`. Each new test was seen failing before its fix.
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed on typecheck and three changeset titles over 140 characters; both were fixed and folded into their own commits.
- `npm run lint -w @weasel-js/editing`: fail, "Missing script". The editing package has no `lint` script. I ran `npx eslint packages/editing/src/actions/insert/` instead: pass, exit 0.

tally: 6 of 6 fixed, 0 extra fixed