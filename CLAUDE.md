# weasel canvas-kit

Generic 2D scene-graph canvas library. Published as `@orochi235/weasel`.

## Todo list

Active todos live in `docs/TODO.md`. Consult it when planning new work or picking up a task.

## Package manager

npm is canonical: `package-lock.json` is the committed lockfile and `workspaces` lives in `package.json`. `pnpm install` is fine locally for speed (`.npmrc` has `link-workspace-packages=true` so it resolves the `*` workspace deps), but **never commit `pnpm-lock.yaml`** — it's gitignored on purpose. Don't introduce `pnpm-workspace.yaml`, `preinstall` hooks blocking npm, or `workspace:*` deps without an explicit decision to migrate.

## Reference implementations

When building new tools, read these first:

- **`src/tools/builtin/useHandTool.ts`** — simplest possible tool structure: scratch, drag channel, view mutation via `ctx.setView`. No ops, no adapter. Start here.
- **`src/tools/builtin/useRectTool.ts`** — canonical pattern for tools that create scene objects: drag gesture via `useDragRect`, undoable commit via `ctx.applyBatch([createInsertOp(...)])`. The `create` factory lives on the tool, not on the adapter.

## Demo conventions

Demos under `demo/demos/` are **terse and single-purpose** — each one exists to show a specific kit feature in the smallest plausible form. If a demo accumulates code that isn't directly pertinent to the feature it's demonstrating (custom hit-testers when defaults exist, hand-rolled adapter wiring, per-consumer index inversions), treat that as a signal that the kit's defaults / helpers should absorb the boilerplate. Being able to trim a demo or a simple consumer use-case is a legitimate driver for kit changes — there's limited value in showing consumers how to reimplement parts of the kit they could just find in source.

## Terminology

UI words have specific referents — don't conflate them:

- **workspace** — the striped/gray area surrounding the rendered page. In swillustrator this is `.swill-canvas-host`; in ToolkitBuilder there's no separate host so the `<canvas>` element itself plays this role.
- **canvas** — the HTML `<canvas>` element. In swillustrator this is sized to the document page (`paper.width × paper.height`) and sits inside the workspace; in ToolkitBuilder the canvas spans the visible area.
- **document** / **page** — the white paper drawn on the canvas (or, in swillustrator, the canvas itself since it IS sized to the paper). When the user says "document" they mean the page, not the canvas element.
- **scene** — the kit-owned tree (`Scene<TData, TLayer, TPose>`). Logical, not visual. Don't say "scene" when you mean "document" or "canvas".

When positioning HUDs / overlays, pick the right anchor: "inside the workspace" means `.swill-canvas-host`'s rect, not the canvas's.

## Key concepts

- **Tools** handle gestures. They read `ToolCtx` (world coords, modifiers, selection, view) and either mutate the viewport (`ctx.setView`) or write to the scene (`ctx.applyBatch` + ops).
- **Ops** are the scene-mutation primitive (`createInsertOp`, `createDeleteOp`, `createSetPoseOp`, etc.). Always prefer ops over direct adapter calls so changes are undoable.
- **`adapter: unknown`** in `ToolCtx` is intentionally opaque. Cast only when necessary; prefer ops.
- **`useDragRect`** is a spatial input primitive (user draws a rectangle). It is not an insert mechanism — tools decide what to do with the bounds.
- **Scene vs adapter**: `Scene<TData, TLayer, TPose>` is the kit-owned tree. `adapter` is the low-level contract tools use for mutation. `SceneCanvas` synthesizes an adapter from the scene so you rarely touch the adapter directly.
