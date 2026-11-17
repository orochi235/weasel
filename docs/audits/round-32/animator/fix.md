- Target-table `remove` of a row twice, or of a row never added, gave two adds the same row (A+B): fixed 3c90a4529a, now b8cf301db1 after the autosquash. `set` and `target` on a row not in use now throw too.
- Target-table `add` with a wrong-length value leaked a row index (A): fixed b8cf301db1, the same commit as above.
- Target-table `target(row)` on a row not in use read past the table (A): duplicate of the `remove` finding, fixed in b8cf301db1.
- Loop/tweenLoop `count` of `NaN`, a fraction or a negative was accepted (A): fixed 15cf8ae1b4. It now throws a `RangeError`.
- A stagger item whose factory throws left the stagger registered for good (A+B): fixed 75d82416c7. My call: the stagger is canceled along with the items it started, and the throw goes on. Recorded in `docs/unruled.md`.
- A loop whose factory throws stayed registered and kept the frame loop running (B): fixed 75d82416c7, the same commit and the same rule as the stagger.
- `createElementTarget` with `get` and no `set`, or `set` and no `get`, dropped commits (A+B): fixed cafbf35f57. It now throws.
- `Target.commit` on a target at rest never reached `show`, so an element target's style went stale (A): fixed 764d4d4bdb. A commit at rest now calls `show`, then `publish`. Core's `bindRig.pose` already showed after its commit; it now does that only while a run is moving the rig, so it doesn't show twice.
- A joint name with a dot (`spine.001`) came along with `axes: ['spine']` (A+B): fixed b6b1ad4294.
  - `TargetAxes` gets a new optional `paths` field, so the changeset is `minor`, tagged `fix api`.
  - The same mistake applied to plain-object axes, where a field named `a.b` was reached by `a`; fixed in the same commit.
  - My call: a name that is both one axis's name and the start of another axis's path (`arm.x`) throws. Recorded in `docs/unruled.md`.
- `jointShares` counted negative and `NaN` weights that the skin never applies (A): fixed 9336eb87e5.
- `staggerVertexColors` with `anchorMs: 0` painted `NaN`, and took bad delays and origins unchecked (A+B): fixed 12cb1b1489. `anchorMs: 0` now steps each anchor in turn; a negative or non-finite time or origin throws a `RangeError`.
- `ColorOverrideRegistry.set` stored the caller's array, so re-setting it after an in-place edit did nothing (A): fixed 566440f316. It now keeps a copy. Three tests that asserted the stored array's identity now compare by value.
- `ColorOverrideRegistry.target` at a new length dropped painted colors without notifying subscribers (A+B): fixed b2551ac7a5.
- `TrimOverrideRegistry.has` said an override with no edges was painting (A): fixed da462d77a6. A `set` with neither edge now drops the override. The property test's model was updated to match.
- `cancelAll` stopped a color cycle's frames but left its colors painted (B): fixed ae4827394a. `keepAlive` takes a new optional `onCancel`, so this changeset is also `minor`, tagged `fix api`.

No extra defects beyond the general fixes listed above.

Each new test failed before its fix and passes after it. I rewrote my own 12 commits with `rebase --autosquash` onto 4f19c81e25, nothing earlier, to fold in fixes for the size check and one changeset title. One of those fixups first went in broken, an error in the row-index split; it was fixed before the commits below.

Checks, run at the tip:
- Each touched or related test file alone with `npx vitest run --maxWorkers=1`: pass.
  - New: colorCycle.cancelAll 2/2, colorHelpers.stagger 7/7, colorRegistry.notify 2/2, composite.throws 5/5, elementTarget 2/2, loop.count 5/5, targetTable.rows 4/4, trimRegistry.empty 2/2.
  - Changed: colorHelpers 16/16, colorRegistry.target 16/16, weightEdits 11/11, target.axisIndexes 7/7, target.committed 3/3, trimRegistry.pbt 1/1.
  - Related: core bindRig 12/12, loop 15/15, stagger 15/15, targetTable 16/16, holdRows 7/7, colorRegistry 8/8.
- Before the fixups, in passing (not at the tip): every animator test file plus `packages/core/src/animation`, and the core, minimap, editing, prefs and site files that use these targets or color overrides: pass.
- `npm run typecheck:packages -- animator core`: "1/2 animator ok", "2/2 core ok".
- eslint on every changed `.ts`/`.tsx` file: pass, no output.
- `npm run check:size`: "sizes: no file or function grew past its cap."
- `npm run check:changesets`: "[changesets] OK — 1331 changeset(s)."
- No browser tests were touched. The tree is clean, and `.audit-night/` is untouched.