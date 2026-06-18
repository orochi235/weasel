# Rotation representation consistency

- **Date:** 2026-06-18
- **Status:** Approved (design); pending implementation plan
- **Area:** core geometry — pose rotation, hit-testing, anchors, silhouettes, chrome

## Problem

Rotation is stored as a `rotation` field on a node's pose (radians), with the
pivot fixed at the pose's AABB center `(x + w/2, y + h/2)`. Painters and
geometry providers emit **unrotated** (AABB-aligned) geometry; rotation is a
*separate step* that each consumer must remember to re-apply. Nothing enforces
it, and the unrotated geometry is the easy default to reach for. The result is a
recurring class of bug: "something neglected to apply the rotation."

Three concrete instances are currently broken — the rendered shape is rotated,
but these are not:

1. **Hit-test** — `poseContainsRotated` (`src/canvas/SceneCanvas/poseGeometry.ts`)
   explicitly skips rotation for path-shaped poses (`!isPathLike` guard), so
   clicking a rotated path-shaped node misses (tests the unrotated polygon).
2. **Path-edit anchor handles** — `resolveEditablePathOf`
   (`src/canvas/deps/editAnchors.ts`) → `pathAtPose` (`src/canvas/NodeShape.ts`)
   only **translates**, never rotates, so anchors render at the unrotated
   contour while the shape is drawn rotated. (This produced the stray "boxes"
   that only lined up after rotating the shape.)
3. **Silhouettes / clips** — `findShapeSilhouette` (`src/canvas/NodeShape.ts`)
   returns unrotated paths, so container clips of rotated children and
   area-select containment use the wrong shape.

### Why it keeps happening: three mechanisms, all the same math

The kit encodes "rotate about the AABB center by `pose.rotation`" in three
different ways, each re-deriving the gate condition and the pivot:

1. **Render-tree transform** — `wrapWithPoseRotation` / `rotateAroundAABBCenter`
   (`src/canvas/poseRotation.ts`), used by committed paint (`buildSceneLayer`)
   and the preview ghost (`usePreviewGhostLayer`). Rotation is a group transform
   wrapping draw commands. This keeps strokes/text crisp (one matrix on the
   canvas context) and is a capability we want to keep.
2. **Coordinate baking** — `pathInWorld` (`src/features/paths/pathInWorld.ts`),
   used by boolean ops. Translates **and** rotates a path's coords into world
   space; promotes a rotated rect to a 4-point polygon. This is `pathAtPose`
   (translate) **plus** the rotation step.
3. **Per-point rotation** — selection chrome (`src/features/selection/overlay.ts`),
   affordance hit-test (`src/canvas/affordanceAt.ts`), affordance frame
   (`src/affordances/composeAffordanceLayer.ts`). Each re-derives `rotatePoint`
   about the center. These are *not* broken, but they are three more copies.

The unrotated helpers (`pathAtPose`, raw `findShapeSilhouette`) are public and
freely reachable, so "give me this node's geometry" silently hands back
unrotated geometry — a footgun.

## Goals

- One primitive that is the *only* place the rotation convention is encoded.
- The default, public way to ask for a node's geometry returns it in **world**
  space (rotation included). Getting unrotated/local geometry becomes an
  explicit, purpose-named choice.
- Fix the three broken consumers by routing them through the world helper.
- A guardrail test so render / hit / anchor / clip / chrome can't silently drift
  apart again.

## Non-goals

- **No capability loss.** The renderer keeps local-geometry + one group
  transform (crisp strokes/text); resize keeps unrotated-AABB math; the path
  editor keeps editing in the local frame and round-tripping world→local.
- **Not** generalizing rotation to a full affine transform (scale/skew). That
  was considered and rejected for this change — larger semantic shift,
  interacts with resize (mutates `w/h`) and serialization. Can revisit later.
- **No** Pose abstraction object. Poses are consumer-defined, JSON-serializable,
  generic `TPose` data; the right seam is a function/descriptor, not a class.

## Design

### 1. One primitive: `poseRotationOf`

```ts
poseRotationOf(pose): { cx: number; cy: number; rotation: number } | null
```

The single encoding of the convention: returns the pivot + angle when `pose`
has a nonzero `rotation` **and** `x/y/width/height`; otherwise `null`. Lives
alongside the existing rotation helpers (`src/canvas/poseRotation.ts`), exported
for kit-internal consumers.

`wrapWithPoseRotation`, `pathInWorld`, the chrome math, hit-test, and anchors
stop inlining the `if (rotation && x != null …)` check and derive from this. If
the convention ever changes (different pivot, etc.), it changes in one place.

### 2. Two clearly-framed geometry seams

- **World (default — what feature code reaches for):** `pathInWorld(path, pose)`.
  Already exists (translate + rotate). Becomes *the* answer to "where is this
  shape." Gated internally by `poseRotationOf`.
- **Local (renderer / resize / edit-commit only):** `pathAtPose(path, pose)` —
  translate-only. Kept, but **renamed/redocumented to make the frame explicit**
  ("local frame; the caller must apply the pose transform"). Per the approved
  "rename + redirect" choice, the rename signals intent; we do not hide it
  `@internal`.

### 3. Redirect the three broken consumers onto the world seam

- **Hit-test** (`poseContainsRotated`): remove the `!isPathLike` skip. When
  `poseRotationOf(pose)` is non-null, inverse-rotate the query point about the
  center, then run the existing **local** `poseContains`. This matches the
  renderer exactly and also fixes rotated `kind:'rect'` poses (which are
  `isPathLike` and currently fall through to an unrotated AABB test).
- **Silhouettes / clips** (`findShapeSilhouette`): bake rotation via the world
  seam. Every consumer (container clips in `buildSceneTree`, area-select in
  `sceneAdapter`, preview-ghost clip in `usePreviewGhostLayer`) wants world —
  there is no local-silhouette consumer, so this simply becomes correct.
  `paint()` is unaffected (it uses `pathAtPose` directly, then the render wrap),
  so there is no double-rotation.
- **Anchors** (`resolveEditablePathOf`): its doc already promises world coords —
  apply the rotation it currently forgets. **Paired fix:** `applyEdit` must
  inverse-rotate the edited world path back to the local frame before storing
  (the stored path stays unrotated; `pose.rotation` is preserved), so anchor
  edits round-trip. This is the legitimate edit-commit local seam.

### 4. Guardrail: parity test

A test that, for a representative rotated pose, asserts these all map the same
reference point/shape identically:

- render-wrap (`wrapWithPoseRotation` / `rotateAroundAABBCenter`)
- world bake (`pathInWorld`)
- hit-test inverse (`poseContainsRotated`)
- chrome (`overlay.ts` rotation)

Any future consumer that diverges from the shared convention fails here.

### 5. Secondary (consistency cleanup, separable phase)

Migrate the three per-point chrome reimplementations
(`overlay.ts`, `affordanceAt.ts`, `composeAffordanceLayer.ts`) to derive their
matrix/pivot from `poseRotationOf` (§1). Not broken today, but folding them in is
what makes the kit truly have *one* rotation representation. Sequenced last so it
can be deferred if implementation reveals risk.

## Public API impact

- **Add:** `poseRotationOf` (kit-internal/exported as appropriate).
- **Behavior change (bug fix):** `poseContainsRotated`, `findShapeSilhouette`,
  `resolveEditablePathOf` now apply rotation. Consumers relying on the
  unrotated-but-named-as-world behavior were already wrong.
- **Rename:** the translate-only local helper (`pathAtPose`) gets an
  explicit-local name; `pathInWorld` is promoted as the default world accessor.
  Update the barrel (`src/index.ts`) and any consumers accordingly.

## Testing strategy

TDD throughout. Per fix, a red test first:

- Hit-test: a polygon/rect pose with rotation + AABB; a point inside the rotated
  visual but outside the unrotated shape → contained; and the converse → not.
- Silhouette: `findShapeSilhouette` of a rotated pose returns rotated coords.
- Anchors: `resolveEditablePathOf` returns rotated world anchors; `applyEdit`
  round-trips (edit a displayed-world anchor → stored local path matches).
- Primitive: `poseRotationOf` returns transform vs `null` per the gate.
- Path transform: rotated rect promotes to polygon (already covered by
  `pathInWorld`; extend if needed).
- Parity test (§4).

Existing `poseGeometry.test.ts` "path-shaped poses ignore getRotation" uses a
bare `tri` polygon with no AABB/rotation fields, so it stays green; its intent
comment is updated to the new contract (path poses **with** rotation+AABB do
rotate; without, they don't).

## Risks & mitigations

- **Double-rotation.** The rotation step is applied only at world seams that the
  render wrap does *not* also cover (`findShapeSilhouette`, `resolveEditablePathOf`,
  `poseContainsRotated` inverse). Never inside `pathAtPose`/`paint`. Parity test
  guards it.
- **Anchor edit round-trip.** Without the `applyEdit` world→local inverse, the
  anchors fix would corrupt stored paths on commit. Treated as a paired,
  same-phase change with its own round-trip test.
- **Chrome migration regressions (§5).** Sequenced last and separable; covered by
  existing chrome tests plus the parity test.

## Phasing

1. `poseRotationOf` primitive + refactor `wrapWithPoseRotation` / `pathInWorld`
   to use it (no behavior change; green).
2. Hit-test fix (`poseContainsRotated`).
3. Silhouette fix (`findShapeSilhouette`).
4. Anchors fix (`resolveEditablePathOf` + `applyEdit` round-trip).
5. Parity test (guardrail).
6. Rename/redirect local seam + barrel update.
7. (Secondary) Chrome consolidation onto the primitive.
