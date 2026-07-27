# groups

Hierarchy math: composing local poses into world space, walking children, and
hit-testing through nesting.

> **Naming.** "Group" here means a structural `ContainerNode`
> (`kind: 'container'`) — the real Cmd+G group that round-trips to SVG `<g>`.
> It is *not* a saved selection. See `docs/taxonomy.md`.

## The central fact

Since nesting landed, `getPose(id)` on an adapter returns the **local** pose —
relative to the object's direct parent. Anything that needs to draw, hit-test,
snap, or otherwise reason in world coordinates must route through
`composeWorldPose`, which walks the parent chain folding local poses together.

Forgetting this is the classic nesting bug: everything looks correct until an
object is moved *inside a group that itself has a non-identity pose*, and then
the offsets are wrong by exactly the parent's transform.

## Files

| File | Role |
| --- | --- |
| `composePose.ts` | `composeWorldPose` (local chain → world), `rebaseLocalPose` / `decomposeRectPose` (world → local under a new parent), `worldPoseLookup`. |
| `children.ts` | `createChildrenLayer` — z-ordered child renderer. Replaces hand-rolled `for (id of getChildren())` loops with a `RenderLayer` over an `OrderedAdapter`. Index 0 draws first (bottom). No-ops silently when the adapter omits the optional `getChildren`, so z-order can be adopted incrementally. |
| `nestedHit.ts` | `nestedHitTester` — hit-testing that descends through containers. |
| `unionBounds.ts` | `unionBounds` — union AABB over poses. Returns `null` for an empty input. |

## Pose shape is generic, so composition is too

The kit doesn't assume your pose shape, so it can't assume how to compose two
of them. `composeWorldPose` takes a consumer-supplied `compose`.

- For the common axis-aligned `{x, y, width, height}`, use `composeRectPose` —
  translation only, child dimensions preserved.
- Custom pose shapes (paths, matrix transforms) supply their own.

## `rebaseLocalPose` — why reparenting needs an inverse

When a node moves to a new parent, its *visual* world position must not jump.
`rebaseLocalPose` converts a world pose into the local pose that reproduces it
under the target parent. Any reparent that skips this will teleport the node by
the difference between the two parents' transforms.
