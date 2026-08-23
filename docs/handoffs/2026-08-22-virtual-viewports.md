# Virtual viewports — handoff

**For:** the next session picking this up. **Answers:** where to start, what is already decided, and
what a survey found that the spec compresses.

## State

Nothing implemented. The design is
`docs/superpowers/specs/2026-08-22-virtual-viewports-design.md` — read it first; this file only
carries what it does not.

Worktree `.claude/worktrees/renderer-layer-caching`, branch `worktree-renderer-layer-caching`,
off local `main` at `e28996aa`. Not pushed, no PR. The branch also carries a finished renderer
layer-caching arc — see `docs/handoffs/2026-08-22-renderer-layer-caching.md`. Suite green: 677
files, 7079 passing.

**Decide before starting:** whether virtual viewports belong on this branch or a fresh one off
`main`. The layer-caching arc is complete and independently mergeable; stacking a large
decomposition on top makes it harder to land.

## Decided in conversation

**Decompose, do not build a parallel component.** A second multi-view surface alongside
`SceneCanvas` would avoid regression risk but buy permanent duplication and drift. The repo's own
scope rule names "two things should be one thing" as a fair argument, and it applies here.

**The flat-props façade is a design constraint, not a later wrapper.** A single-view consumer must
never see a `views[]` array. Retrofitting the façade at the end yields a lossy translation over a
multi-view core, and single-view is the path every existing consumer is on.

**Consumers pay nothing; the codebase pays.** N=1 is the degenerate case — no branch a
single-view consumer takes that it does not take today. The costs are a permanent maintenance tax
(every future selection/tool change must be correct for N) and one-time regression risk landing on
people who never asked for the feature. Accepted knowingly. Worth measuring rather than assuming:
whether the decomposition adds indirection to hot draw and hit-test paths that are direct field
reads today.

## What the survey found that changes the approach

**There is no `gl.scissor` in the renderer.** Clipping is stencil-based. An earlier framing of this
work assumed scissor rects; that was wrong. Do not add a GL scissor path.

**`features/viewports/viewportLayer.ts` already draws nested views** — clip groups with an inner
`View`, plus `reproject` and `viewportsAt` for inverse mapping. It is `@experimental` and does not
route input. **The draw half is largely built.** This is why Arc 1 in the spec is small and Arc 2/3
are not.

**An unresolved discrepancy blocks Arc 1.** `viewportLayer` calls `layer.draw(data, view, …)`
without the `viewToMat3(view)` wrap that `drawLayers` applies (`core/layers/render.ts:182-186`).
They cannot both be right. Settle this first — it determines whether existing viewport-layer
consumers are drawing correctly today.

## Traps

**Never `git stash` in this worktree.** The stack is shared across worktrees and concurrent
sessions; an agent used it during the previous arc and swallowed another agent's uncommitted work.
Same for `git reset --hard`, `git checkout -- .`, `git clean`. If you run parallel agents, give them
disjoint files *and* forbid these commands explicitly — naming the files is not enough.

**Every changeset is `patch`.** Never write a `bump-approved` marker without an explicit OK.

**Verify a capability claim by reading the module, not by grepping two files.** The layer-caching
spec asserted two "renderer gaps" that both already shipped, found by grepping `DrawCommand.ts` and
`draw.ts` and reading their silence as absence. One of those false claims drove a design decision
for several rounds before it was caught.

**Tests:** `npx vitest run --project=kit` for core, `npm test` for all. No `test` script in the
`core` workspace. Typecheck is `npx tsc --noEmit` from the root; there is no
`packages/core/tsconfig.lib.json`.
