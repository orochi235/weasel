# Diagram arc 1 — derived geometry — handoff

**Branch:** `worktree-arc1-derived-geometry`
**Worktree:** `/Users/mike/src/weasel/.claude/worktrees/arc1-derived-geometry` — work there, not in the main checkout, where another session is committing.
**Baseline when the worktree was cut:** 5004 tests passing.

## What this is

Arc 1 of the diagram plugin. Design: `docs/superpowers/specs/2026-08-28-diagram-plugin-design.md`.
Plan being executed task-by-task: `docs/superpowers/plans/2026-08-28-derived-geometry.md`.

Read the plan, not this file, for what to do — the plan carries the code and the
step sequence, and it has been corrected four times against the real tree. This
file only holds what the plan cannot: current state, and the decisions made in
conversation that are written nowhere else.

## Done

- **Task 1 — dependents index.** `packages/core/src/core/scene/dependents.ts`.
  Commits `49ef0b47`, then `b5e0ba9f` fixing review findings.
- **Task 2 — `dependsOn` / `derive` through the scene.** Commits `c26a7dbd`,
  then `38146517` fixing quality-review findings. Both reviews passed.
  5018 tests, 0 type errors.

## Next

Task 3 in the plan — invalidation. Then 4 (paint path), 5 (cascade delete), 6 (docs).

Method: `superpowers:subagent-driven-development`. One implementer subagent per
task, then a spec-compliance review, then a code-quality review, each verified
independently rather than taken on report. That loop has caught a real defect in
every task so far, so do not shortcut it.

## Decisions made in conversation, not derivable from the code

**Task 4 will break an exported signature. Mike has been told and has not
responded.** `defaultDrawOne` (exported from `packages/core/src/index.ts`) widens
to `(node, pose, view, ctx?)`. Today the scene walk passes a `View` into a
parameter typed `NodePaintCtx`, and it only compiles because every `NodePaintCtx`
field is optional — which means **`resolveImage` is silently always `undefined`
on both the live and headless walks.** Widening was chosen over an overload per
Mike's "break compatibility rather than add a compat path" default. If he objects,
the alternative is a separate ctx-carrying wrapper and Task 4 changes shape.

**`derive`'s node parameter is `Node<unknown, string, TPose>` and must stay
widened.** Narrowing it to `Node<TData, TLayer, TPose>` puts those parameters in a
contravariant position, makes `Scene` invariant in both, and breaks ~80
`Scene<Concrete>` → `Scene<unknown>` assignments across `packages/d3`,
`apps/draw` and `SceneCanvas` — with an error that never names the cause.
Method syntax also fixes it, by opting into bivariance; that was rejected because
it disables parameter checking on `derive` permanently. The precedent for the
widening is `NodePaintCtx.resolveImage`.

**The spec is wrong about arc 1's proving consumer, and Task 6 fixes it.** The
spec names the group-bounds defect (`interactions/actions/defaults/group.ts:68`)
as arc 1's first consumer. It cannot be: stale group bounds are a derived *pose*,
an edge is a derived *path*. Derived pose reaches into bounds, hit-testing,
selection chrome and layout, so it is a separate and more invasive arc (1b).
The consequence worth knowing: arc 1 therefore has **no non-diagram consumer**,
which weakens the case for putting it in core rather than in the plugin. The
argument still stands on the edge alone, but it is thinner than the spec claims.

**Index maintenance belongs in the op handlers, never the scene's public
methods.** `scene.add()` / `scene.remove()` run once; `kit:add` / `kit:remove`
`apply` and `revert` replay on every undo and redo, and replaying a delete never
re-enters `scene.remove()`. Maintaining the index from the public methods leaves
stale entries after a redo. Tabled in the plan's Task 2.

## Traps found the hard way

- **A pose override mutates its buffer in place rather than replacing the
  reference** — which is what a drag does. No reference-keyed memo can see it, so
  invalidation is *pushed* by the scene, never pulled by comparison. Task 3's
  pose-override test is the guard, and it still fails after the obvious fix
  passes. Watch it fail before fixing it.
- **`clipFromPose` threads through eight sites, not the obvious two.** The one
  that fails silently is the redo cache: `kit:add` replays without the original
  spec, so a function attached only at add time vanishes on redo. That cache also
  needs `onEvict` pruning or it leaks.
- **The redo cache must not be primed from the construction path.** Nodes added
  via `options.initial` / `loadState` go through `runOp`, not `executeAndLog`, so
  no `kit:add` ever enters history for them — and `pruneCacheForDroppedOps` scans
  only `kit:add`. Their entries could never be pruned. They were also never read:
  with no `kit:add` to replay, a restore after `remove` comes from `kit:remove`'s
  revert, which clones the node and carries the function along. Fixed for
  `clipFromPose` too, where the leak was pre-existing.
- **A test for the missing-registry-key warning passes vacuously if written the
  obvious way** — with an empty registry the key never reaches the payload at all.
  It has to go through `serializeHistory` → `restoreHistory` into a second,
  registry-less scene.

## Unrelated, noticed in passing

`main` is 82 commits ahead of `origin/main`. Nothing has been pushed; Mike has
not been asked.
