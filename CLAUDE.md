# weasel canvas-kit

Generic 2D scene-graph canvas library. Published as `@orochi235/weasel`.

## Reference implementations

When building new tools, read these first:

- **`src/tools/builtin/useHandTool.ts`** — simplest possible tool structure: scratch, drag channel, view mutation via `ctx.setView`. No ops, no adapter. Start here.
- **`src/tools/builtin/useRectTool.ts`** — canonical pattern for tools that create scene objects: drag gesture via `useDragRect`, undoable commit via `ctx.applyBatch([createInsertOp(...)])`. The `create` factory lives on the tool, not on the adapter.

## Key concepts

- **Tools** handle gestures. They read `ToolCtx` (world coords, modifiers, selection, view) and either mutate the viewport (`ctx.setView`) or write to the scene (`ctx.applyBatch` + ops).
- **Ops** are the scene-mutation primitive (`createInsertOp`, `createDeleteOp`, `createSetPoseOp`, etc.). Always prefer ops over direct adapter calls so changes are undoable.
- **`adapter: unknown`** in `ToolCtx` is intentionally opaque. Cast only when necessary; prefer ops.
- **`useDragRect`** is a spatial input primitive (user draws a rectangle). It is not an insert mechanism — tools decide what to do with the bounds.
- **Scene vs adapter**: `Scene<TData, TLayer, TPose>` is the kit-owned tree. `adapter` is the low-level contract tools use for mutation. `SceneCanvas` synthesizes an adapter from the scene so you rarely touch the adapter directly.
