# Virtual viewports — handoff

**For:** the next session picking this up. **Answers:** where the work stands, and what the design
spec does not carry.

The design is `docs/superpowers/specs/2026-08-22-virtual-viewports-design.md` — read it first. It is
current: Arcs 1, 2 and 3 are marked done there, with the reasons.

## State

**Landed on `main`** at `f19a8f84`, after the renderer layer-caching arc at `99783cf2`. Not pushed.
Suite green at the merge: 682 files, 7152 passing. Arcs 1, 2 and 3 are all done — a view carries
its own camera, dispatcher, selection, chrome, affordances and hit-testing, and the per-view layer
command cache that Arc 1 was waiting on went in with the caching arc.

**The two branches conflicted in one function, as predicted, and the merge is one function doing
both jobs.** `drawOneLayer` now wraps a private `layerCommands` — cache lookup inside, space wrap
around the result. What the cache holds is the layer's *raw* output: the wrap is a function of
`view`, and a layer whose content does not depend on the camera may legitimately leave `view` out
of its deps, so caching the wrapped group would serve a stale transform the moment the camera
moved.

One semantic conflict git merged silently and the typechecker caught: the caching arc widened
`Stroke.width` to `number | { px: number }`, and the stroked-text tier predicate written against
the old type stopped compiling.

## What is not obvious from the diff

**`buildAffordanceAt` needed no change.** It reads the view through a `getView()` thunk already, so
per-view retargeting is one construction per view. The spec's Arc 2 listed it; there was nothing
to do.

## Traps

**Never `git stash` in this worktree.** The stack is shared across worktrees and concurrent
sessions; an agent used it during an earlier arc and swallowed another agent's uncommitted work.
Same for `git reset --hard`, `git checkout -- .`, `git clean`. If you run parallel agents, give them
disjoint files *and* forbid these commands explicitly — naming the files is not enough.

**Every changeset is `patch`.** Never write a `bump-approved` marker without an explicit OK.

**Verify a capability claim by reading the module, not by grepping two files.** Both the layer
caching spec and this one asserted renderer gaps that did not exist — four false claims between
them, each found by reading a file's silence as absence. Two of this spec's were retracted this
session after reading `draw.ts`: `pushClip`/`popClip` already flush the solid batch, and N views in
one command tree are already one `render()`.

**Tests:** `npx vitest run --project=kit` for core, `npm test` for all. No `test` script in the
`core` workspace. Typecheck is `npx tsc --noEmit` from the root; there is no
`packages/core/tsconfig.lib.json`.
