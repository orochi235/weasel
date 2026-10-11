# Decomposing the move action

**Status: unbuilt.** Nothing here has landed. Written 2026-10-11 for whoever implements it; delete
this file when the third step merges.

It says how `packages/core/src/interactions/actions/defaults/move.ts` (1,426 lines) comes apart,
in three steps that each merge on their own, and what rule the rest of the codebase takes from it.

## What is wrong

| Finding | Where in `move.ts` |
|---|---|
| `MoveScratch` is one mutable bag of 28 fields, and every helper takes it whole | 642–719 |
| `moveAction` is 567 lines; `start()` is 528 of them; the `commitMove` closure inside is 252 | 860–1426 |
| `runLayoutPass` is 241 lines and writes its results into scratch (`previews`, `reflowTargets`, `dropCenter`, `layoutPass`) instead of returning them | 101–341 |
| `commitMove` is five commit paths inlined as early returns: behaviors, layout drop, layout release and exit, reparent-on-drop, plain translate | 1036–1287 |
| Reparent-on-drop writes straight to the scene; the other four return ops | 1259–1271 |
| `rebaseOpToLocal` and `rebaseReleased` are one function with a different target parent | 1082, 1151 |
| "The world pose this id was dragged to" is written out four times | 131–135, 795–805, 1189–1196, 1215–1219 |
| `scenePoseAdapter(scene)` is rebuilt at every use and is not about move | 538 |

Move also has two extension mechanisms: the `behaviors` pipeline (`MoveBehavior`, in
`interactions/gestures/types.ts`) and a hardwired `layout` dep with its own preview, commit, and
glide code. `snapToContainer` is a behavior; a layout drop, which does the same job, is not.

## Where it ends up

`moveAction` captures the drag, translates the selection, and runs the behavior pipeline. A layout
drop and reparent-on-drop are behaviors move builds from its deps. Everything lives in
`actions/move/`, which already holds the action's options and gesture adapter; `defaults/move.ts`
is gone.

## The rule

**A helper takes what it reads and returns what it produces. No module takes another's scratch
whole.** State is split by when it changes:

| State | Changes | Holds |
|---|---|---|
| `MoveSession` (readonly) | never after press | ids, cascade ids, start poses, carried ids, frames, plane refs, mid-glide offsets, descriptors, pose composition, scene, deps |
| `MoveFrame` | replaced each `onMove` | delta, previews, last pointer |
| a behavior's own state | as it likes | in `ctx.scratch`, under its own key |

## Step 1: split by phase

Behavior-preserving, apart from the reparent change below.

```
actions/move/
  action.ts          descriptor; start/onMove/onEnd wiring only
  session.ts         beginMove(ctx, opts) → MoveSession
  delta.ts           planeDelta, localDelta, draggedWorldPose
  frame.ts           (session, pointer, behaviors) → MoveFrame
  translate.ts       translateOps(session, ids, delta) → Op[]   (today's translateCommitOps)
  layout/dropPass.ts (session, frame) → LayoutPass | null, with the reflow previews returned
  layout/container.ts  the candidate walk and the innermost/topmost pick, shared with exits
  layout/exits.ts    resolveLayoutExits
  layout/glide.ts    hold-on-grab, releasedPoses, landReleased
  commit/index.ts    the ordered chain
  commit/layoutDrop.ts, layoutRelease.ts, reparent.ts
  commit/rebase.ts   the one op rebaser
```

- Each commit path is `(session, frame, end) => Op[] | null | undefined`, first answer wins: the
  contract `reduceBehaviorEnd` already gives a behavior's `onEnd`.
- `scenePoseAdapter` moves to `features/groups/` beside `composePose`, which defines `PoseAdapter`.
- **Reparent-on-drop returns ops** (`createReparentOp` with `toIndex`, `createSetLayerOp`,
  `createTransformOp`) and commits through `commitGestureOps` like the rest, so it reaches a
  consumer's `applyOps` and history. A container refusing the arrival (`SceneArrivalRefused`) must
  still land nothing; write that test first and watch it fail against the ops path before fixing.
- `move.*.test.ts` move from `defaults/` into `actions/move/` with their imports updated and no
  other edits. Every importer of `defaults/move` is repointed (`git grep "defaults/move'"`), and
  `defaults/index.ts` re-exports from the new home.
- No file over 250 lines, no function over 80.

## Step 2: three additions to the behavior contract

Each closes a gap that stops a layout drop being a behavior.

| Gap | Addition |
|---|---|
| A behavior claims the whole commit or none. Layout release and reparent write ops for some ids and need move's translate for the rest. | A move behavior's `onEnd` receives `MoveEnd extends BehaviorEnd` with `translateOps(ids): Op[]`. `ActionBehavior` takes the end type as a fourth parameter defaulting to `BehaviorEnd`. |
| Nothing runs after the commit lands, and a glide has to settle onto the pose the document now holds. | `ActionBehavior.onSettled?(ctx, committed)`: called once per gesture after the ops apply and the preview overrides drop, on commit, abort, and cancel alike. |
| A behavior can only preview dragged ids, and cannot mark one opaque. | `BehaviorResult.poses` is honored for any id, and `BehaviorResult.opaque?: Iterable<string>` feeds `previewOpaqueIds`. |

`snapToContainer` then calls `end.translateOps` for the ids it has no slot for, in place of the
transform it writes by hand from `ctx.origin` (`snapToContainer.ts:118`). That hand-written op uses
the captured pose as `from`; `translateCommitOps` says a derived node needs the authored pose.
Unconfirmed: write a test that drops a derived node through `snapToContainer` and undoes it. If it
passes before the change, there was no bug and the test is deleted.

## Step 3: layout drop and reparent-on-drop become behaviors

- `move/behaviors/layoutDrop.ts` and `move/behaviors/reparentOnDrop.ts`, built on the `layout/`
  and `commit/` modules from step 1.
- `beginMove` builds them from `ctx.deps.layout` and `ctx.deps.nodeAtPoint` and appends them after
  the binding's own behaviors, layout first. That keeps today's order: binding behaviors, layout,
  reparent, translate.
- `action.ts` loses the layout pass, the commit chain, and the glide bookkeeping. `MoveFrame` loses
  `layoutPass` and `dropCenter`, which become `layoutDrop`'s own state.
- `commit/` is deleted; its paths are the behaviors' `onEnd`.
- The `layout` and `reparentOnDrop` surfaces a consumer sees do not change.

## Keeping it this way

- **`npm run check:size`**, in the style of `check:frame-loops`: fails on a shipped source file
  over 400 lines or a function over 120, measured with the TypeScript parser. Its allowlist records
  each file already over at its size today (57 files are over 400 lines), and an entry fails when
  the file grows past it or shrinks below it without the entry being lowered. Added to CI with the
  other checks. Lands with step 1.
- **`CLAUDE.md`** gets the rule above, under a "Module shape" heading. Lands with step 1.
- `resize.ts` (698) and `rotate.ts` (353) have the same skeleton — a scratch interface and a
  `commitX` closure inside `start()` — and take the same split. Tracked in `docs/TODO.md`.

## Not in this work

`GestureContext` carries no pose composition and no per-layer plane map, so a behavior a consumer
writes cannot do the frame math `layoutDrop` does; move's own behaviors close over the session
instead. Tracked in `docs/TODO.md`.

## Testing

- The existing `move.*.test.ts`, `geometryContract.test.ts`, and
  `dispatcher/move.integration.test.tsx` pass unchanged at the end of every step, run with
  `npx vitest run --project=core <path>`.
- Each step 2 addition gets a test written first and seen to fail.
- Layout reflow and glide are visual. After step 3, drag a tile between two layout containers in
  `apps/site/demos/LayoutDemo.tsx` in a browser, with and without a reflow transition, and screenshot it.
- A full suite on the fleet (`onto test`) after each step merges.
