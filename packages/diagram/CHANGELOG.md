# @weasel-js/diagram

## 1.6.0

### Patch Changes

- Updated dependencies [16c0da2]
- Updated dependencies [b8ebef6]
- Updated dependencies [c373af4]
- Updated dependencies [bfe6a4f]
- Updated dependencies [6857b4d]
- Updated dependencies [bbaefca]
- Updated dependencies [0cf6a0d]
- Updated dependencies [811abcd]
- Updated dependencies [7c53d1a]
- Updated dependencies [5345efb]
- Updated dependencies [87fd8a8]
- Updated dependencies [6f14f6f]
- Updated dependencies [c1f82e2]
- Updated dependencies
- Updated dependencies [97561f1]
- Updated dependencies [89926b5]
- Updated dependencies [9f86dec]
- Updated dependencies [4074270]
- Updated dependencies [debfd5d]
- Updated dependencies [d975afa]
- Updated dependencies [62d8d7c]
  - @weasel-js/core@1.6.0
  - @weasel-js/geom@1.6.0

## 1.5.2

### Patch Changes

- 24a2dae: Close the places where two tiers spelled one concept differently.
  
  **A fixed pan bug.** `viewport.dragPan` fell back from `drag.screenDelta` to
  the world `drag.delta` and then divided by the zoom anyway, panning at
  1/scale² for any event source that supplies no `clientX`/`clientY` — which is
  every synthesized `InputEvent`, since those fields are optional. It now
  reconstructs the client delta exactly, by undoing each end of the world delta
  against the view that produced it.
  
  **Breaking, renames.** `ClickEvent`, `DoubleClickEvent` and `ContextMenuEvent`
  carry their world point as `x`/`y`, matching every other kind in `InputEvent`;
  `worldX`/`worldY` are gone, and a consumer who set `x`/`y` no longer silently
  lands at the origin. All three now also carry `clientX`/`clientY`, so a
  context-menu action can finally read `ctx.screen` — the case that surface was
  added for. The renderer's `Mat3` is `GlMat3`, freeing `Mat3` to mean geom's
  affine in a file that imports from both. `translatePolygonInPlace` is
  gone: it was the one sanctioned writer into a committed path's coord buffer,
  documented as overlay-only, and nothing called it. `@weasel-js/font` exports `FontStyle`
  in place of `OutlineFontStyle`. `@weasel-js/labkit` no longer exports
  `useOrbit`, `OrbitView`, `Vec3` or their helpers: `@weasel-js/kernel3d` owns
  the orbit camera and `@weasel-js/geom/3d` owns `Vec3`. `ToolCtx.screenPoint`
  was declared and never written by anything; it is gone.
  
  **Breaking, types narrowed.** geom's `Mat3` and `Box` are readonly tuples,
  matching the reason `geom/3d` already gives for its own. `History.entries()`
  returns `readonly` arrays, which is what its docstring always asked callers to
  assume.
  
  **One type where there were two.** `@weasel-js/svg`'s `Matrix` is geom's
  `Mat3`, and its duplicate `multiply` is geom's; `SvgStroke.width` is
  `ScreenLength` rather than that union written out again. `kernel3d`'s
  `ViewportRect` is `ScreenBox` — one rectangle spelling instead of `w`/`h`
  beside `width`/`height` eight lines apart. The renderer's `View` is routing's.
  Core's `Vec2` is routing's `Point2`, and `Pt` is gone from the barrel.
  
  **Additions.** `oklchDegToHex` / `hexToOklchDeg` / `OklchDeg` in
  `@weasel-js/paint` — the degrees-and-hex form `@weasel-js/ui` and
  `@weasel-js/theme` had each built for themselves. `srgbFloatToOklab`, for
  callers holding 0..1 floats; feeding those to `srgbU8ToOklab` truncated where
  paint's own internal conversion rounds. `mat3.toAffine` / `mat3.fromAffine`
  name the repack between the GL layout and geom's.
  
  **Corrections.** `RECT_POSE_DESCRIPTOR` implements `getRotation`, so a pose it
  rotated no longer reports itself unrotated to `useResize` and to diagram's port
  placement. `ToolDef.capabilities` is documented as reaching
  `Tool.eligibility.capabilities`, which is where it actually goes — following
  the old text gave `undefined`, and `eligibleForMode` turns that into a tool
  that vanishes from every mode. `MultitouchEvent.centroid` is documented as
  canvas-local, which is what the dispatcher hands over. `drag.points` is a
  snapshot on `onEnd` rather than the dispatcher's live accumulator.
  
  `tsconfig.json` now typechecks `packages/routing`, `cursor`, `bidi` and
  `loupe`, which it had never included.
- 8ffd746: State the port-curve rule once, in `@weasel-js/geom`.
  
  A routed edge leaves a port along its normal and arrives at the next against
  that port's normal, with the controls reaching 0.4 of the straight-line
  distance. That rule lived inside `@weasel-js/diagram`'s `bezier` router with
  its reach constant module-private, so a 3D consumer had no way to share even
  the number.
  
  It is now `portControls` / `portCurvePoints` / `PORT_REACH`, exported from
  both `@weasel-js/geom` and `@weasel-js/geom/3d`. One implementation over loose
  components sits behind both, so the two dimensions cannot disagree: every
  operation in it is closed on the plane z = 0, and a planar problem answered
  through the 3D entry returns the same numbers, not an approximation. Each
  barrel wraps it in its own tier's currency — scalars for 2D, matching
  `cubicEvalAt`, and `Vec3` for 3D.
  
  `bezier` is unchanged in behavior; it calls through. `@weasel-js/diagram` now
  declares the `@weasel-js/geom` peer it had been importing without.
  
  Also moves `Vec2`'s declaration out of `core/geometry/polygonHitTestRect.ts`,
  a polygon-versus-rect hit-testing helper it had been an incidental local in,
  into `core/geometry/vec2.ts`. No API change — the barrel exports the same
  type from a place you would look for it.
- Updated dependencies [1c695cb]
- Updated dependencies [24a2dae]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
- Updated dependencies [ad6c351]
  - @weasel-js/core@1.5.2
  - @weasel-js/geom@1.5.2

## 1.5.1

### Patch Changes

- a80e8db: `@weasel-js/diagram/layout` and `@weasel-js/core/math` are new subpaths that a
  Node process can import: measuring a box from its rows, ranking a graph,
  relaxing one under forces, and finding where on a box's perimeter an edge
  should leave, with no React in the module graph. A server rendering a diagram
  needed all of that and could not have it — the diagram barrel reaches `live`
  (a hook) and `connect` (an interaction), and core's reaches the canvas.
  
  `layout` exports `measureBody`/`sizeToBody`, `layered`/`ranksOf`/`backEdges`,
  `force`, `tree`, `COMPASS` and the rest of `ports`, `outline` and `onOutline`.
  A caller with its own nodes and edges implements `Graph` — an interface, not a
  class — over what it already has, so `buildGraph`, which reads one out of a
  scene, is not needed and is not there. The routers stay behind: they live with
  the scene registry, and they are typed in `Vec2`, so a consumer routing in
  three dimensions cannot call them regardless.
  
  The seven modules behind it now import `@weasel-js/core/math` rather than the
  core barrel. Every symbol they took is in the subpath, so this narrows what
  they ask for rather than moving anything.
  
  `scripts/check-react-free.mjs` (`npm run check:react-free`) walks each entry's
  **built** closure, through sibling packages' `exports` maps, and fails on a
  React specifier. Sources cannot answer this question: `core/math` re-exports
  nineteen leaf modules that each import only numbers, and its first build still
  pulled a megabyte of canvas — one leaf reached core's own barrel, and
  `splitting: true` put the result in a chunk the entry imported.
- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [626bace]
- Updated dependencies [f4049be]
- Updated dependencies [432b143]
- Updated dependencies [4f9fd3b]
- Updated dependencies [91973a7]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
- Updated dependencies [2a63f31]
- Updated dependencies [66e0e10]
- Updated dependencies [8b79c20]
- Updated dependencies [b6a5eed]
- Updated dependencies [98ad39c]
- Updated dependencies [67f3867]
- Updated dependencies [f663199]
- Updated dependencies [a80e8db]
- Updated dependencies [a7519a1]
- Updated dependencies [187593e]
- Updated dependencies [08a3aec]
- Updated dependencies [d963d14]
- Updated dependencies [edb825a]
- Updated dependencies [229a16a]
- Updated dependencies [f9feecc]
- Updated dependencies [b981856]
- Updated dependencies [0662a2d]
- Updated dependencies [c0fa540]
- Updated dependencies [21ce23e]
- Updated dependencies [ff17dd7]
- Updated dependencies [f2b8d57]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/core@1.5.1

## 1.5.0

### Patch Changes

- 9190fc9: Follow-ups a 3D lab turned up while driving core's dispatcher over a WebGL
  viewport. Each one is a place the kit assumed its own 2D renderer.
  
  **`classifyTarget` and `affordanceAt` now take the world point their types
  promise.** Both were handed the raw client point at every dispatcher call site,
  so `<SceneCanvas>` and `<CanvasView>` each wrapped their thunk in the same
  `clientToWorld` they also passed the dispatcher, and a consumer hit-tested in
  one space while reading `ctx.world` in another. The conversion happens once now,
  where the event arrives. Behavior-identical for both kit consumers; a consumer
  passing no `clientToWorld` sees identity. **If you pass either option to
  `useGestureDispatcher` yourself and convert coordinates inside it, remove your
  conversion.**
  
  **`InvocationCtx.screen` carries a screen point, and is optional.** It was
  filled from the same field as `ctx.world`, so it had never been screen-space.
  It now comes from the event's client coordinates and is absent where the event
  carries none — a keystroke, a UI-driven trigger, a synthetic probe. A
  view-mutating drag still wants `drag.screenDelta`. A click's `ctx.world` is the
  click's own position rather than the origin.
  
  **`scene.history` publishes the `History` a `Scene` already owned.** The kit's
  `undo`/`redo` actions resolve a `history` dep and a consumer had nothing to give
  them, so `<SceneCanvas>` cast the Scene itself through `unknown`. It is a façade
  rather than the private engine: mutating members route through the scene's own
  wrappers, so an action-driven undo bumps the version and notifies subscribers.
  
  **`resolveOverlays` is the overlay half of the in-flight gesture channel.**
  `resolvePreviews` already answered for the ghosts a gesture displaces; this
  answers for the chrome it draws that is no node at all — a marquee rect, a lasso
  trail, an insert outline — in world geometry, with every degenerate case
  dropped. `insertPreviewExtent` is exported alongside it.
  
  **Every overlay variant is now geometry, and the layer owns the paint.**
  `OngoingOverlay`'s `'commands'` variant — arbitrary `DrawCommand[]`, which only
  core's own 2D renderer could execute — **is gone**, along with the `opaque` flag
  on the resolved form and the `action.commands` chrome id. Its two producers
  publish the new `'polyline'` variant instead: a run of world points plus a
  one-word `OverlayRole` (`'cut'` for `slice`, `'connector'` for
  `@weasel-js/diagram`'s `connect`) that a painter maps to a stroke, falling back
  to plain chrome for a role it does not know. `useDispatcherOverlayLayer` draws
  both exactly as they were drawn before, and
  `DispatcherOverlayStyle.roles` is where a consumer restyles one.
  **`ConnectActionOptions.stroke` is removed** — an action no longer names a
  paint; use `roles: { connector: … }` on the layer's style.
  **If you produced a `'commands'` overlay**, publish a `'polyline'` for a line,
  or paint it from a render layer of your own.
  
  **labkit stacks two surface buffers around the trial DOM.** The shared buffer
  sat over the trials, which is right for a mark annotating an instrument and
  wrong for an opaque renderer that buries its own pane. `useSurfaceCanvas('under')`
  asks for the lower buffer; the default is unchanged. **`SurfaceCanvasContext`
  now carries `{ over, under }` rather than one canvas** — a consumer providing it
  directly must update the value.
  
  **labkit labs get their own chrome regions.** Every region was per-trial, so a
  lab-level control had nowhere to go and `LabPalette` existed by casting a
  two-field object through `as unknown as TrialChromeContext`. `<Lab labChrome>`
  takes contributions shaped exactly like a trial's, against a real lab context.
  
  `docs/extending.md` now states the contract for mounting tools outside
  `<SceneCanvas>`, including the half that was written down wrong: capability
  eligibility resolves through `RuleCtx.allowedCapabilities` and `getRuleCtx`, not
  the `activeTool` dep.
- 6f5ff46: Pose geometry is supplied once. `<SceneCanvas poseDescriptor={…}>` tells every
  built-in action, the selection chrome, picking and area select how to read and
  rewrite this scene's poses; it defaults to `AUTO_POSE_DESCRIPTOR` (rect and
  `Path` poses). A pose of any other shape now works end to end — before, dragging
  one into a container wrote `NaN` into it.
  
  Breaking:
  
  - `PoseProjection` is renamed `PoseDescriptor`, and gains a required
    `fromBounds(bounds, template)` and an optional `withRotation(pose, rotation)`.
  - `ResizePose` and `AlignBounds` are removed; use `Bounds`.
  - `RotateGeometry`, `AlignBoundsProjection` and `RECT_ALIGN_PROJECTION` are
    removed.
  - Removed options, replaced by the descriptor: `selectTool.resize.geometry` and
    `useResizePolicy({ projection })` (use `<SceneCanvas poseDescriptor>`);
    `UseRotateOptions.geometry` and `UseMoveOptions.translatePose` (both were
    unread); `poseBounds` on `useSelectTool`, `arrayAdapter`, `sceneToAdapter`,
    `MinimapCanvas` and `nestedHitTester` (use their `poseDescriptor` option);
    `arrayAdapter`'s `intersectsRect` and `translatePose`; the selection overlay's
    `getBounds` and `fromBounds`; the alignment behaviors' `projection`.
  - `Canvas`'s `geometry` prop is renamed `poseDescriptor`. `SceneCanvas`'s own
    `geometry` prop — the `pickEvery` / `boundsOf` hit-test overrides — is a
    different prop and keeps its name.
  - `computeFitView`'s fourth argument is a `PoseDescriptor`, not a bounds
    function.
  - `sceneToAdapter`'s `cascadeContainerPose` is a boolean; the cascade translates
    through the descriptor.
  - The kit's built-in painters only draw rect poses. A node with any other pose
    needs its own painter.
  - `Scene` has a read-only `registry`. For a custom pose kind,
    `unionOfChildrenVia(descriptor)` builds the container-union function to
    register under `UNION_OF_CHILDREN`.
- Updated dependencies [9190fc9]
- Updated dependencies [a2feeb0]
- Updated dependencies [3ecc1be]
- Updated dependencies [dd48085]
- Updated dependencies [efaf707]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [2f1ddd0]
- Updated dependencies [ea285a2]
- Updated dependencies [c758b4d]
- Updated dependencies [a41a83a]
- Updated dependencies [794b4ff]
- Updated dependencies [b65f4df]
- Updated dependencies [90f0bd8]
- Updated dependencies [b5b8b69]
- Updated dependencies [b2f2d45]
- Updated dependencies [6f5ff46]
- Updated dependencies [edd5b39]
- Updated dependencies [2e2041b]
- Updated dependencies [65806bc]
- Updated dependencies [a614be4]
- Updated dependencies [ef60ff6]
- Updated dependencies [269d432]
- Updated dependencies [486f631]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0

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
