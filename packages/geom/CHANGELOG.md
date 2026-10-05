# @weasel-js/geom

## 1.8.0

No changes in this release.

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

### Patch Changes

- f457e7c: `arrayAdapter`'s marquee and lasso now take a node by its outline, as `sceneToAdapter`'s do, instead of by its bounding box. A marquee over the empty corner of a triangle, or past the tip of a rotated rect, no longer selects it, and `enclosed` lasso mode takes a shape the lasso fits around even when its box pokes out. A polygon pose is its own outline; any other pose is its rect, rotated by `rotation`. The new `silhouette` option supplies what the painters draw — pass `findShapeSilhouette` when the items are scene nodes. The descriptor's `intersectsRect` is no longer consulted.
  
  `@weasel-js/geom` now holds path hit-testing: `pointInPath`, `strokeHitTest`, `pathContainsPoint`, `pathContainsRect`, `pathIntersectsRect`, `pathContainsPolygon`, `pathIntersectsPolygon`, `polygonContainsPath` and `polygonIntersectsPath`. Core's exports of the same names are unchanged.
- 3d80c9f: Text can become path geometry. `textToPath(data, pose)` returns a text node's
  glyph outlines and decoration rules in world space, as one `'nonzero'`
  compound path whose filled region is their union. Glyphs keep the font's
  curves, and each glyph is re-wound so faces that disagree on winding still
  fill their overlaps. It works at any size, not only above the outline-tier
  threshold, and applies synthetic italic the way the renderer does. When some
  run has no outline geometry it throws a `TextOutlinesError` whose `reason` is
  `'no-outlines'`, `'outlines-loading'`, `'outlines-failed'` or
  `'synthetic-bold'`. Faux bold is refused rather than drawn at the regular
  weight, because a path has no distance field to thicken.
  `loadTextOutlines(data)` waits for the faces a text is set in.
  
  The new `createOutlines` action (Shift+Mod+O, group `'text'`, under the
  `paths` feature) replaces each selected text node with a path node in one
  undoable batch. Each path takes its text node's slot in the stacking order.
  Consumers publish a `CreateOutlinesAdapter` with `useCreateOutlinesAdapter`;
  its `createPathNode(path, sourceId)` carries the text's fill and stroke. The
  pure core is `applyCreateOutlines`, and the icon is `CreateOutlinesIcon`.
  
  Boolean ops take text operands: `BooleansAdapter` gains an optional
  `getTextSource(id)`, consulted when `getWorldPath` has no path. This change is
  additive, with one exception: `BooleanOpResult` has a new
  `{ kind: 'failed', reason: 'text-outlines' }` variant, and a text operand
  without outlines now leaves the scene untouched. Code that switches
  exhaustively over `BooleanOpResult` needs a case for it.
  
  Also new: `loadFontOutlines(family, variant?)` in `@weasel-js/font` (also
  re-exported from core) resolves once a registered face has loaded or failed.
  `@weasel-js/geom` adds `pathSignedArea` and `reversePath`.
- b2fd89a: geom adds `boxContainsBox(outer, inner)`, the edge-inclusive test for one box
  wholly holding another. Core's region hit test, labkit's `fracEncloses`,
  `fracContains` and drop-over-canvas check, and labkit's internal point bounds now
  go through geom's box functions instead of their own copies. labkit's `WorldRect`
  is now an alias of geom's `Rect`, which has the same shape. Badge's
  `ChamferedRect` base uses the shared `polygonSampler` rather than a copy of it.
- 4212d2d: The path data model, the pure math over it, and the easing curves moved from `@weasel-js/core` into `@weasel-js/geom`. Core re-exports every name it exported before, so code importing from `@weasel-js/core` or `@weasel-js/core/math` needs no change.
  
  `@weasel-js/geom` now exports `Path`, `PolygonPath`, `RectPath` and `PathFillRule`; the builders (`PathBuilder`, `rectPath`, `ellipsePath`, `polygonFromPoints` and the rest); `pathFromD`, `boundsOfPath`, `unionBoundsPath`, `translatePath`, `scalePathToBounds`, `transformPath`, `composePath`, `decomposePath`, `splitSubpaths`, `pointAlongPath`, `pathDistanceToPoint`, `splitCubicAtT`, `fitCubicThroughDeletion`, `cubicPointAt`, `schneiderFit` and the `Point` type; and every easing curve with `EASINGS`, `SPRING_PRESETS`, `cubicBezierEasing` and `resolveEasing`. Three subpaths are new or grow: `@weasel-js/geom/curves` (Bezier, NURBS and Spiro representations, `CURVE_REPS`), `@weasel-js/geom/tessellate` (`tessellate`, `extractPolylines`, `trimPolyline`, the `Mesh` type), and `@weasel-js/geom/booleans`, which adds `splitPathBySegment`, `splitPathByPolyline` and `snipPathByPolyline`. `earcut` is a new optional peer of geom, needed only by `./tessellate`.
  
  Breaking for direct `@weasel-js/geom` users: `GeomPath` and `GeomPolygonPath` are gone, replaced by `Path` and `PolygonPath`. Hit-testing and booleans now take the typed-array `Path` — `commands` a `Uint8Array`, `coords` a `Float32Array`, `fillRule` required — rather than any array-like.
- 63d0ece: Picking and selection chrome now hold their screen-pixel sizes exactly under
  non-uniform zoom, rotated nodes included. Before, both divided by the mean of
  the two axis scales, so at 4:1 a 4px pick slop was 8px on one axis and 2px on
  the other, and on a turned node the selection outline, handles and rotate
  badge were drawn as a rotated screen rectangle beside the parallelogram the
  node actually painted.
  
  - `<SceneCanvas>` picks within `pickTolerancePx` of a node measured on screen.
    `strokeHitTest` takes a `slop: { px, transform }` for this, and
    `shapeCoversPoint`'s `tolerance` accepts `{ px, scale }` alongside a world
    number.
  - The selection outline traces the node's projected corners, handles sit on
    them, and the rotate badge sits its `distance` in pixels off the top edge,
    along that edge's normal as it lands on screen. `rotationHandle` takes the
    view's `scale` to do this and now also returns the badge's screen `angle`;
    `standoff` (exported) is the placement both it and the grab
    region use.
  - A painted rotate badge is grabbable where it is drawn:
    `createRotationAffordance` takes `handle: { distancePx, hitRadiusPx }`, and
    `<SceneCanvas>` / `<CanvasView>` turn it on when the selection overlay
    paints one. An affordance `point` region takes a `standoff` for chrome that
    floats a fixed distance off an edge.
  - The rotate ring's minimum band, and its paint inset, are measured on screen
    for a turned target (`pxExtent` and `annulusSemiAxes` take a rotation).
  - Grid lines stay 1px on screen on both axes.
  - Resize handles on a turned target are grabbable across the turned square
    they are painted as, not a screen-aligned one. A `point` region takes
    `turned: true` for this; `pointRegionFrame` is the one placement the
    hit-test, the region's square paint and the debug hitbox all read, and
    `screenAngleOf` the one angle the overlay turns its handles by.
  - The `debug.slops` overlay draws the regions the hit-test walks — the same
    affordance list, each region's square from `pointRegionFrame` — instead of
    recomputing corner and anchor positions, so it now shows a custom
    `selectTool.handleHitRadius`, turned handles, and anchors on every selected
    path the hit-test offers them on.
  - The hitbox debug overlay draws a world circle as the ellipse it lands as, a
    rotated rect turned, and the new `polygon` `HitShape` a point region now
    records.
- dde2315: The slice tool moves into the kit as `useSliceTool`, and cuts click by click. Clicks place the cut one point at a time, with a live preview trailing to the pointer; Enter or a double-click cuts, Escape discards, Backspace takes back the last point, and a click on the first point closes the cut into a loop and cuts. A drag still cuts straight, and an Alt-drag along its trail. The tool registers `sliceAction` itself, so a consumer passes it `tools={{ slice }}` and publishes a `slice` dep, and no longer needs `actions={{ slice: sliceAction }}`. Additive.
  
  `splitPathByPolyline` now cuts out the region a loop in the cut encloses, instead of dropping the loop: a loop inside the fill becomes its own piece, taking any hole it surrounds, and leaves a hole in the piece around it. A closed cut counts as a loop, or, where it crosses the boundary, is cut as the chords it makes. A cut with a loop in it now returns one more piece than it did.

## 1.7.0

### Patch Changes

- ad0378f: geom gains nearest-point queries and de Casteljau splitting. `nearestOnLine`, `nearestOnQuadratic` and `nearestOnCubic` return the nearest point to a probe with its `t` and distance; `nearestOnPath` does the same over a whole command stream, closing edges included, and says which command's segment it landed on. `splitLineAt`, `splitQuadraticAt` and `splitCubicAt` split a segment at `t` into two that trace it exactly, and `quadraticEvalAt` joins `cubicEvalAt`. Core's `pathDistanceToPoint`, `splitCubicAtT` and the anchor editor's nearest-segment search now run on these, so curve distances in picking are exact rather than read off a 16-sample polyline.
- da20f95: `forEachSegment` throws on a command code `PATH_COMMANDS` does not declare, instead of carrying on with the coord stream misaligned from that command onward. The visitor still sees the code first, so a caller's own error message wins.

## 1.6.1

No changes in this release.

## 1.6.0

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
- ad6c351: Give `Vec3` named fields, so both dimensions say `p.x`.
  
  `@weasel-js/geom`'s 2D tier has no point struct on purpose — it passes loose
  components so the f32-relative epsilon policy has nothing between it and the
  numbers — and `core` wraps those in `Vec2` at the API tier, where a call site
  reads better with names. `geom/3d` had to pack, since loose scalars stop
  working at four and sixteen components, but it packed into a tuple, and
  `@weasel-js/kernel3d` then re-exported that kernel type at its own public
  surface: `Pose3.position` and `Camera3d.target` were both `Vec3`.
  
  So at the position a consumer actually handles, 2D said `pose.x` and 3D said
  `pose3.position[0]`. Packing was forced; the tuple was not.
  
  `Vec3` is now `{ readonly x, readonly y, readonly z }`. The fields are readonly
  because the tuple's immutability was load-bearing: a pose in a history snapshot
  must not be writable through the value handed to a renderer. `Quat` stays a
  tuple — it is not a point, and `[x, y, z, w]` is the layout three.js and
  glMatrix both use.
  
  Breaking for anyone indexing a `Vec3`, which is why it is worth doing while the
  type is a week old.

## 1.5.1

## 1.5.0

### Patch Changes

- 7586835: `@weasel-js/geom` is now the single definition of the geometry both packages
  were carrying, and `@weasel-js/core` imports it.
  
  Two of core's command-stream walks had the pen wrong after a `Z`: `boundsOfPath`
  measured a following curve from the last point drawn rather than the subpath
  start, and `extractPolylines` flattened one from there. Both are fixed by
  `forEachSegment`, which now returns the pen where SVG says `Z` leaves it, and
  which also reports the command index and stops when its visitor returns `false`
  — the three things core's own walks needed. Ten walks, six Bernstein
  evaluations, an even-odd ray cast and four rect-corner literals now go through
  geom.
  
  `pathPoseDescriptor.remapBounds` scaled a zero-extent source axis by `0`, which
  collapsed a flat path onto the destination origin and left a transform that
  could not be inverted. It uses geom's `boxToBox`, which translates that axis, as
  `scalePathToBounds` already did.
  
  Moved into geom so core no longer keeps a second copy: bezier flattening
  (`flattenQuadratic` and both arc-length variants included) and `pathCrop`.
  geom's boolean adapter picks up core's ring nesting, which pre-tests bounding
  boxes and votes over three sample vertices where geom probed one — a hole
  sharing a vertex with its container was misclassified.
  
  `rectToContour` now emits the four corners with the closing edge implicit,
  matching what `pointInPolygon` documents and what every call site wants. The
  repeated first vertex it used to emit is a zero-length closing segment for
  anything that strokes the result.
- 2f1ddd0: `@weasel-js/kernel3d` is a new package: poses, an orbit camera, ray picking and screen-projected chrome geometry over core's scene graph and dispatcher. It hosts a renderer rather than owning one — a consumer brings its own and the kernel hands it poses — and it takes core as a peer, the same tier `svg`, `diagram` and `loupe` sit in.
  
  Core took no diff for it. `Scene` is generic over its pose and holds a `Pose3` with no adapter; a 3D host passes the dispatcher an identity `clientToWorld` so `ctx.world` stays two numbers and each dep rebuilds the ray from the camera it closes over; tools transfer untouched. The two things that do not transfer are stated rather than guessed: `ViewApi` has no orientation, so the kernel declares a `camera3d` dep of its own, and `PoseDescriptor.remapBounds`/`fromBounds` throw, because a screen rectangle does not name a 3D pose without a depth.
  
  `@weasel-js/geom` gains a `./3d` subpath — vectors, quaternions, 4x4 matrices, ray/AABB and ray/plane intersection, and `transformAabb`. Dependency-free like the rest of the package, and immutable tuples rather than classes, so a pose survives `structuredClone` with its methods intact because it never had any.
  
  Two corrections to code promoted out of the 3D lab. `projectAabbToScreen` now clips each of the box's twelve edges against the near plane instead of dropping the corners behind it; the old behaviour reported a box too small for anything straddling the near plane, and reported almost nothing for a solid the camera sits inside. And the seam that says how big a node is now asks for its world box rather than a local one to transform: a sphere's box is the same under every rotation, and no transform of a local box reproduces that.
  
  `sceneFromJSON`'s `options` argument is now optional. Every field in it already was, so the natural one-argument call did not compile.
  
  Also new: a test that a quaternion pose survives `toJSON` and `sceneFromJSON` with its rotation intact. The claim that `Scene` is dimension-neutral had only ever been run against `setPose` and undo.
- aa45d32: `@weasel-js/geom/3d` now judges singularity the way the 2D kernel does: against the matrix's own scale, never against an absolute floor.
  
  - `invert` on a 4x4 compares the determinant with the product of the four column lengths. A uniformly tiny matrix, such as a scale of `1e-4`, now inverts; so does a projection with a very small near plane. A large matrix whose determinant is only rounding now returns `null`, and so does a matrix holding `NaN`, which used to come back as a matrix of `NaN`s.
  - `normalize` keeps the direction of any vector with a finite, non-zero length. It used to return the zero vector below a length of `1e-9`, which collapsed `lookAt` for a camera less than `1e-9` from its target.
  - `lookAt` returns a singular matrix when `up` is parallel to the view to within rounding, as it already did when exactly parallel.
  - `transformPoint` always divides by w. It used to skip the division below `|w| < 1e-9`, so a camera with a far plane beyond about `1e9` cast rays in the wrong direction.
  - `intersectRayAabb` and `intersectRayPlane` accept a direction of any length. A ray counts as parallel to a plane only to within rounding of its own length.
  - `EPS3` is removed. Nothing in the subpath uses an absolute tolerance any more. This is a breaking change for anything that imported it.
  
  In `@weasel-js/kernel3d`, `rayThroughScreenPoint` now returns `null` when the view-projection has no inverse or the pane has no area. It used to return a made-up ray from the eye straight down -z. This is a type-level breaking change. The built-in deps handle `null`: `createNodeAtPoint` picks nothing, `createInsert` inserts nothing, and the pose descriptor's `translate` keeps dragging through the last camera that did cast a ray. `projectAabbToScreen` no longer drops points closer to the eye than `1e-9`, so a scene at a tiny scale projects the same as it does at unit scale.

## 1.4.4

## 1.4.3

## 1.4.2

## 1.4.1

## 1.4.0

### Patch Changes

- a7fa697: Add an anchored-placement solver and keep HUD windows on their host.
  
  `@weasel-js/geom` gains `placeRect` and `clampRectWithin`. `placeRect` resolves an
  overlay against an anchor: it picks a side, flips to the opposite one when the
  preferred side has no room, and slides along the alignment axis to stay inside a
  boundary. `clampRectWithin` is the containment half on its own — move a rect the
  shortest distance that puts it inside a boundary, keeping its size. Both are pure
  and take an explicit boundary rect, so a boundary that does not start at the
  origin resolves correctly.
  
  A HUD window could previously be dragged fully off its host with no way to
  recover it: `createWindow` clamped size but never position. Move drags and
  `setBounds` now keep the window on the host. Resize drags are deliberately left
  alone, so pulling an edge past the host does not fight the gesture.
  
  `@weasel-js/core` gains `hostAnchorRect`, `hostAnchorCss` and `useHostAnchor`,
  which hold a fixed-position panel against a host element's corner and keep it
  inside the viewport. The corner is an alignment per axis rather than a fixed
  one, and `useHostAnchor` takes a function that resolves the host, so a host held
  in a ref and one found by selector work the same way.
  
  `hostAnchorCss` pins whichever edges the alignment names. That is not cosmetic:
  a panel whose width tracks its content holds the anchored edge still and grows
  away from it, so pinning the wrong edge makes the anchored corner drift on every
  content change.
  
  Four places were carrying their own copy of that anchor math and now share this
  one — `CursorCoordsHud`, `PickHud`, `ModalityHud`, and WeaselDraw's
  `DispatchTracePanel`, which anchors the opposite corner. None of the four
  clamped, so a panel could hang off the edge when the host was scrolled or the
  panel was tall.

## 1.3.0

### Patch Changes

- 2621cbf: polygon-clipping is an optional peer of the ./booleans subpath, not a dependency
  
  geom's description promises a "dependency-free core; polygon booleans in the
  ./booleans subpath", and `booleans/index.ts` says the split exists "so the core
  stays `deps: {}`". The subpath split delivered that for the *import* graph only:
  `polygon-clipping` sat in `dependencies`, so every consumer installed it and its
  own two transitive deps — roughly half a megabyte — whether or not they ever
  imported the subpath that uses it.
  
  It reaches consumers through `@weasel-js/text`, which needs one type from geom
  (`Rect`, in `measure/lineBoxes.ts`) and none of its runtime. Nothing on that
  path can bundle the clipper, so it was pure install weight.
  
  **Anyone importing `@weasel-js/geom/booleans` must now install
  `polygon-clipping` themselves.** It is declared as an optional peer, so npm no
  longer installs it automatically and the subpath is the only thing that breaks
  without it. `@weasel-js/core` declares its own copy and is unaffected.
- 3386d64: Path command opcodes derive from one table
  
  `M`/`L`/`C`/`Q`/`Z` and their coordinate counts were declared five times —
  once in core, once in `@weasel-js/geom`, and three more as `COORD_COUNT`
  literals in the path transform, pose-rotation and pose-descriptor walkers. They
  agreed, and nothing held them to each other: a sixth opcode desynchronizes two
  packages' reading of the same `Uint8Array` with no exception and no type error,
  and every walker misparses the coordinate stream from that command on.
  
  `PATH_COMMANDS` in `@weasel-js/geom` is now the table. `PATH_M`…`PATH_Z`,
  `PATH_CMD_LENGTHS` and the new `pathCommandCoordCount` all derive from it, and
  core re-exports them by name, so the opcode constants keep their names, values
  and literal types. The three walkers moved onto `forEachSegment` rather than
  onto the accessor alone — they were duplicating the coordinate-cursor advance
  as well as the length, and the cursor is the half that actually misreads.
  
  Eight further files switch on these opcodes with inline literals. Five throw on
  an unknown code; three — the path boolean adapter, the anchor-editing geometry,
  and geom's own boolean adapter — have no `default` arm and would silently stop
  advancing. Left as-is; they need per-command semantics, not one walker.
- 84db1f6: Close four gaps that produced wrong answers with no error
  
  Three path walkers — `pathToMultiPolygon` in core and in `@weasel-js/geom`, and
  `enumerateAnchors` behind the bezier-edit overlay — handled M/L/C/Q/Z with no
  `default:` arm, so a command code they did not know fell out of the switch
  without advancing the coordinate cursor and every segment after it read the
  wrong floats. They now throw, matching the six sibling walkers. This is a
  behavior change for anyone feeding these a path built with an opcode outside
  `PATH_COMMANDS`: what used to come back subtly wrong now raises.
  
  A `<CanvasView>` built its affordance hit-test without a device profile, so a
  nested view resolved fine-pointer radii even under a coarse pointer — 8px grab
  zones against the 14px chrome the surface paints. It reads the profile
  `<SceneCanvas>` publishes.
  
  `moveGestureAdapter`'s `insertNode` took no `index`, and the adapter carried
  neither `getChildren` nor `setChildOrder`, so the sibling slot a delete op
  records had nowhere to land: undoing a delete through the move pipeline
  appended the node to the end of its parent instead of putting it back where it
  was. All three are there now.
  
  The dev inspector's gesture panel formatted bindings with a private formatter
  that reported only modifiers set to `true`. The `ingest` action marks every
  modifier `'optional'`, so its drop and paste bindings rendered blank and the
  action was invisible on both gestures. Both of the panel's plain-text
  formatters now go through the kit's `routesForSpec`.

## 1.2.0

## 1.1.0

## 1.0.4

### Patch Changes

- bd42540: Fixes seven correctness faults found by review of the pure-logic packages.

  **geom.** `pathToMultiPolygon` handed every ring to `polygon-clipping` as its
  own polygon, and the polygons of a MultiPolygon are unioned — so a path with
  holes arrived at the clipper solid, and the path's `fillRule` was never read at
  all. Rings are now grouped into outer + hole polygons by containment, under
  either fill rule. `flattenCubic` could not terminate on a non-finite control
  point or a non-positive tolerance; it now treats a non-finite deviation as flat
  and caps subdivision at 16 levels, which is far beyond what any terminating
  call reaches, so flattened geometry is unchanged. `approxEq` called every
  finite number equal to an infinity while calling two identical infinities
  unequal. `invert` judged the determinant against an absolute epsilon, rejecting
  a well-conditioned uniform 1e-7 scale while accepting a large matrix whose
  determinant is pure cancellation; the test is now relative to the squared
  column norms, and a non-finite matrix returns null instead of NaNs.

  **history.** Coalescing merged into whatever entry the undo stack left on top,
  so an edit made after an undo could rewrite an older entry in place — leaving
  one entry, still under the older label, that a single undo stepped past. A
  merge target is now the entry the last push created and nothing else.
  `resumeJournal` ignored which journal was active, letting two journals write to
  the same adapter with independent inner histories; it now refuses while another
  is active.

  **gestures.** `parseRoute` fills an omitted arg slot with the `'*'` wildcard for
  gestures whose descriptor declares no default. `formatRoute` re-emitted it
  (`[*:*] drop` came back as `[*:*] drop(*)`, so format ∘ parse was not
  idempotent) and `describeRoute` printed it literally ("the user drops \* content
  onto the canvas"). Both now treat it as the wildcard it is. `LongPressEvent` and
  `LongPressSpec` — the one arm of the public `InputEvent` / `GestureSpec` unions
  the barrel never named — are exported.

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

## 1.0.2

## 1.0.1

## 1.0.0

## 0.8.0

## 0.7.2

### Patch Changes

- 8bc719a: Every package now declares `engines.node: ">=22"`, up from `">=20"`. Node 20
  reached end of life on 2026-04-30, so the old floor advertised support for a
  runtime that no longer receives security patches — a claim in each published
  tarball that had quietly stopped being true. `@weasel-js/labkit` had no `engines`
  field at all and now matches its siblings.

  Nothing in the kit required a Node 20 feature, so this changes what is promised
  rather than what runs. CI tests both ends of the range: the 22 floor and the 24
  Active LTS the release and docs workflows build on.

## 0.7.1

## 0.7.0

## 0.6.0

## 0.5.1

## 0.5.0
