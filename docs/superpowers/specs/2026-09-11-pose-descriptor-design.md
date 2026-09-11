# One pose descriptor — design

**Status: designed 2026-09-11, not built.** Branch `pose-descriptor`. Delete this
file when the work merges.

For whoever implements it. It is Phase 0 of
`2026-08-22-3d-kernel-design.md`, rescoped: the kit's built-in actions, painters
and chrome stop assuming a pose is `{x, y, width, height}` and read one
consumer-supplied descriptor instead. It pays off in 2D on its own — today a
pose without top-level `x`/`y` gets `NaN` written into it when it is dragged
into a container (`move.ts`, the reparent path).

Out of scope: `ToolCtx`, and making points, cameras and boxes generic across
the action pipeline. Those move to the 3D doc's Phase 2 prerequisites, because
in 3D a pointer is a ray, and the type that replaces the world point belongs to
the picking design.

## The descriptor

`PoseProjection<TPose>` (`interactions/actions/resize/geometry.ts`) is renamed
`PoseDescriptor<TPose>`, matching `RECT_POSE_DESCRIPTOR`,
`AUTO_POSE_DESCRIPTOR` and `pathPoseDescriptor`, and ending its confusion with
the unrelated `GeometryProjection` (pose → data sync). Its existing members
stay: `getBounds`, `remapBounds`, `translate?`, `intersectsRect?`, `lerp?`,
`getRotation?`, `supportsRotation?`. Two are added:

- **`fromBounds(bounds, template): TPose`** — a pose occupying `bounds`, of the
  same kind as `template`. `remapBounds` cannot do this: remapping a star into
  a box yields a star, and a rotated rect keeps its rotation. The auto
  descriptor returns a rect `Path` when the template is path-like and a plain
  rect otherwise.
- **`withRotation?(pose, rotation): TPose`** — absorbs `RotateGeometry`
  (`rotate/options.ts`), whose `getRotatedBounds` is `getBounds` plus
  `getRotation`. `RotateGeometry` is deleted.

`AlignBoundsProjection` is deleted. Alignment wants the *visual* AABB, which is
`visualBoundsViaDescriptor(pose, descriptor)` (`align/align.ts`), plus
`translate`.

## One box type

`ResizePose` (`interactions/gestures/types.ts`) and `AlignBounds`
(`features/guides/alignment/types.ts`) are `Bounds` without `rotation`. Both are
deleted; `Bounds` is used everywhere, including the conditional-type gates that
read `TPose extends ResizePose`. `getBounds` returns the unrotated frame and
never sets `rotation`; rotation is `getRotation`'s.

## Supplied once

`<SceneCanvas poseDescriptor={…}>`, defaulting to `AUTO_POSE_DESCRIPTOR`.
`Canvas`'s `geometry` prop is renamed `poseDescriptor`. SceneCanvas stops
hard-coding the auto descriptor into its view inputs and passes the prop.

It is published as a new **`poseDescriptor` dep**. Every built-in action reads
it — move, resize, rotate, flip, align, distribute, group — and the view layer
reads the same value: selection overlay, minimap, body picking, nested hits,
the scene adapter's area hit test.

Removed, each replaced by the descriptor:

| Option | Where |
|---|---|
| `geometry` | `UseResizeOptions`, `UseRotateOptions` |
| `projection` | `UseResizePolicyOptions`, `ResizePolicy` dep, alignment options |
| `translatePose` | `UseMoveOptions`, `arrayAdapter` |
| `poseBounds` | `useSelectTool`, `arrayAdapter`, `sceneAdapter`, `MinimapCanvas`, `nestedHit` |
| `intersectsRect` | `arrayAdapter` |
| `getBounds`, `fromBounds` | selection overlay |

Standalone functions — the animation wrappers, `@weasel-js/diagram`, the
`align`/`distribute`/`flip` helpers — keep taking the descriptor as an explicit
argument, retyped.

## Where built-ins bypass it today

| Site | Fix |
|---|---|
| `move.ts`: `scenePoseAdapter` returns `PoseAdapter<RectPose>`, forcing 14 casts | Retype to `unknown`; type-only |
| `move.ts`: selection box, drag translate, container bounds, reflow change check, `applyReparent`, `releaseDrop` read or spread `x`/`y` | `getBounds` and `translate`. The reflow check compares `getBounds` results |
| `defaults/group.ts`: union of raw member poses becomes the container pose | Union of `visualBoundsViaDescriptor`, then `fromBounds` with the first member as template |
| `kitRegistry.ts`: `unionOfChildren` | See below |
| `useSceneSelectTool.ts`: container cascade takes its delta from `.x` and moves children with `translateRectPose` | `getBounds` delta, `translate` |
| Uncast `{...p, x: p.x + dx}` spreads: `flip/helpers.ts`, `defaults/resize.ts`, `insert/behaviors/snapToGrid.ts`, `snapToGuides.ts`, `animation/behaviors/momentum.ts`, `layout/strategies/snapPoint.ts`, `tileGrid.ts` | `translate` |
| `defaults/flip.ts` hard-codes `AUTO_POSE_DESCRIPTOR` | The dep |
| `NodeShape.ts` built-in painters (text, path, shape, image, rect fallback) cast to a local `RectPose`; `editAnchors.ts` likewise | These really are rect-only, but painter matching reads `data`, so they can be chosen for any pose. Add `isRectPose` beside `isPathLike` and gate the lookup on it; type them `NodeShapeEntry<unknown, RectPose>`; delete both local `RectPose` copies |

## Scene stays geometry-free

`Scene` has no geometry and the 3D doc depends on that, so the scene does not
take a descriptor. `unionOfChildren` becomes a factory,
`unionOfChildren(descriptor)`. The kit registry installs it over
`AUTO_POSE_DESCRIPTOR`, which already covers Path poses. A consumer with a
custom pose registers their own under `UNION_OF_CHILDREN` — consumer entries
already win in `withKitRegistry`.

The group action must reference the registry's entry, not a closure it builds
from the dep: a node's `derivePose` serializes as its registry key, so a
closure the registry does not hold would not survive a reload. The plan
confirms how `derivePoseKey` is resolved and picks the mechanism.

## Tests

A test-only pose that is neither a rect nor a Path — a circle, `{cx, cy, r}`,
with its own descriptor — is driven through move, drag-into-container, group,
resize, rotate, flip, align, distribute and snapping. Each asserts real
geometry and no `NaN`, and each is watched failing before its fix. Painter
gating gets a test that a circle-posed node carrying `data.text` does not reach
the text painter.

Rect and Path behavior is unchanged, so the existing unit suite and the visual
baselines are the regression gate.

## Release

One `patch` changeset. Its prose says it is breaking and lists the renames and
removed options, each with its replacement.
