A targeted sampled track nested in two places undoes its own hold, A+B: fixed 8f52e72b96

An event track added by `edit` or moved to a new `at` books every past event at once, A+B: fixed 3a7248387d

The booker's cursors pile up for every track and nested offset ever seen, pruned only by a seek, A+B: fixed 81a0c97001 (moving a nested track back to an old offset also rebooked from that offset's stale cursor; fixed in the same commit)

An `edit` to a held track's `weight`, `axes`, or `target` is ignored while the playhead is within its keys, A: fixed 8cd8775fee

A seek from a handler on a lap's tail fires the landing's events in the same frame, A+B: fixed 12dfd88ea7

A revived timeline re-registers the first row's mutated seed, `ended: true` included, B: fixed 424b5e26dc

`rearm` judges direction by the timeline's own scale and ignores the animator's direction, B: fixed b40f29a49b (`Table` now exposes `direction()`, and `createTimeline` takes it)

An `edit` that cuts `duration` below the playhead leaves the playhead past the end, B: fixed c01ddbf24e

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on each test file touched or related, one at a time: revive.watch (new) 4 passed, events 23 passed, edit 10 passed, booking 32 passed, targets 19 passed, revival 27 passed, holds 3 passed, nesting 9 passed, timeline.pbt 5 passed. pass.
- `npm run checks:gate`: "checks:gate: all 32 passed". pass. The first run failed typecheck, typecheck:packages (a test pushed to a readonly array), and check:changesets (titles over 140 characters). Both were fixed and folded into their commits.
- `npm run lint -w @weasel-js/animator`: the package has no `lint` script (npm: missing script). In its place, eslint on every changed `.ts` file: pass (exit 0).
- The tree is clean, and `.skulkr/` is untouched.

tally: 8 of 8 fixed, 0 extra fixed