# A layout drop as a move behavior

**Status: unbuilt.** The phase split this follows has landed: `actions/move/` holds a readonly
`MoveSession` (`session.ts`), a per-move `MoveFrame` (`frame.ts`), and an ordered chain of commit
paths that return ops (`commit/`). So has the first step, the behavior contract's three
additions. The step below is not built. Written 2026-10-11 for whoever implements it; delete this
file when it merges.

It says how the layout pass and reparent-on-drop leave `actions/move/` as `MoveBehavior`s.

## Why

Move has two extension mechanisms: the `behaviors` pipeline (`MoveBehavior`, in
`interactions/gestures/types.ts`) and a hardwired `layout` dep with its own preview, commit, and
glide code. `snapToContainer` is a behavior; a layout drop, which does the same job, is not. The
end state is one mechanism: `moveAction` captures the drag, translates the selection, and runs the
pipeline, and a layout drop and reparent-on-drop are behaviors move builds from its deps.

## What the contract gives a layout drop

| A layout drop needs to | It uses |
|---|---|
| Write ops for some ids and take move's translate for the rest. | `MoveEnd.translateOps(ids)`, handed to a move behavior's `onEnd`. |
| Settle a glide onto the pose the document holds after the commit. | `onSettled(ctx, committed)`. |
| Preview the siblings it reflows, painted settled. | `BehaviorResult.poses` for ids that are not dragged, and `BehaviorResult.opaque`. |

## Layout drop and reparent-on-drop become behaviors

- `move/behaviors/layoutDrop.ts` and `move/behaviors/reparentOnDrop.ts`, built on the `layout/`
  and `commit/` modules.
- `beginMove` builds them from `ctx.deps.layout` and `ctx.deps.nodeAtPoint` and appends them after
  the binding's own behaviors, layout first. That keeps today's order: binding behaviors, layout,
  reparent, translate.
- `action.ts` loses the layout pass and the glide bookkeeping (`drop`, `gliding`), which become
  `layoutDrop`'s own state in `ctx.scratch`.
- `commit/index.ts` shrinks to the behavior reducer and the default translate; the other paths are
  the behaviors' `onEnd`.
- The `layout` and `reparentOnDrop` surfaces a consumer sees do not change.

## Not in this work

`GestureContext` carries no pose composition and no per-layer plane map, so a behavior a consumer
writes cannot do the frame math `layoutDrop` does; move's own behaviors close over the session
instead. Tracked in `docs/TODO.md`.

## Testing

- Every test under `actions/move/`, `actions/__tests__/geometryContract.test.ts`, and
  `dispatcher/move.integration.test.tsx` passes unchanged at the end, run with
  `npx vitest run --project=core <path>`.
- Layout reflow and glide are visual. Afterward, drag a tile between two layout containers in
  `apps/site/demos/LayoutDemo.tsx` in a browser, with and without a reflow transition, and
  screenshot it.
- A full suite on the fleet (`onto test`) after it merges.
