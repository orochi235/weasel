# Group-transform behavior contract

## Problem

Today's gesture behaviors (`MoveBehavior`, and parallel structures inside `useResize` / `useRotate`) return **id-specific results**: a `pose` field that overrides the primary's computed pose. The gesture is then responsible for figuring out how to keep the rest of the selection in lockstep.

In `useMove` this was implemented as "run behaviors only on the primary id; let secondaries inherit the raw drag delta." The flaw: a snap-to-grid behavior moves the primary onto a grid line, but secondaries keep translating by the original (off-grid) cursor delta. Over multiple drags the selection drifts apart.

### Concrete bug it surfaced

After running `divide` on a pile of overlapping ellipses, the user gets N output slivers, all selected. Dragging the group repeatedly causes one piece (the primary id, whichever sits at `draggedIds[0]`) to keep snapping to grid intersections while the rest follow the raw cursor delta. Each successive drag widens the gap. The user sees "one sliver becomes detached."

### Workaround landed

`src/interactions/gestures/move/move.ts` was patched to back-derive an *effective delta* from the primary's post-behavior pose (`pp.x - po.x`, `pp.y - po.y`) and apply that delta uniformly to all dragged ids. Works for the rect-shaped pose case. Limitations:

- Only honors `{ x, y }`-bearing poses. A custom `translatePose` that operates on a non-rect pose without `{ x, y }` falls back to the raw delta, silently reintroducing the drift.
- Leaks knowledge of the pose shape into the gesture core.
- `MoveBehaviorResult.pose` still exists as the official channel — the back-derivation is a workaround, not a contract change.

`useResize` doesn't have the same drift today because it operates on one bounds rect and remaps each leaf via `geom.remapBounds(...)`. The single-bounds-with-leaf-remap model is essentially a group transform under another name.

## Proposal

Replace id-specific behavior results with a **`GroupTransform`** that behaviors mutate and gestures apply uniformly.

### Shape

```ts
export type GroupTransform =
  | { kind: 'translate'; dx: number; dy: number }
  | { kind: 'scale';     pivot: Point; sx: number; sy: number }
  | { kind: 'rotate';    pivot: Point; angle: number };
```

Each gesture proposes a transform of the matching kind from the raw input:

| Gesture       | Initial transform                                          |
|---------------|------------------------------------------------------------|
| `useMove`     | `{ kind: 'translate', dx, dy }` from cursor delta          |
| `useResize`   | `{ kind: 'scale',     pivot, sx, sy }` from corner delta   |
| `useRotate`   | `{ kind: 'rotate',    pivot, angle }` from pointer angle   |

### New behavior contract

```ts
export interface BehaviorResult<TPose> {
  /** Replace the proposed transform. Applied uniformly to every id. */
  transform?: GroupTransform;
  /** Same as today — visual snap target announcement. */
  snap?: SnapTarget<TPose>;
}

export interface Behavior<TPose> {
  onStart?(ctx: BehaviorCtx<TPose>): void;
  onMove?(
    ctx: BehaviorCtx<TPose>,
    transform: GroupTransform,
  ): BehaviorResult<TPose> | void;
  onRelease?(ctx: BehaviorCtx<TPose>): void;
  onCancel?(ctx: BehaviorCtx<TPose>): void;
}
```

`BehaviorResult.pose` is removed. Behaviors that need to read the proposed primary pose can derive it themselves (transform applied to `ctx.origin.get(ctx.primaryId)`), but they don't return one — they return the *transform* that will produce it for every member.

### Applying the transform

Each gesture has a one-line per-id apply:

```ts
function applyTransform<TPose>(
  origin: TPose,
  t: GroupTransform,
  helpers: { translate: TranslateFn<TPose>; scale: ScaleFn<TPose>; rotate: RotateFn<TPose> },
): TPose {
  switch (t.kind) {
    case 'translate': return helpers.translate(origin, t.dx, t.dy);
    case 'scale':     return helpers.scale(origin, t.pivot, t.sx, t.sy);
    case 'rotate':    return helpers.rotate(origin, t.pivot, t.angle);
  }
}
```

The pose-shape-specific helpers (`translateRectPose`, `translatePath`, etc.) already exist; we add scale/rotate counterparts where missing.

### Migration

Behaviors stay backward-compatible during migration via an adapter layer. The internal contract is the new shape; the old `MoveBehavior` interface delegates via a small shim that:

1. Receives a `GroupTransform` of kind `'translate'`,
2. Computes the primary's proposed pose (so legacy behaviors that read it can run),
3. If the legacy behavior returns `pose`, derives a new `translate` transform from the pose diff against `origin.get(primaryId)`,
4. Wraps it in `BehaviorResult.transform`.

The shim covers all built-in behaviors during the transition. New behaviors target the new contract directly. Deprecation notices on `MoveBehaviorResult.pose`; remove after one release cycle.

### Built-in behaviors to migrate

- `snap()` — emits `{ transform: { kind: 'translate', dx: snappedX - originX, dy: snappedY - originY } }`. The pose-shape-aware delta extraction lives inside the snap helper, where it belongs.
- `snapBackOrDelete()` — release-time, emits delete ops; no `transform` interaction.
- `momentum()` — emits `transform` updates over time. Generalizes to non-rect poses if we add scale/rotate helpers.
- `cloneByAltDrag()` — already op-focused; no `pose` to migrate.

For resize/rotate the migration is purely behavior-side (the gestures already apply a group transform internally, they just don't expose it to behaviors yet).

## Out of scope

- **Non-affine transforms** (warp, perspective). The `GroupTransform` union explicitly covers the three rigid transforms gestures emit; arbitrary affine isn't a goal.
- **Per-id transform overrides.** If a behavior needs to modify a single member differently from the group (e.g., a "snap this one to a different cell"), it should emit ops directly via `applyOps` rather than going through `BehaviorResult.transform`. Per-id transforms in the behavior return value would reintroduce today's drift problem.
- **Multi-gesture composition** (e.g., simultaneous move + rotate). One gesture, one transform kind.

## Open questions

- **Pivot semantics across scale/rotate.** Today resize stores `originRotation` + `anchor` separately. A unified `pivot: Point` collapses these — but the geometry transform needs to know whether the pivot is in world space or local frame. Land on a convention before the migration.
- **Delta vs absolute representation.** `translate` is naturally a delta (`dx`, `dy`). Rotate is naturally absolute (current angle from gesture start). Scale could be either (ratio vs. corner-distance ratio). Pick the one that makes behavior composition easiest — probably "delta-from-origin" for all three so behaviors see a uniform "how much has the gesture moved from rest" signal.
- **Should the transform be readable AND mutable per-frame, or only mutable on `onMove` return?** Mutable per-frame means a behavior can react to another behavior's earlier modification within the same tick. Cleaner ordering vs. simpler model — start with onMove-return only.

## Acceptance criteria

- A multi-select translate with `snap()` keeps the selection in lockstep across arbitrary drags. The "divide → drag → sliver detaches" bug stops reproducing.
- Existing kit tests for `useMove`, `useResize`, `useRotate` continue to pass.
- The back-derivation workaround in `move.ts` is deleted (effective delta comes from the behavior result's `transform`, not from a `{ x, y }` field read).
- The new contract is documented in `docs/proposals/interaction-channels.md` (or a sibling) and one built-in behavior (`snap()`) is migrated as the reference implementation.

## Plan

Half-day for `useMove` + `snap()` migration with the shim. Another half-day for `useResize` and `useRotate` to expose their group transforms to behaviors. Total: ~1 day. Ship the shim first so legacy behaviors keep working; remove it after consumers migrate.
