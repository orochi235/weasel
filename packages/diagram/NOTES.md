# Notes for changing this package

Traps this package's own work hit, kept because none of them is visible in the
code that resulted. Consumer-facing rationale is in `README.md`; this file is
not published.

- **A stroke marker on a derived path was dropped by the painter, not by the
  edge.** `kit:derived` emitted its stroke command and returned; `kit:path`
  follows with a `markerDrawCommands` pass and it did not.

- **The `orthogonal` router consulted only the departing end's normal**, so an
  edge between two boxes standing side by side dropped onto a west-facing port
  from above and put its arrowhead across the corner. A leg whose two ends face
  the same axis turns twice now.

- **The innermost hit wins, so a labeled box could not be dragged at all** —
  the press grabbed the label and pulled it out of the box. `pickable: false`
  on content a container owns is the fix, and every body a consumer builds
  needs it.

- **`bodyTrait` put a row port and the `w` compass port at the same point**, so
  a demo showed four ports where six were declared and looked correct. A row
  port on a side now takes that side's compass default with it.

- **`Scene.setPose` does not cascade to children.** Poses are absolute, so
  moving a container leaves its subtree where it was. `applyLayout` and
  `layoutPoses` translate the subtree themselves; `sceneToAdapter` has the same
  walk behind `cascadeContainerPose`, and it is not exported.

- **Idempotence and anchoring are different properties.** A layout that dumps
  everything at the origin is perfectly idempotent. Deleting the anchor left all
  20 layout tests green until one asserted the result's bounding box still
  starts where the graph's did.

- **A charge force treats a node as a point,** so two wide boxes a comfortable
  center-to-center distance apart still cover each other. `separateBoxes` works
  on the box and is deliberately not alpha-scaled.

- **Declaring `force` as `LayoutFn` hid `ForceOptions` from every caller.** It
  carries its own signature and a `satisfies LayoutFn` instead.

- **A registered layer's hit reports `layer:<RenderLayer.id>`**, not the
  region's `hitKind`, and the region's `initialScratch` arrives as
  `AffordanceHit.payload`.

- **An exclusive claim bars a whole gesture protocol.** `claimedKinds:
  ['pointer']` covers `pointerDown`, `click` and `drag`; binding only `drag`
  leaves the press with nowhere to go. `grabPortAction` absorbs the other two.

- **The deps bag is built once, at `start`.** Every later pump event carries
  `deps: {}`, so an action reading a dep in `onEnd` reads nothing and commits
  nothing, silently. Capture deps into the scratch.
