- A transition never ends when its tween is canceled from outside (`cancelKey`, `cancelAll`) or a tick throws (A): fixed bcd75d3763. It needed a new public tween option in the animator package, outside the d3 area: `onCancel`, added in 90aa1cae79 with a `minor` changeset.
- Two scenes on one animator interrupt each other's nodes that share an id (A+B): fixed d4193d0271. `transitionCancelKey` now takes the scene as its first argument. That function is unreleased, so I edited its existing changeset instead of adding a breaking one.
- A second transition on a selection snaps nodes back to their pose before the join, and a second one under another name with no `.pose()` pins the pose (A+B): fixed dc26fd25cc. Only the first transition to start on a node after its join tweens it from the prior pose.
- An interrupted item counts as done, so a later `.remove()` deletes the node and a later chained transition restarts it (A+B): fixed 6aabadb24e.
- A chain item queued on a microtask still runs after it is interrupted and kills the newer transition (B): fixed d709eb78ad.
- A `join()` that throws has already canceled the pending exit removals (A+B): fixed a838c3d3bd. All mappers now run before anything changes, so a mapper that throws changes nothing either.
- `start` fires, and starting values are read, before the delay ends (A+B): fixed 645a6918b9.
- Two `.tween()` calls with the same name hang the transition (B): fixed 153e423dcf. The later one replaces the earlier, as d3 does. This is a behavior call nobody had made, so it is recorded in `docs/unruled.md`.
- A missing `lerp` throws only after the transition is marked scheduled, so a second `end()` never settles; it also throws for transitions that tween no pose (B): fixed 73e37059fe.
- `delay(NaN)` silently starts at once while `duration(NaN)` throws (B): fixed d2bd3c75cb. A constant `NaN` now throws a `RangeError` where it is set. A delay function that returns `NaN` warns and starts the item at once. This call is recorded in `docs/unruled.md`.
- An entering datum's `.pose()` is called twice, so a random pose tweens instead of snapping in (B): fixed 3c7f1cec75.

Extra defects found while fixing:
- An item with nothing to tween ended at once, where d3 lasts its duration: fixed 13f409ac46. My dc26fd25cc fix had exposed this.
- My new edge tests' clock had no `now`, so the animator read wall time and the tests were flaky: fixed b2f2cce39d.
- Changes to clear the gate: de6d9de3ee (`types.ts` size cap), b0fd0bc0f8 (`createPart` for the scene token), b945789937 (four changeset titles over 140 characters).

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file, one at a time: pass. `tween.onCancel.test.ts` 2/2, `edges.pbt.test.ts` 1/1, `interrupt.test.ts` 10/10, `transition.edges.test.ts` 15/15. The whole d3 package plus the animator test: 81/81 pass.
- `npm run checks:gate`: first run fail (3 of 32: `check:changesets`, `check:part-caches`, `check:size`). After the fixes: pass, 32 of 32, exit 0.
- `npm run lint -w @weasel-js/d3`: fails with "Missing script: lint". Neither d3 nor animator has a package lint script, so I ran `npx eslint packages/d3` plus the changed animator files instead: pass.
- No browser tests were touched. The tree is clean.