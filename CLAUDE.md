# weasel canvas-kit

Generic 2D scene-graph canvas library. Published as `@weasel-js/core`.

## Scope: weasel is an engine

weasel is not a utility library, and it is not a depository for features
surgically cut out of an app and cloned in. It is an engine. Features get added
because the engine should have them.

**Do not gate a feature on finding a consumer for it.** "Who is the second
consumer?", "wait until a real app asks", "this doesn't earn a package yet",
"defer until a concrete use case appears" — none of these are arguments here,
and none of them should appear in a spec, a TODO entry, or a recommendation.
Consumer pressure is not the input. Mike decides when a feature goes in.

Nor is release overhead an argument: version churn, package count, bump
blast radius, and maintenance surface are not reasons to scope something down.
weasel has no SLAs.

What *is* fair to argue: that a design is wrong, that a foundation is missing
underneath it, that two things should be one thing, or that the work is bigger
than it looks and should be split into arcs. Argue the engineering, never the
demand.

When a feature does go in, design it as engine surface — general and composable
on its own terms — not as the minimum some demo happened to need.

## Todo list

Active todos live in `docs/TODO.md`. Consult it when planning new work or picking up a task.

## Releases: always write `patch`

**Every changeset you write is `patch`.** Not `minor`, not `major` — regardless
of how significant the change is, whether it adds API, or what semver would
say. `minor` and `major` are Mike's calls, made explicitly, in the message
where he makes them.

All thirteen packages are in one changesets `fixed` group, so **one bump
anywhere moves every package**. weasel is 1.0.0 as of 2026-08-12 — reached by
accident, from two `major` changesets that sat in `.changeset/` for days until
an unrelated release consumed them.

`npm run check:bumps` enforces this and runs in CI, in the release workflow,
and in `prepublishOnly`. Overriding it requires a marker in the changeset body
naming the level it approves:

```
<!-- bump-approved: minor: <who> — <why> -->
<!-- bump-approved: major: <who> — <why> -->
```

The level is part of the marker on purpose: approving a `minor` must not
authorize a later edit to `major`.

**Writing that marker yourself defeats the entire mechanism.** Treat it like
`git push` — it needs Mike's explicit OK in the conversation, every time.

If a change is genuinely breaking or genuinely additive, say so in the
changeset *prose*. The words are what a reader acts on; the number can always
be raised deliberately later. Don't otherwise discuss the number.

## Package manager

npm is canonical: `package-lock.json` is the committed lockfile and `workspaces` lives in `package.json`. `pnpm install` is fine locally for speed (`.npmrc` has `link-workspace-packages=true` so it resolves the `*` workspace deps), but **never commit `pnpm-lock.yaml`** — it's gitignored on purpose. Don't introduce `pnpm-workspace.yaml`, `preinstall` hooks blocking npm, or `workspace:*` deps without an explicit decision to migrate.

## Reference implementations

When building new tools, read these first:

- **`packages/core/src/tools/builtin/hand/useHandTool.ts`** — simplest possible tool structure: scratch, drag channel, view mutation via `ctx.setView`. No ops, no adapter. Start here.
- **`packages/core/src/tools/builtin/rect/useRectTool.ts`** — canonical pattern for tools that create scene objects. A tool is a *declarative shell*: it declares `bindings` (`{ kind: 'drag' } → actionId: 'insert'`) and nothing else. The dispatcher owns the gesture, `insertAction` owns the live preview and the commit, and the `insert` dep mints the node. Consumers wanting a custom node factory override the dep (`useDepSource('insert', …)` or `<SceneCanvas insertNodeFactories>`), **not** the tool.
- **`packages/core/src/tools/builtin/polygon/usePolygonTool.tsx`** — the same, plus the two things a tool with its own state needs: thunked binding params (so mid-gesture changes reach both the preview and the commit) and `ToolDef.actions` for actions the tool owns. Declare those on the def; a tool hook must not call `useAction` itself, because it may run above the `<ActionsProvider>` and the registration will silently no-op.

Do **not** write a tool that runs its own gesture (`useDragRect`) and commits with `ctx.applyBatch([createInsertOp(...)])`. That was the previous guidance here, and the code it pointed at had been dead for some time — see the 2026-07-27 layer-audit handoff.

## Drawing icons

**Proof SVG icons at 10–15× their display size.** A glyph authored on a 20×20
viewBox gets inspected at ~240–320px before anyone looks at it small. At
chrome size a misplaced arrowhead or a join that doesn't meet is two blurry
pixels and reads as fine; blown up it is obviously broken. Render small only
afterward, as a legibility check — never as the design surface.

Compute terminus geometry, don't eyeball it. `M x y A rx ry rot laf sf dx dy`
ends at `(x+dx, y+dy)` — an arrowhead capping that arc puts its vertex
*there*. Same for a handle meeting a circle's rim: solve for the point on the
circle rather than guessing a coordinate that looks close.

**The small check is a separate check, and it is the pixel grid.** Proofing
large tells you nothing about chrome size. Rasterise at the size the chrome
actually renders — `DefaultToolbar` uses `size={16}` — magnify with
nearest-neighbour, and look at the pixels the renderer produced. A 16px glyph
inside a screenshot of a proof page has been resampled twice before you see it.

**Check 1× and 2× separately; they disagree.** At 1× a 16px icon gets 16 device
pixels and fine detail collapses; at 2× it gets 32 and the same drawing
resolves. Neither grid is the answer on its own, and a conclusion drawn from one
does not transfer.

**Path order is z-order.** `gen:icons` emits paths in source order, so the
sequence in `packages/ui/scripts/icons/` is load-bearing wherever a glyph gets
depth from overlap. Reordering paths for tidiness breaks it silently.

Fuller notes from the session that produced these — what stroke weight can and
cannot fix, why rounded corners move numeric constraints, how `currentColor`
behaves across inline / `<img>` / `mask-image`, and the size cost of sampled
curves — are in `clone-icons/STYLE-LESSONS.md` in Mike's iCloud Drive.

## Demo conventions

**A demo is a reference implementation.** Its job is to show the proper way to
build something against this API, so it uses the platform's fundamental pieces —
the scene graph, the gesture system, tools/actions, layers — **wherever they
apply**. A demo that hand-rolls around a kit system is teaching consumers to
hand-roll it too, and that is a defect regardless of how well the demo runs.

Bypassing a system is acceptable in exactly two cases: the example is trivial
enough that the system is genuinely out of scope, or the bypass *is* the point
and the demo's own blurb says so (the side-scroller load test does). Anything
else gets rebuilt on the system.

Demos under `apps/site/demos/` are **terse and single-purpose** — each one exists to show a specific kit feature in the smallest plausible form. If a demo accumulates code that isn't directly pertinent to the feature it's demonstrating (custom hit-testers when defaults exist, hand-rolled adapter wiring, per-consumer index inversions), treat that as a signal that the kit's defaults / helpers should absorb the boilerplate. Being able to trim a demo or a simple consumer use-case is a legitimate driver for kit changes — there's limited value in showing consumers how to reimplement parts of the kit they could just find in source.

## Traps

Things that pass every test and are still wrong.

**jsdom cannot catch a layout collapse.** Arc 3 of the labkit pass wrapped the workspace in a
row whose `flex: 1` resolved to nothing inside a block container, so the lab rendered as an empty
page — with all 7903 tests green. Screenshot anything that changes a container's box.

**Storybook's theme global does not switch weasel's theme.** `tokens.css` keys its mode blocks
off `[data-wzl-mode]`, which `applyTheme` writes. `&globals=theme:dark` sets `data-theme`, which
nothing reads, so a "both themes" check driven from the URL verifies one theme twice — whichever
`prefers-color-scheme` reports. labkit stories switch via the lab header's Auto/Light/Dark
buttons; bare `@weasel-js/ui` stories need `data-wzl-mode` set by hand, and otherwise render on
the `:root` dark default in both modes.

**A `var()` inside a custom property is substituted where that property is declared.** So
`--wzl-x: 0 1px 3px var(--wzl-shadow)` in `:root` bakes in the default mode's shadow and
inherits that frozen value into every other mode's block. In a real property it resolves per
element and is fine. Several theme tokens still have this defect — see `docs/TODO.md`.

**`theme/base.less` element defaults live in `:where()` on purpose.** Bare `button` nested under
`.lk-root` is specificity (0,1,1) and outranks every component class. Don't unwrap them. The flip
side bites too: because `:where()` carries no specificity, its `height: var(--wzl-control-h)`
still beats any `@weasel-js/ui` component that sizes its own buttons from padding — it has
crushed a 16px glyph to 2px and forced 28px ToggleBar segments into a 17px track.

**The git stash stack is shared by every worktree of this repo.** A `stash`/`pop` pair run in one
worktree can pop another session's work into it. Use a throwaway worktree for a baseline instead;
if you must stash, `push -u -m <tag>`, `apply` by SHA, and drop your own entry by tag.

**The consumer smoke test cannot catch an undeclared dependency.** It packs every `@weasel-js`
package into the tree, so a bare specifier resolves whether or not the importer declared it.
`npm run check:manifests` is the check that works.

## Terminology

UI words have specific referents — don't conflate them:

- **workspace** — the striped/gray area surrounding the rendered page. In WeaselDraw this is `.wd-canvas-host`; in ToolkitBuilder there's no separate host so the `<canvas>` element itself plays this role.
- **canvas** — the HTML `<canvas>` element. In WeaselDraw this is sized to the document page (`paper.width × paper.height`) and sits inside the workspace; in ToolkitBuilder the canvas spans the visible area.
- **document** / **page** — the white paper drawn on the canvas (or, in WeaselDraw, the canvas itself since it IS sized to the paper). When the user says "document" they mean the page, not the canvas element.
- **scene** — the kit-owned tree (`Scene<TData, TLayer, TPose>`). Logical, not visual. Don't say "scene" when you mean "document" or "canvas".
- **group** — a structural `ContainerNode` (`kind: 'container'`). The real Cmd+G group; `group`/`ungroup` create/dissolve a container and reparent the selection under it; round-trips to SVG `<g>`. Persistent and id-bearing. **Not** a membership list — there is no membership "group" type (the old `Group`/`GroupAdapter` was removed in 2026-06).
- **selection** — the transient, immutable set of active ids (`SelectionApi.get()`/`set()`). "Operate on these N as a unit" with no persistence and no id; not a scene entity. Don't reintroduce a persistent membership-list "group" — a saved selection is just a consumer-held `string[]` passed to `selection.set`. See `docs/taxonomy.md` ("Group vs Selection — not the same axis").

When positioning HUDs / overlays, pick the right anchor: "inside the workspace" means `.wd-canvas-host`'s rect, not the canvas's.

## Gesture / action / interaction taxonomy

Before making API changes (renames, new fields, new exports) touching anything named `gesture`, `action`, `interaction`, `binding`, or the dispatcher/routing layer, **read `docs/taxonomy.md` first**. The terms have specific referents that are easy to conflate:

- **Gesture** = form of input (click, drag, wheel, keystroke, drag-rect, drag-radial) — *how* input arrives.
- **Action** = user-intent operation (move, marquee, lasso, resize, rotate, insert, delete) — *what to do*.
- **Interaction** = a gesture composed with an action (the binding).

Don't name a field `gesture` if its values are action-shaped (`'move'`/`'marquee'`/etc.), or vice versa.

## Key concepts

- **Tools** handle gestures. They read `ToolCtx` (world coords, modifiers, selection, view) and either mutate the viewport (`ctx.setView`) or write to the scene (`ctx.applyBatch` + ops).
- **Ops** are the scene-mutation primitive (`createInsertOp`, `createDeleteOp`, `createSetPoseOp`, etc.). Always prefer ops over direct adapter calls so changes are undoable.
- **`adapter: unknown`** in `ToolCtx` is intentionally opaque. Cast only when necessary; prefer ops.
- **`useDragRect`** is a spatial input primitive (user draws a rectangle). It is not an insert mechanism — tools decide what to do with the bounds.
- **Scene vs adapter**: `Scene<TData, TLayer, TPose>` is the kit-owned tree. `adapter` is the low-level contract tools use for mutation. `SceneCanvas` synthesizes an adapter from the scene so you rarely touch the adapter directly.
