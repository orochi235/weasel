Join leaves out per-anchor colors it cannot join (A): fixed 2d4b017e12

`facesAlong` hangs on a zero step (A+B): fixed 51555f30eb. My call: it now throws a `RangeError` for a step that is zero, negative, NaN, or infinite. This is recorded in `docs/unruled.md` under round sixty-six. Making it fall back to one sample per segment was the alternative.

A retarget leaves a stale `foundHidden` entry behind (B): not a defect. Every write to `dependsOn` goes through `scene.setDependsOn`, which calls `foundHiddenRetargeted` (`packages/core/src/core/scene/pathEffects/foundHidden.ts`). That function moves `foundHidden` by source id and drops any source the new list no longer names. So Set Path, Set Spine, and Release Spine all clear the old index. The existing test "keeps its record of the sources it found hidden in step through Release Spine and Set Spine" in `spine.test.ts` already checks that the record is cleared.

Checks:
- `npx vitest run --maxWorkers=1 packages/path-tools/src/pathCommands/pathCommands.test.ts`: pass (20 passed). Without the fix, the new test failed: 1 failed, 19 passed.
- `npx vitest run --maxWorkers=1 packages/path-tools/src/shapeBuilder/shapeBuilder.test.ts`: pass (9 passed)
- `npm run check:changesets`: pass ("OK — 3 changeset(s).")
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/path-tools`: not run, because the package has no `lint` script. Root `npm run lint` passed inside the gate.

tally: 3 of 4 fixed, 0 extra fixed