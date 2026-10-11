# A layout drop as a move behavior

**Status: unbuilt.** The phase split this follows has landed: `actions/move/` holds a readonly
`MoveSession` (`session.ts`), a per-move `MoveFrame` (`frame.ts`), and an ordered chain of commit
paths that return ops (`commit/`). Nothing below is built. Written 2026-10-11 for whoever
implements it; delete this file when the second step here merges.

It says what the behavior contract lacks for a layout drop to be a `MoveBehavior`, and how the
layout pass and reparent-on-drop leave `actions/move/` once it has it.

## Why

Move has two extension mechanisms: the `behaviors` pipeline (`MoveBehavior`, in
`interactions/gestures/types.ts`) and a hardwired `layout` dep with its own preview, commit, and
glide code. `snapToContainer` is a behavior; a layout drop, which does the same job, is not. The
end state is one mechanism: `moveAction` captures the drag, translates the selection, and runs the
pipeline, and a layout drop and reparent-on-drop are behaviors move builds from its deps.

## Step 1: three additions to the behavior contract

Each closes a gap that stops a layout drop being a behavior.

| Gap | Addition |
|---|---|
| A behavior claims the whole commit or none. Layout release and reparent write ops for some ids and need move's translate for the rest. | A move behavior's `onEnd` receives `MoveEnd extends BehaviorEnd` with `translateOps(ids): Op[]`, backed by `translateOps` in `move/translate.ts`. `ActionBehavior` takes the end type as a fourth parameter defaulting to `BehaviorEnd`. |
| Nothing runs after the commit lands, and a glide has to settle onto the pose the document now holds. | `ActionBehavior.onSettled?(ctx, committed)`: called once per gesture after the ops apply and the preview overrides drop, on commit, abort, and cancel alike. |
| A behavior can only preview dragged ids, and cannot mark one opaque. | `BehaviorResult.poses` is honored for any id, and `BehaviorResult.opaque?: Iterable<string>` feeds `previewOpaqueIds`. |

`snapToContainer` then calls `end.translateOps` for the ids it has no slot for, in place of the
transform it writes by hand from `ctx.origin` (`move/behaviors/snapToContainer.ts`, in `onEnd`).
That hand-written op uses the captured pose as `from`; `translateOps` says a derived node needs
the authored pose. Unconfirmed: write a test that drops a derived node through `snapToContainer`
and undoes it. If it passes before the change, there was no bug and the test is deleted.

## Step 2: layout drop and reparent-on-drop become behaviors

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
  `dispatcher/move.integration.test.tsx` passes unchanged at the end of each step, run with
  `npx vitest run --project=core <path>`.
- Each step 1 addition gets a test written first and seen to fail.
- Layout reflow and glide are visual. After step 2, drag a tile between two layout containers in
  `apps/site/demos/LayoutDemo.tsx` in a browser, with and without a reflow transition, and
  screenshot it.
- A full suite on the fleet (`onto test`) after each step merges.
