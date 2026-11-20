- Shift on an edge handle breaks aspect and goes under the minimum (A): fixed 783aa04fc4. The same bug also hit Shift on a corner handle, and that is fixed in the same commit.
- An axis with no minimum collapses to zero instead of flipping (B): fixed d1cdd7494d. The public `clampMinSize` constraint behaves the same way now.
- A flipped node with a minimum unflips and jumps, and a flipped member of a shared box is left out of the minimum (A): fixed 3737cc1841.
- Transform Again doesn't hold a frame's contents in place (A+B): fixed 45b4dc4974.
- Transform Again skips the output grid (B): fixed 2d077c13ec. The scene's quantize pass already put the result on the grid, but it knows no anchor, so the anchored side moved. `posesInBox` now quantizes with the anchor and holds contents, and the drag and the command both go through it.
- Transform Again records the dragged box when a constraint's `onEnd` committed its own ops (A+B, B's half b): fixed 04c3919085. This was a behavior call: in that case nothing is recorded, so Cmd+D duplicates. It's recorded in `docs/unruled.md` under "Scene, move, and history".
- Transform Again records the box from before quantization (B, half a): not a defect. A resize repeats as a proportion (`docs/unruled.md`, 2026-10-14), and since 2d077c13ec the replay quantizes the same way the drag does. Recording the rounded box would round each repeat twice.
- A flipped frame's held children are posed against the signed preview, not the normalized pose that commits (A): fixed 11789a8e82.

Extra (sweep): the move and rotate actions also record their drag for Transform Again when a constraint's `onEnd` replaced the commit. Both are outside this area, so I left them; `docs/unruled.md` says so.

Each fix that a consumer could notice has its own changeset (6). Nothing in `docs/TODO.md` or `docs/PERF.md` covered these, so TODO count is unchanged.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `resize.minSize.test.ts` pass (14)
  - `resize.contents.test.ts` pass (3)
  - `resize.quantize.test.ts` pass (5)
  - `resize.lifecycle.test.ts` pass (9)
  - `behaviors/clampMinSize.test.ts` pass (10)
  - the rest of `packages/editing/src/actions/resize/` pass (19 files, 147 tests)
  - `packages/editing/src/actions/transformAgain` pass (22)
- Each new test was run against the original source before its fix and failed there.
- `npm run checks:gate`: pass, "all 32 passed".
- `npm run check:changesets`: pass.
- `npm run lint -w @weasel-js/editing`: not run, because `@weasel-js/editing` has no `lint` script (npm: "Missing script"). I ran eslint on every file I touched instead: pass. The gate's root `npm run lint` passed too.
- No browser tests were touched. The tree is clean.