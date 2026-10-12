# Skinning: bone weights that bend a path

**Build status: in progress on branch `skinning-clips`. The list under "Arcs" says which parts
exist; anything not ticked there is unbuilt.** Delete this file when the last arc merges.

**What this is:** the design for skinning on top of the rig in
`packages/core/src/animation/rig/`: one path whose points follow several joints by weight, so
the outline bends at a joint where bound nodes only hinge.

**Who it's for:** whoever builds or reviews it. Assumes the rig (`bindRig`, `Skeleton`, `Pose`),
pose overrides, and how a path node is painted.

**What it answers:** where the deformation runs, what the weights are, where a skeleton lives
once it can be edited on canvas, and how the bent path reaches paint, picking, and bounds.

## Decided with the user, 2026-10-11

- **The path's own points are blended on the CPU, and the renderer is handed a new `Path` each
  frame.** Not the tessellated mesh, and not a vertex shader. Strokes are ribbons rebuilt from
  the path, and picking and clips read a path, so this is the one route where everything a node
  shows agrees. A shader path for stroke-less fills can be added later behind the same weights.
- **Authoring is in scope:** automatic weights, a tool for editing weights on canvas, and a tool
  for drawing and moving bones.
- **A skeleton lives in a node's data.** A node carries `data.skeleton`, and each skinned path
  carries `data.skin`. Joints are not scene nodes.

Measured cost of the first decision (Node, built `geom` and `stroke`, a closed loop of cubic
segments with a 3px round-joined stroke, µs per path per frame):

| Anchors | Blend the points | Tessellate fill | Rebuild stroke |
|--------:|-----------------:|----------------:|---------------:|
|       8 |             0.06 |             9.7 |           21.1 |
|      24 |             0.13 |             7.9 |           18.1 |
|      64 |             0.34 |            13.3 |           28.4 |
|     200 |             1.03 |            71.0 |           72.2 |

## Decided by the implementer, not ruled on

Each is reversible.

- **Weights are one array per joint, indexed by point.** `type Skin = Record<string, number[]>`,
  keyed by joint name as a `Pose` is. Point `i` is the `i`-th coordinate pair of the path's
  `coords`, so anchors and curve handles are weighted alike. A joint a skin does not name weighs
  nothing. Weights are normalized per point when applied; a point no joint weighs stays at rest.
  A rect path is skinned as its four corners.
- **The rule is linear blend skinning:** `p' = Σ wᵢ · (Mᵢ · Bᵢ⁻¹) · p`, over the joint world
  matrices the rig already resolves.
- **Automatic weights come from distance to bones.** A joint's bones are the segments to its
  children. A joint with no child gets no weight, being where its parent's bone ends, so a limb
  needs an end joint to be covered. A point's weight for a joint is `1 / distance^power`, the
  largest `max` kept. Defaults: `power` 4, `max` 2.
- **The bent path reaches the canvas as a pose override.** `PoseOverride` gains `path`, beside
  `pose` and `alpha`. The rig writes the bent path and a pose that is the path's bounds with no
  rotation, so the selection chrome, culling, and bounds follow the bent shape. Paint and
  picking already carry a computed path to the painter for derived nodes
  (`NodePaintCtx.derivedPath`); an override path travels the same way and wins over a derived
  one, and `kit:path` paints it in place of `data.path`.
- **A skeleton's joints are stored relative to the pose of the node that carries it**, so moving
  that node moves the rig.
- **Path edits do not renumber weights yet.** Inserting or deleting a point on a skinned path
  leaves `data.skin` misaligned. The weight tool arc has to settle it: splice the arrays in the
  anchor edit actions, or re-run automatic weights.

## Arcs

- [x] **Blend and automatic weights.** `skinPath(path, skin, motions)`, `motionsFromRest`, and
  `autoSkin(path, skeleton, opts)` in `animation/rig/`, pure.
- [x] **An override path.** `PoseOverride.path`, read by paint, picking, and the silhouette;
  bounds follow the override's `pose`. Not yet seen by a node that derives from the skinned
  one (`DerivedDep.path` answers the derived path only), nor by a view with its own `toPose`.
- [x] **The rig skins.** `bindRig` takes `skins` (node id to `Skin`) beside `bindings`, and
  `bake` writes the bent path into the document.
- [x] **Binding from a node.** `rigFromNode` and `useRigNode` read `data.skeleton` from a node,
  placed by its pose, and under it each node's `data.skin` or `data.joint`. The hook binds
  again, with a new `rig.target`, when anything it read changes; an animation on the old
  target is not carried over.
- [x] **Demo.** `apps/site/demos/SkinDemo.tsx`, seen in headless Chromium: the fill and stroke
  bend as one outline, and a click on the bent forearm selects it with the box at its bounds.
- [ ] **Bone tool.** Draw, select, and move joints of a node's `data.skeleton`, each drag one
  scene op.
- [ ] **Weight tool.** Show a joint's influence as color on the path, and edit weights of
  selected points.

## Limits to state in the docs

- Averaging positions pinches the inside of a sharp bend. A wider blend or extra points near the
  joint hide it.
- Only anchors and handles are blended, so a long curve segment across a joint bends less truly
  than two short ones meeting there.
