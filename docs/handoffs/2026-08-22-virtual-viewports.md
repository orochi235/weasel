# Virtual viewports — handoff

**For:** the next session picking this up. **Answers:** where the work stands, and what the design
spec does not carry.

The design is `docs/superpowers/specs/2026-08-22-virtual-viewports-design.md` — read it first. It is
current: Arc 1 and Arc 2 are marked done there, with the reasons.

## State

Worktree `.claude/worktrees/virtual-viewports`, branch `worktree-virtual-viewports`, off local
`main` at `e6c7ebc2`. Not pushed, no PR. Suite green: 677 files, 7095 passing. Arcs 1 and 2 are
done, plus steps 1-4 of Arc 3. Each code commit carries a `patch` changeset:

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

**Arc 3, where to pick up.** The spec's Arc 3 section carries a numbered list of the remaining
steps, in order, with the reason each one precedes the next. Steps 1 through 4 are done; start at
step 5.

Two views now really exist: `<SceneCanvas views={[{ id, bounds }]}>` paints a second camera and
routes wheel and drag inside its rect to it. What a view cannot yet do is select, resize or edit
anything — it registers no `affordanceAt` or `classifyTarget`, and its selection and chrome are
still the surface's. That is steps 5 and 7.

**The decision behind the shape.** A view is declared as a prop *and* mountable as a child, at
Mike's call. They are one implementation: the prop is a `.map` rendering the component, so there is
one registration path, not two surfaces. Prop entries take their array index as `order` and children
take `Infinity`, so paint order never depends on React's mount ordering.

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

**The resolver is deliberately unwired.** With one dispatcher and one tool registry, every point
resolves to the root view, so routing it through would be dead code that still has to be kept
correct. It is built, tested and exported so Arc 3 can wire it the day there is a second view to
route to.

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
