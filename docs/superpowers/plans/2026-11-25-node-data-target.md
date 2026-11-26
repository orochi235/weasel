# Node-data target: one target over any field of a node's data

**Status (2026-11-25): unbuilt.** Branch `node-target`, cut from `anim-import`. Delete this file when the
work merges. Decision recorded in `docs/TODO.md` "## Animation import" (Mike chose the general target, 2026-11-25).

For: the session building it. Answers: how a clip track named `<id>.<attribute>` moves a scene node's
data, and how trim and vertex color fold into the same mechanism.

## What already exists

`PoseOverride.data(stored)` is a per-node ply that painting, picking, drawn bounds and derivations read
through `nodeAsShown` (`packages/core/src/core/scene/nodeAsShown.ts`). The shown copy is memoized on
(data function, stored data), so a writer changes what it shows by replacing the function. The pose
target (`packages/core/src/animation/poseTarget.ts`) is the model: `createTarget` with `show` installing
a ply, `set` committing to the document, `rest` clearing the ply, one target per node per scene
(`scenePoseTarget`'s table).

So the general target needs no new render path. Its cost question is the memo: a value changing every
frame replaces the function every frame, so the node's shown data, and whatever a painter derives from
it (tessellation, bounds), is rebuilt each frame. Trim and vertex color today bypass that through
`NodePaintCtx` (`packages/core/src/canvas/paintOverrides.ts`).

## Design

1. **`sceneDataTarget(scene, id, lens, axes?)`** in `packages/core/src/animation/dataTarget.ts`. A `lens`
   is `{ key: string; get(data): T; with(data, value): data }`. The target's `get` reads the lens off the
   committed data, `set` writes `scene.update(id, { data: lens.with(data, v) })` unrecorded (as the pose
   target writes poses), and `show` installs one ply per node whose `data` composes every live lens on
   that node: one ply, not one per field, so ten animated fields cost one shown copy a frame. Targets are
   kept per (scene, id, lens.key), so every animation of one field adds. Axes come from `axesOf` on the
   value, or the caller's. Nothing in it reads `pose`, so a `Pose3` scene uses it unchanged.
2. **`sceneClipTargets`** gains `data:<id>.<key>` resolved through a lens table the caller passes
   (`options.lenses: Record<string, Lens>`), so a format names fields and core never learns SVG.
3. **svg binder**: `svgClipLenses()` in `@weasel-js/svg` maps SMIL attribute names onto the kit drafts
   `svgNodesToKitDrafts` makes (opacity, fill/stroke color and opacity, stroke-width, dash and offset,
   geometry attributes re-lowered to the path). `transform.<type>` binds to the pose target, which needs
   parse to keep an animated element's transform as a pose (today it bakes every transform).
4. **trim and vertex color as instances** (the render-path change): `TrimOverrideRegistry` and
   `ColorOverrideRegistry` become lenses over `stroke.trim` and the vertex-color arrays, and
   `withPaintOverrides` goes. Benchmark before and after on one fleet node (`--kind bench`): a trim
   animation on 1, 100 and 1,000 path nodes, frame time and allocations, and a still scene for the
   overhead where nothing animates. If the shown-copy rebuild costs past noise, keep a paint-context fast
   path for fields a painter can apply without new geometry, and say so in the report.

## Order

1 and 2 are additive and land first, with tests beside `poseTarget.test.tsx`. 3 follows on the svg side.
4 lands only with its numbers.
