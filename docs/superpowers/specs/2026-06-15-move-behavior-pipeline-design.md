# Move behavior pipeline — design

**Date:** 2026-06-15
**Status:** approved, pre-implementation
**Scope:** wire `opts.behaviors` into the default `moveAction` so the existing
move behaviors (`snapToContainer`, `snapBackOrDelete`, `snapToGrid`,
`snapToGuides`) run end-to-end through the kit move action.

## Problem

The kit select tool's drag is owned by the dispatcher's `moveAction`
(`src/interactions/actions/defaults/move.ts`). That action is translate-only:
it tracks a drag delta in scratch and commits it (optionally via the built-in
`reparentOnDrop` param) at `onEnd`. It **never consumes `opts.behaviors`** —
its own header lists "Behavior pipeline (snap-to-grid, snap-back-or-delete,
etc.) via `opts.behaviors`" as a standing Phase 7 TODO.

Everything else already exists:

- The behavior contracts — `MoveBehavior<TPose> = ActionBehavior<TPose,
  GroupTransform, BehaviorResult<TPose>>`, `GroupTransform`, `BehaviorResult`
  (`src/interactions/gestures/types.ts`).
- The four behaviors, each independently unit-tested
  (`src/interactions/actions/move/behaviors/`).
- The plumbing: `dispatcher.ts:798` already calls
  `action.invoker.start(invCtx, match.binding.opts)`, and `BindingOpts.behaviors`
  rides along. A binding `{ spec, opts: { behaviors: [...] } }` reaches
  `moveAction` today.
- A working template: `resize.ts` already runs the analogous loop
  (`resolveDeps → onStart → per-frame onMove shaping the proposed pose → onEnd
  collecting ops`).

The only missing link is `moveAction` reading and running the behaviors.
Adopting the kit select tool for move without this regresses any
container-snap / snap-back ("planting") drag model.

## Approach

**A — inline in `moveAction`, mirroring `resize.ts`.** Add the behavior loop
directly into `move.ts`'s `start`/`onMove`/`onEnd`. Self-contained, matches
the established resize pattern, reviewable diff. (Rejected B: a shared
runner helper across move+resize — the genuinely-shared core is thin because
resize works in bounds-space and move in group-transform-space, and it would
drag resize into scope as a refactor precondition.)

Concession: if the `onEnd` first-non-undefined-wins reducer and the legacy
`pose → transform` shim come out identical to resize's, lift just those two
into a tiny shared helper opportunistically — not as a gate, and without
refactoring resize.

## Design

### 1. Behavior source

```ts
const behaviors = (opts?.behaviors ?? []) as MoveBehavior<unknown>[];
```

Empty array (the default) preserves today's exact behavior with zero overhead —
full back-compat for every existing binding.

### 2. Scene-backed gesture adapter

Unlike resize (which sets `adapter: undefined` because its kit behaviors don't
touch it), the move behaviors *use* `ctx.adapter`:

- `snapToContainer.onEnd` reads `ctx.adapter.getParent(draggedId)`.
- `snapBackOrDelete.onStart` reads `ctx.adapter.getNodes()` / `getNode(id)`.

**Layering constraint:** `interactions/` must not import from `canvas/`
(verified: no such edge exists; `canvas → interactions` is the only direction).
So `canvas/sceneAdapter.ts#sceneToAdapter` is off-limits — importing it would
create a cycle. Hand-roll a minimal scene-backed adapter inside `interactions/`
(new file `src/interactions/actions/move/gestureAdapter.ts`). It needs exactly
the methods the behaviors call plus the methods the committed ops apply through:

| Method | Used by | Impl over `scene` |
|---|---|---|
| `getNode(id)` | snapBackOrDelete + delete-op snapshot | `scene.get(asNodeId(id))` |
| `getNodes()` | snapBackOrDelete.onStart | iterate `scene.renderOrder()` → `get` |
| `getPose(id)` | MoveAdapter contract | `scene.get(id)!.pose` |
| `getParent(id)` | snapToContainer.onEnd | `scene.get(id)?.parent ?? null` |
| `setPose(id, pose)` | `createTransformOp.apply` | `scene.setPose(asNodeId(id), pose)` |
| `setParent(id, p)` | `createReparentOp.apply` | `scene.move(asNodeId(id), p ?? null)` |
| `removeNode(id)` | `createDeleteOp.apply` | `scene.remove(asNodeId(id))` |
| `insertNode(node)` | delete-op invert (undo) | `scene.add({ kind, layer, pose, data, id, parent? })` |

### 3. Gesture context lifecycle

One `GestureContext<unknown>` is built in `start` and reused across the gesture
(mirrors resize's `gestureCtx`), stored on `MoveScratch`:

- `draggedIds`: selected roots as strings (not the cascaded descendant set —
  matches the legacy hook).
- `origin` / `current`: `Map<id, pose>` of start poses; `current` refreshed
  each `onMove`.
- `snap`: `null` initially; set from behavior `onMove` results.
- `modifiers` / `pointer`: refreshed each `onMove` from the invocation ctx.
- `adapter`: the scene-backed adapter from §2.
- `scratch`: `{}` (behaviors keep their own keyed state here).

### 4. `start`

After capturing `startPoses` / `cascadeIds` (unchanged), build the gesture ctx
and fire `behaviors.forEach(b => b.onStart?.(ctx))`.

### 5. `onMove`

1. Refresh ctx `modifiers` / `pointer` / `current`.
2. Build proposed `GroupTransform` `{ kind: 'translate', dx, dy }`.
3. Run each behavior's `onMove(ctx, proposed)` in order, folding results:
   - a returned `transform` replaces the working transform;
   - a legacy `pose` (e.g. `snapToContainer`'s slot pose) is run through a
     shim — derive a translate from `pose − origin[primary]` — and applied
     uniformly (matches the documented `BehaviorResult.pose` shim);
   - a returned `snap` is written to `ctx.snap` so `snapBackOrDelete.onEnd`
     sees it and defers.
4. Compute `previews` from the **shaped** transform (so snap-to-grid /
   container-slot positions show in the ghost *and* land in the committed
   delta). Store the shaped delta on scratch.

### 6. `onEnd` (commit)

Run the behaviors' `onEnd` in order; first non-undefined return wins (the
documented `ActionBehavior.onEnd` contract):

- `Op[]` → the behavior owns the commit. Apply them via
  `scene.applyBatch(ops, label, gestureAdapter)` — the kit's one-undo-entry
  commit path, applying each op against the §2 adapter (`transform`→`setPose`,
  `reparent`→`setParent`, `delete`→`removeNode`). **Skip** the default path
  *and* `reparentOnDrop`. (Note: this differs from `resize.ts`, which
  deliberately *ignores* behavior-returned ops because its kit behaviors only
  ever return `null`/`undefined`; move's behaviors are op-emitting at commit,
  so move must apply them.)
- `null` → abort: no scene write (this is `snapBackOrDelete`'s snap-back).
- all `undefined` → fall through to today's default: `reparentOnDrop` if set,
  else translate-only — using the **shaped** delta.

This resolves the `reparentOnDrop` / `snapToContainer` collision structurally:
a claiming behavior short-circuits the built-in, so the two reparent paths
never both fire. `cancel` is unchanged (scene never mutated mid-drag).

### 7. Consumer surface (so the demo reaches the pipeline the normal way)

`<SceneCanvas>` and `useSceneSelectTool` already declare `selectTool.move?:
UseMoveOptions<TPose>` (which already carries `behaviors`), and
`useSceneSelectTool` already forwards `move: wiredMoveOptions` into
`useSelectTool` (`useSceneSelectTool.ts:229`). The only break is `useSelectTool`
itself: its `move?: unknown` field is typed loose and explicitly *ignored*
(the "Phase 14e Task 3" comment). So the consumer surface is essentially a
one-file revival:

- In `useSelectTool`, re-type `move` to `UseMoveOptions<TPose>` and, when the
  move binding is built, attach `behaviors` to its `opts` — mirroring the
  existing `reparentOnDrop` → `opts.params` conditional (`useSelectTool.ts:372`).
  The two coexist in one `opts` object: `{ params?: { reparentOnDrop }, behaviors? }`.
- Verify `useSceneSelectTool`'s `wiredMoveOptions` spread preserves `behaviors`
  (it wires `cascadeWorldPose`; confirm it spreads `...moveOptions`).

Consumers then write `selectTool={{ move: { behaviors: [snapToContainer(...)] } }}`.
No net-new public prop.

### 8. Out of scope (v1)

- **Snap-preview chrome.** `ctx.snap` is threaded for behavior logic but not
  rendered — no dispatcher chrome channel in this change.
- **`transient` / `defaultTransient` channel.** Move is never transient in
  practice; the field stays accepted-but-ignored.
- The separate `move.ts:412` Phase 7 TODO (deps-aware `Action.enabled` for
  command-palette state) is unrelated and stays.

## Testing

- **Kit integration test** (`move.behaviors.integration.tsx`, or alongside
  `move.test.ts`): drive `moveAction` through the invoker/dispatcher with
  `opts.behaviors` set and assert:
  - container dwell-snap reparents the dragged node on commit;
  - snap-back aborts (no pose change) within radius;
  - snap-to-grid quantizes the committed delta.
- **Empty-behaviors regression:** existing `move.test.ts` continues to pass
  unchanged (default path untouched when `behaviors` is empty).
- **Consumer-surface test:** assert a `useSelectTool` configured with
  `move: { behaviors: [...] }` produces a move binding whose `opts.behaviors`
  is populated (and still carries `reparentOnDrop` params when both are set).
- **Demo:** a new terse demo under `demo/demos/` (e.g. `MoveSnapDemo.tsx`),
  registered in `demo/registry.ts`, mirroring `MoveDemo.tsx` but passing
  `selectTool={{ move: { behaviors: [snapToContainer(...), snapBackOrDelete(...)] } }}`
  with a couple of container targets — the planting-drag shape. Single-purpose,
  smallest plausible form, per demo conventions.

## Success criteria

`moveAction` runs `opts.behaviors`; the four snap behaviors work end-to-end
through the kit move action; proven by the integration test and the demo;
`tsc --noEmit && vitest run` clean.
