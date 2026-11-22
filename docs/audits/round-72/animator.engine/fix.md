`tick` keeps a backward drive from `follow`, freezing the clock (A+B; A and B reported it separately): fixed cc3aeeb82c
`setTarget` on a target spring keeps what waits beside a held target, so it rests at `next` plus that leftover (A): fixed af5a6acd5c
`tick` keeps a backward drive from `follow`, freezing the clock (B's report of the same finding): duplicate of A's, fixed in cc3aeeb82c
A tween started at its end to play backward ends forward at `to` on a frame that does not move the clock (B): fixed c1ab9fd348. The same fix went into plain tweens, target tweens, and handed-off runs.
fakeAnimate's `setup` defines `document.timeline` and never takes it down (B): fixed 0a5a83b793. It restores the timeline through `onTestFinished`, because no caller calls `unmount`.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/animator/src/engine/drive.test.ts`: pass (3 tests)
- `npx vitest run --maxWorkers=1 packages/animator/src/engine/springSetTarget.test.ts`: pass (1 test)
- `npx vitest run --maxWorkers=1 packages/animator/src/engine/handoff/testing/fakeAnimate.test.ts`: pass (2 tests)
- `npx vitest run --maxWorkers=1 packages/animator`: pass (119 files, 1011 tests)
- `npm run checks:gate`: pass ("all 33 passed")
- `npm run lint -w @weasel-js/animator`: not run, because the package has no `lint` script. `npx eslint` on the changed files: pass.

tally: 4 of 5 fixed, 0 extra fixed