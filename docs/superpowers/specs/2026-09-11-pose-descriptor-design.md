# One pose descriptor — design

**Status: designed 2026-09-11, not built.** Branch `pose-descriptor-build`; plan in
`docs/superpowers/plans/2026-09-11-pose-descriptor.md`. Delete both files when
the work merges.

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

- **`fromBounds(bounds, template): TPose`** (required) — a pose occupying
  `bounds`, of the same kind as `template`. `remapBounds` cannot do this:
  remapping a star into a box yields a star, and a rotated rect keeps its
  rotation. The auto descriptor returns a rect `Path` when the template is
  path-like and a plain rect otherwise.
- **`withRotation?(pose, rotation): TPose`** — replaces `RotateGeometry`
  (`rotate/options.ts`), which nothing reads. Absent means the pose cannot be
  rotated, and the rotate action leaves it alone.

`translatePoseViaDescriptor` and `visualBoundsViaDescriptor` move from
`align/align.ts` into the descriptor module, so `core/scene` can use them
without importing a React hook's file.

`AlignBoundsProjection` and `RECT_ALIGN_PROJECTION` are deleted. Alignment
wants the *visual* AABB, which is `visualBoundsViaDescriptor`, plus
`translatePoseViaDescriptor`.

## One box type

`ResizePose` (`interactions/gestures/types.ts`) and `AlignBounds`
(`features/guides/alignment/types.ts`) are `Bounds` without `rotation`. Both are
deleted; `Bounds` is used everywhere, including the conditional-type gates that
read `TPose extends ResizePose`. Nothing assigns a `rotation` into either today,
so this only loosens types.

`getBounds` keeps its current meaning, the unrotated frame. The rect
descriptor's `getBounds` is the identity, so its result still carries any
`rotation` field, and three readers fall back to that field when a descriptor
has no `getRotation` (`visualBoundsViaDescriptor`, `flipPoseAboutBounds`,
`useViewHelpers`' bounds). That fallback stays.

## Supplied once

`<SceneCanvas poseDescriptor={…}>`, defaulting to `AUTO_POSE_DESCRIPTOR`.
`Canvas`'s `geometry` prop is renamed `poseDescriptor`; SceneCanvas passes its
own through instead of letting Canvas fall back.

Inside SceneCanvas it is published as a new **`poseDescriptor` dep**, and every
built-in action that touches a pose reads it: move, resize, rotate, flip,
nudge, align, distribute, group, clone, duplicate. The same value reaches the
view layer: selection chrome, the selection overlay, body picking, the area and
lasso hit tests, and the synthesized scene adapter.

Surfaces outside a SceneCanvas take it as an option or prop, defaulting to
`AUTO_POSE_DESCRIPTOR`: `sceneToAdapter`, `arrayAdapter`, `useSelectTool`,
`nestedHitTester`, `MinimapCanvas` (rendered beside SceneCanvas, not inside
it), `computeFitView`, and the selection-overlay factories (plain functions, so
they cannot read a dep).

Removed, each replaced by the descriptor:

| Option | Where |
|---|---|
| `geometry` | `UseResizeOptions`, `UseRotateOptions` (unread today), `Canvas` (renamed) |
| `projection` | `UseResizePolicyOptions`, `ResizePolicy` dep, alignment options |
| `translatePose` | `UseMoveOptions` (unread today), `arrayAdapter` |
| `poseBounds` | `useSelectTool`, `arrayAdapter`, `sceneAdapter`, `MinimapCanvas`, `nestedHitTester`; positional in `computeFitView` |
| `intersectsRect` | `arrayAdapter` |
| `getBounds`, `fromBounds` | selection overlay factories and `composeSelectionPose` |

`sceneAdapter`'s `cascadeContainerPose: 'rect' | translateFn` becomes a
boolean; the cascade and `commitPaste` translate through the descriptor.

Standalone helpers — the animation wrappers, `@weasel-js/d3`,
`@weasel-js/diagram`, `useAlign`/`useDistribute`, the flip helpers — keep
taking the descriptor as an explicit argument, retyped.

## Where built-ins bypass it today

| Site | Fix |
|---|---|
| `move.ts`: `scenePoseAdapter` returns `PoseAdapter<RectPose>`, forcing 14 casts | Retype to `unknown`; type-only |
| `move.ts`: layout pass world pose and selection box, source-container bounds, reflow change check, `applyReparent`, `releaseDrop`, a behavior's override pose | `translatePoseViaDescriptor` and `getBounds` |
| `defaults/group.ts`: union of raw member poses becomes the container's authored pose | Union of member `getBounds` (rotation ignored, as now), then `fromBounds` with the first member as template |
| `kitRegistry.ts`: `unionOfChildren` | See below |
| `defaults/rotate.ts`: reads `x`/`y`/`width`/`height`/`rotation` off the pose and spreads `rotation` in | `getBounds`, `getRotation`, `withRotation`, `translatePoseViaDescriptor`; skips poses that cannot rotate |
| `defaults/flip.ts` hard-codes `AUTO_POSE_DESCRIPTOR`; `flip/helpers.ts` writes `rotation` directly | The dep; `withRotation` |
| `defaults/nudge.ts`, `align.tsx`, `distribute.tsx` hard-code a descriptor | The dep |
| `defaults/clone.ts`, `duplicate.ts`: private rect `translatePose` | `translatePoseViaDescriptor` with the dep |
| `defaults/resize.ts`: `defaultTranslate` spreads `x`/`y` | `translatePoseViaDescriptor` |
| `useSceneSelectTool.ts`: container cascade takes its delta from `.x`; bounds and pick pre-filter use `aabbOfPose` and `pose.rotation` | Descriptor `getBounds` delta and `translate`; `getBounds` and `getRotation` |
| `sceneAdapter.ts`: container cascade and `commitPaste` read `.x`/`.y` | Same |
| `poseGeometry.ts` `aabbOfPose` and `hitTestArea.ts` hard-code the rect/path split; `poseGeometry.ts` duplicates `isPathLike` | Take the descriptor; delete the duplicate |
| `animation/behaviors/momentum.ts` spreads `x`/`y` | A `poseDescriptor` option |
| `NodeShape.ts` built-in painters (text, path, shape, image, rect fallback) cast to a local `RectPose`; `editAnchors.ts` likewise | These really are rect-only, but painter matching reads `data`, so they can be chosen for any pose. Add `isRectPose` beside `isPathLike`, gate those painters on it, and key the painter cache on the result as well as the data; delete both local `RectPose` copies |

Not bypasses, and left alone: the insert snap behaviors (their origin is an
insertion point, typed as `TPose` by the shared gesture context), `snapPoint`
(constrains `TPose extends` a point), and `tileGrid` (its `cellToPose` option is
the override).

## Scene stays geometry-free

`Scene` has no geometry and the 3D doc depends on that, so the scene does not
take a descriptor. `unionOfChildrenVia(descriptor)` builds a union function;
the kit registry installs `unionOfChildren = unionOfChildrenVia(AUTO_POSE_DESCRIPTOR)`
under `UNION_OF_CHILDREN`, which covers rect and Path poses. A consumer with a
custom pose registers their own under that key — consumer entries already win
in `withKitRegistry`.

A node's `derivePose` is serialized by function identity against the scene's
registry, and `toJSON` throws on a function the registry does not hold. So the
group action cannot build its own closure: it uses whatever the scene's
registry holds under `UNION_OF_CHILDREN`. `Scene` gains a read-only `registry`
accessor (the merged registry) for this.

## Tests

A test-only pose that is neither a rect nor a Path — a circle, `{cx, cy, r}`,
with its own descriptor — is driven through move (translate, drag into a
container, layout pass), group, resize, rotate, flip, align, distribute, nudge,
clone, duplicate, the cascades, picking, area select and the adapters. Each
asserts real geometry and no `NaN`, and each is watched failing before its fix.
Painter gating gets a test that a circle-posed node carrying `data.text` does
not reach the text painter.

Rect behavior is unchanged, and Path poses change only where they produced
`NaN` or junk fields before (align, distribute, rotate, duplicate), so the
existing unit suite and the visual baselines are the regression gate.

## Release

One `patch` changeset. Its prose says it is breaking and lists the renames and
removed options, each with its replacement.
