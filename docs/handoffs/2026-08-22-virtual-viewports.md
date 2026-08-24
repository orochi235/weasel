# Virtual viewports — handoff

**For:** the next session picking this up. **Answers:** where the work stands, and what the design
spec does not carry.

The design is `docs/superpowers/specs/2026-08-22-virtual-viewports-design.md` — read it first. It is
current: Arcs 1, 2 and 3 are marked done there, with the reasons.

## State

Worktree `.claude/worktrees/virtual-viewports`, branch `worktree-virtual-viewports`, off local
`main` at `e6c7ebc2`. Not pushed, no PR. Suite green: 677 files, 7103 passing.
Arcs 1, 2 and 3 are done, over the 33 commits `git log main..HEAD` lists; each code commit
carries a `patch` changeset.

**Where to pick up.** Arc 3 is finished; what is left of the design is Arc 1's per-view layer
command cache, which is blocked below. `<SceneCanvas views={[{ id, bounds }]}>` — or a
`<CanvasView>` child — is now a panel that pans, zooms, draws the surface's layers through its own
camera, and selects, resizes and rotates against its own selection without touching the canvas's.

**The trap, which is the whole lesson of the arc.** Handing a view its own state does nothing for a
lookup that closed over the surface's at construction. Three did. Each collapse is described in the
spec, and `docs/TODO.md` carries a P1 to sweep the engine for the rest of the pattern — the pinch
path is a named suspect, since two independent implementations of it are live behind two different
`viewport` flags.

## Blocked

**The per-view layer command cache waits on the layer caching arc.** `LayerCommandCache` does not
exist on `main`; it lives on branch `worktree-renderer-layer-caching` (worktree
`.claude/worktrees/renderer-layer-caching`), finished and unpushed. That arc is independently
mergeable and should land first.

**It will conflict here, in one spot.** That branch has a private `drawOneLayer(layer, data, view,
dims, cache)` in `core/layers/render.ts` that resolves a layer's commands from cache; this branch
has an exported `drawOneLayer(layer, data, view, dims)` that puts them in the space the layer
declares. Same name, same file, different jobs. The merge is one function doing both — cache lookup
around the `layer.draw` call, space wrap around the result — not a rename.

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
