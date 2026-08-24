# Virtual viewports — handoff

**For:** the next session picking this up. **Answers:** where the work stands, and what the design
spec does not carry.

The design is `docs/superpowers/specs/2026-08-22-virtual-viewports-design.md` — read it first. It is
current: Arcs 1 and 2 and Arc 3 through step 5 are marked done there, with the reasons.

## State

Worktree `.claude/worktrees/virtual-viewports`, branch `worktree-virtual-viewports`, off local
`main` at `e6c7ebc2`. Not pushed, no PR. Suite green: 677 files, 7099 passing.
Arcs 1 and 2 are done, and Arc 3 through step 5. Each code commit carries a `patch` changeset:

- the viewport inner-view transform fix
- the spec retractions
- the `clientToWorld` collapse
- `createViewResolver`
- the `hitTestExtras` frame argument
- the `CanvasHelpers` type split
- one shared bounds cascade for chrome and helpers
- `layerVisibility` / `layerOrder` props
- a thunked viewport camera and per-viewport `data`
- the `useViewHelpers` extraction
- the per-view dispatch record, then per-event view routing, then the per-view camera
- `<CanvasView>` and the view registry
- the per-view dep overlay
- a view's own selection, its own helpers, and chrome drawn from the draw envelope

**Arc 3, where to pick up.** The spec's Arc 3 section carries a numbered list of the remaining
steps, in order, with the reason each one precedes the next. Steps 6 and 7 are what is left:
per-view pinch and hover, then per-view affordances and hit-testing. Step 7 is the one that makes
a view feel like a canvas — until it lands, a gesture inside a panel reaches only the ambient
viewport actions, because a view registers no `affordanceAt` or `classifyTarget`.

**What a view has now.** Its own camera, dispatcher, selection and chrome. `<SceneCanvas views>`
or a `<CanvasView>` child gets a panel that pans, that draws the surface's layers through its own
camera, and that outlines its own selection rather than the canvas's.

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

**A layer given per-view `data` may still be closed over the surface's.** Step 5 hit this in
`createSelectionOverlayLayer`; step 7's hit-testers are the next candidates. Check where a layer
reads from before assuming the envelope reaches it.

**Verify a capability claim by reading the module, not by grepping two files.** Both the layer
caching spec and this one asserted renderer gaps that did not exist — four false claims between
them, each found by reading a file's silence as absence. Two of this spec's were retracted this
session after reading `draw.ts`: `pushClip`/`popClip` already flush the solid batch, and N views in
one command tree are already one `render()`.

**Tests:** `npx vitest run --project=kit` for core, `npm test` for all. No `test` script in the
`core` workspace. Typecheck is `npx tsc --noEmit` from the root; there is no
`packages/core/tsconfig.lib.json`.
