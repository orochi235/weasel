# weasel canvas-kit

Generic 2D scene-graph canvas library. Published as `@weasel-js/core`.

## Todo list

Active todos live in `docs/TODO.md`. Consult it when planning new work or picking up a task.

## Package manager

npm is canonical: `package-lock.json` is the committed lockfile and `workspaces` lives in `package.json`. `pnpm install` is fine locally for speed (`.npmrc` has `link-workspace-packages=true` so it resolves the `*` workspace deps), but **never commit `pnpm-lock.yaml`** — it's gitignored on purpose. Don't introduce `pnpm-workspace.yaml`, `preinstall` hooks blocking npm, or `workspace:*` deps without an explicit decision to migrate.

## Reference implementations

When building new tools, read these first:

- **`packages/core/src/tools/builtin/hand/useHandTool.ts`** — simplest possible tool structure: scratch, drag channel, view mutation via `ctx.setView`. No ops, no adapter. Start here.
- **`packages/core/src/tools/builtin/rect/useRectTool.ts`** — canonical pattern for tools that create scene objects. A tool is a *declarative shell*: it declares `bindings` (`{ kind: 'drag' } → actionId: 'insert'`) and nothing else. The dispatcher owns the gesture, `insertAction` owns the live preview and the commit, and the `insert` dep mints the node. Consumers wanting a custom node factory override the dep (`useDepSource('insert', …)` or `<SceneCanvas insertNodeFactories>`), **not** the tool.
- **`packages/core/src/tools/builtin/polygon/usePolygonTool.tsx`** — the same, plus the two things a tool with its own state needs: thunked binding params (so mid-gesture changes reach both the preview and the commit) and `ToolDef.actions` for actions the tool owns. Declare those on the def; a tool hook must not call `useAction` itself, because it may run above the `<ActionsProvider>` and the registration will silently no-op.

Do **not** write a tool that runs its own gesture (`useDragRect`) and commits with `ctx.applyBatch([createInsertOp(...)])`. That was the previous guidance here, and the code it pointed at had been dead for some time — see the 2026-07-27 layer-audit handoff.

## Demo conventions

Demos under `apps/site/demos/` are **terse and single-purpose** — each one exists to show a specific kit feature in the smallest plausible form. If a demo accumulates code that isn't directly pertinent to the feature it's demonstrating (custom hit-testers when defaults exist, hand-rolled adapter wiring, per-consumer index inversions), treat that as a signal that the kit's defaults / helpers should absorb the boilerplate. Being able to trim a demo or a simple consumer use-case is a legitimate driver for kit changes — there's limited value in showing consumers how to reimplement parts of the kit they could just find in source.

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
