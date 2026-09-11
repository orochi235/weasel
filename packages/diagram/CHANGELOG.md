# @weasel-js/diagram

## 1.4.4

### Patch Changes

- fc00dae: Hand a derivation its dependencies' paths, and label an edge with one.
  
  `DerivedDep` is now `{ node, pose, path }`. The path resolves on first read and
  memoizes, so a route costs the same whether one node reads it or five, and a
  dependency nobody asks about costs nothing. `resolveDerivedPath` moves beside
  `derivedPose` in `core/scene` — a pose can now derive from a dependency's path —
  and picks up the cycle guard the pose side already had.
  
  `pointAlongPath(path, t)` is the new geometry primitive underneath: where a path
  is at a fraction of its length, and which way it heads there, measured along the
  flattened arc.
  
  In `@weasel-js/diagram`, an edge label is an ordinary leaf node with
  `dependsOn: [edge]` and `LABEL_DERIVE_POSE`. Its trait says where it sits —
  `at: 'start' | 'mid' | 'end'` or a fraction, plus an `offset` perpendicular to
  the route — and it reads the edge's resolved path rather than routing again, so
  a label and its arrowhead can never disagree about where the edge went.
- 60ba9d9: A stroke marker on a derived path is drawn.
  
  `markerStart` / `markerMid` / `markerEnd` reached the `kit:derived` painter
  intact and were then dropped: the painter emitted its stroke command and
  returned, where `kit:path` follows with a marker pass. So an arrowhead on a
  diagram edge — the whole reason markers and derived geometry landed in the same
  release — silently drew nothing. Its own `ink` had been reserving the hit-test
  reach for the marker all along, which is the shape of the bug: the pointer could
  already grab past the end of a line with no head on it.
  
  A connect-authored edge now carries `markerEnd: 'arrow'` by default. An edge
  runs *from* one node *to* another and a plain line does not say so;
  `DEFAULT_EDGE_STROKE` is exported for a consumer overriding `commit` who wants
  the rest of it.
- 6aff403: `buildBody` turns a `BodySpec` into the scene nodes that draw it.
  
  The container carrying the trait, and one leaf per row that wants drawing —
  placed by the same `layoutBody` walk the row ports anchor against, so a label
  and its ports cannot drift apart, and posed by `sizeToBody(at, measureBody())`,
  so the authored size is grown to clear the rows and never shrunk. A row's data
  is the consumer's, through one callback that is handed the row's text already
  formatted; returning `null` leaves that row undrawn, which is what a `ports` or
  `slot` row usually wants.
  
  Also fixed: a row port and a compass port could land on the same point, and one
  of them was then grabbable nowhere. `bodyTrait` anchors a `ports` row's entries
  at `u: 0` and `u: 1`, which for a row near the vertical middle put them exactly
  where `w` and `e` already were — the later region won the hit, and a node
  declaring six ports offered four. A row port on a side now takes that side's
  compass default with it: a body that says where its inputs attach has said what
  that side is for.
- edd6f53: Ports are grabbable, and dragging one onto another authors an edge.
  
  `diagramPorts` returns the two halves the gesture needs: a port affordance layer
  for `CanvasExtensionApi.registerLayer`, and a `Contribution` for `ambient`. They
  come back together because attaching one without the other fails quietly — the
  layer alone paints ports that start no gesture, and the contribution alone binds
  a hit nothing reports. `registerLayer` is the only attach route the kit
  hit-tests; a `Contribution.overlay` is painted and never hit.
  
  Connect is an ordinary drag binding gated on the port layer's affordance kind,
  not a mode and not a tool, so it starts from whatever tool is active. The
  preview is a real routed edge — the same router the committed edge will use,
  resolved by the same function, so it cannot promise something the release will
  not do. The commit is one `add`, which undoes in one step.
  
  Typed validity is `canConnect`, defaulting to "a port may not join itself, and
  two ports that both declare a `type` must declare the same one". An untyped port
  joins anything, so an untyped diagram stays fully connectable. It is applied
  where candidates are gathered rather than at the commit: an illegal port is
  never a candidate, so the edge will not snap to it and releasing over it does
  nothing.
  
  A port claims the whole `'pointer'` protocol so a port drag is never a move of
  the node underneath. That means `pointerDown` and `click` need bindings too —
  an exclusive claim bars every binding whose target does not consult the
  affordance, so a bundle that binds only `drag` leaves the press with nowhere to
  go and the dispatcher drops it, along with the drag it would have become.
  
  Also fixed: an edge's trait and a participant's trait live under the same
  `data.diagram` key, and the reader could not tell them apart. An edge read as a
  participant declares no ports, so it collected the four defaults on the
  degenerate pose an edge carries — four grabbable ports in the middle of nowhere.
  `from` and `to` are now what distinguishes the two.
- ed400a3: Edges. A `DiagramEdge` is an ordinary leaf scene node with
  `dependsOn: [from, to]` and a `derivePath` that runs a **router**, so it
  re-routes whenever either end moves and there is no parallel graph to keep in
  sync. Being a scene node is what buys it selection, hit-testing, hover,
  styling, z-order, SVG export, undo and copy/paste for free.
  
  Three routers ship: `straight`, `orthogonal` (leaves along each port's facing
  before turning) and `bezier` (leaves along one normal and arrives against the
  other, which is what makes an edge read as plugged into its port). Consumers
  register their own in the same shape. Author-dragged `waypoints` are data on
  the edge and the router routes *through* them — manual control authors
  constraints on the path, never the path itself, so a hand-tuned edge still
  follows a moved endpoint.
  
  An end that names no port resolves to the one **facing** the other end rather
  than the nearest: on a wide node the far-side port is often closer in a
  straight line, and an edge leaving through its own node reads as a bug however
  short it is.
  
  Ports are now cast from the node's bounds onto its outline. The bounds anchor
  is what makes a port survive a resize, but it is not where the ink is — a
  parallelogram's west anchor sits in the gap beside its leaning edge, and an
  edge ending there ends in empty space. `rayHit` casts the anchor back onto the
  flattened outline along the ray from the node's center, which is the direction
  an edge leaves anyway.
  
  `withDiagramRegistry` merges the edge router under a consumer's registry so an
  edge round-trips through `toJSON` without them wiring the key.
  
  Edge labels are not built yet: a label positioned along the route needs the
  routed path, which a derivation is not handed.
- 3d89141: Layout: `layered`, `tree` and `force`, and the action that runs one.
  
  A layout is a plain function of the graph — no scene, no ops, no history. It
  hands back the new top-left for every node that **moves**, and a node already
  standing where the layout wants it is absent from the answer, so re-running a
  layout on an arrangement it produced writes nothing and pushes no undo entry.
  
  Three rules keep a re-layout from scrambling a diagram someone has arranged.
  There is no RNG anywhere in the path, so the same graph always lays out the same
  way. Within-rank order is seeded from where the nodes already sit on the cross
  axis rather than from crossing-minimization, so two branches an author dragged
  into an order come back in it. And a node carrying `pinned: true` never moves,
  with the rest of the layout translated to sit around it — with no pin, the
  layout lands on the diagram's own bounding box rather than at the origin.
  
  `layered` ranks by longest path, breaking cycles with a depth-first walk in node
  order so a loop draws as an edge running back up the page. `tree` centers a
  parent over its children's block; a graph that is not a tree still lays out,
  since roots are the nodes nothing points at and anything the walk cannot reach
  becomes a root of its own. `force` is an iterative relaxation seeded from the
  current positions — **the one layout that is not idempotent**, since re-running
  it keeps relaxing.
  
  `buildGraph` reads the adjacency index from the same participant source the port
  affordance takes, per invocation rather than maintaining one. `createLayoutAction`
  rebuilds it on each press and writes the whole move as a single `scene.batch`,
  carrying a container's whole subtree — `setPose` does not cascade, and a built
  body would otherwise walk out from under its own label rows.
  
  In core, `createSimulation` is the velocity-Verlet integrator with no clock
  attached: `tick()` is the only thing that moves a node, so a pure function can
  run a whole relaxation and read the result. `useSimulation` is now that
  integrator on a frame loop and is otherwise unchanged. `SimulationCore` and
  `SimulationOptions` name the halves, and forces can be handed a seeded `random`
  in place of `Math.random`.
- 4a128c4: New package `@weasel-js/diagram` — the skeleton of weasel's node-link
  diagramming: flowcharts, pipelines, code-flow diagrams, simple visual
  programming. Arc 3 of the diagram design; edges, routing, the connect gesture
  and layout are still to come.
  
  **`DiagramNode` is a trait on an existing scene node, not a node type the
  package mints.** A text block, an image, a path, a group or a plain rect all
  become participants by carrying it, and nothing has to be authored through this
  package to take part. Two ways to attach it, both answered by the default
  reader: on the node's own `data.diagram`, or by kind — `createDiagramNodes`
  takes predicates over `data` the way `createNodeRouting` does, so a class of
  node takes part without being stamped one at a time.
  
  **Ports default to the perimeter, so a node needs to say nothing to be
  connectable.** `portsOf(node, pose)` resolves every port to a world point and
  an outward normal, reading bounds through the pose descriptor and carrying the
  node's rotation. Anchors are normalized against the bounds — `{ u, v }` from
  the top-left — so a port stays where it was put when the node is resized.
  
  **The body builder is optional**, for nodes that should look like a flowchart
  box: `rect`, `diamond`, `stadium` and `parallelogram` outlines plus a `Row[]`
  body of labels, fields, port rows and slots. Rows measure a floor, and the
  authored pose is maxed against it rather than set to it — adding a row can grow
  a node, nothing shrinks one back — which is what keeps resize, align,
  distribute, guides, snapping and undo free of a special case. Text measurement
  is a seam rather than an import; `canvasMeasure` adapts a 2D context.
  
  Rows lay out in the shape's **content box**, not its bounding box.
  `contentBox` reports the largest axis-aligned box inside an outline — a
  diamond's inscribed rect, a parallelogram minus its lean, the flat span between
  a stadium's ends — and `boxForContent` inverts it so the floor grows to suit.
  Without it a diamond's label is placed against the bounding box, lands outside
  the diamond, and the silhouette clip removes it: the label simply vanishes.
  
  `registerDiagramShape` paints a node whose trait names an outline, and reports
  the outline as its silhouette so picking and clipping follow the diamond rather
  than its box. Rows are not painted there — a built body's rows are ordinary
  scene nodes, so the kit's own text painter draws them and text editing,
  selection and styling work on them unchanged.
  
  Core exports `AUTO_POSE_DESCRIPTOR` and `isPathLike`, which were already
  general-purpose but reachable only from inside the package. A peer package
  computing a node's bounds needs the kit's own default descriptor rather than a
  second copy of it.
- b8d2940: Layout you can watch, and push against.
  
  `usePoseRun` is the transport: each frame it asks a producer for poses,
  publishes them to the scene's ephemeral override channel — the one a drag
  already writes to, which `effectivePose`, derived geometry and the pick source
  read — and commits the lot as one batch when the producer says it is done or
  the consumer stops it. Cancel drops the frames and the document is untouched.
  It runs behind `useVisibleRaf`, and it knows nothing about layout.
  
  A node carrying an override the run did not publish belongs to another gesture:
  the run never writes it, never commits it, and reports it to the producer as
  pinned. Dragging a box mid-run is therefore the consumer's ordinary move tool,
  with no gesture contributed by the diagram package.
  
  `useLiveLayout` in `@weasel-js/diagram` drives it. `force` relaxes one tick a
  frame off the same force list the one-shot `force` runs, holding a pinned node
  with `fx`/`fy` while its neighbors answer; `layered` and `tree` ease into a
  target computed once. A node or edge appearing or disappearing re-heats the run.
  
  `SceneNode.pickable: false` makes a node transparent to the hit-test walk, so a
  press lands on what is behind it. Without it the innermost hit wins and dragging
  a labeled box pulls the label out of the box.
- 2942544: Arrive along the receiving port in the `orthogonal` router. A leg whose two
  ends face the same axis now turns twice, at the midpoint of that axis, instead
  of dropping onto the port perpendicular to its facing — an edge between two
  boxes standing side by side landed on the west port from above, which put its
  arrowhead across the corner rather than into the shape.
- ca5b9f9: `layoutRowPorts` places a `ports` row's ports inside the row box, on the same
  terms `layoutBody` places one box per row. Both sides are cut into the same
  number of slots — the longer side's count — so the nth input faces the nth
  output; each port's label box is as wide as its own text and pinned to its own
  edge of the row.
  
  Two things follow. `RowPort.label` is drawn now rather than only measured:
  `buildBody` takes a `portLabel` callback and emits one text node per labeled
  port, the same way `row` emits one per row. And `bodyTrait` anchors each row
  port to its own slot instead of stacking every port on a side at the row's
  vertical center, where a second port was grabbable nowhere.
  
  `buildBody` also marks every leaf it emits `pickable: false`. The innermost hit
  wins, so a body whose rows answer a press is a body that cannot be dragged —
  which each consumer was otherwise left to discover and patch itself.
- Updated dependencies [9ce6f00]
- Updated dependencies [6f876a7]
- Updated dependencies [ed400a3]
- Updated dependencies [fc00dae]
- Updated dependencies [730da55]
- Updated dependencies [60ba9d9]
- Updated dependencies [5732951]
- Updated dependencies [2ff4824]
- Updated dependencies [3d89141]
- Updated dependencies [4a128c4]
- Updated dependencies [aee9d92]
- Updated dependencies [c067221]
- Updated dependencies [26d40bf]
- Updated dependencies [b8d2940]
- Updated dependencies [b5e2cd9]
- Updated dependencies [89276ee]
- Updated dependencies [36950d8]
- Updated dependencies [4f8c6b2]
- Updated dependencies [1240956]
  - @weasel-js/core@1.4.4
