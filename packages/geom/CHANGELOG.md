# @weasel-js/geom

## 1.14.0

### Patch Changes

- e974dba: The curve-preserving booleans and pieces no longer flatten when outlines coincide. Two inputs that share a stretch of one line or curve (a shape and a copy of it, the same circle drawn from another start point, two faces of a divide united back together, a rect along a half disk's straight side) are cut where the shared stretch starts and ends, and the pieces along it become one edge both inputs own, so the result keeps its curves. `pathUnion(a, a)` gives back `a`'s own cubics.
- 30582cb: `pathUnion`, `pathIntersect`, `pathSubtract` and `pathExclude` keep curves. Where any input has a quadratic or cubic, the outlines are cut where they cross, each piece is kept or dropped by the winding on its two sides, and the result's curves are pieces of the inputs' curves: two circles united where they do not touch come back as their own cubics. This changes their output, which used to be straight segments only. Inputs of straight lines only, inputs over 4096 segments, and the cases the curve path declines (outlines that coincide or share a stretch, a cubic that crosses itself) still go through `polygon-clipping` and come back flattened. `pathDivide`, `pathCrop`, `pathTrim`, `pathMerge` and the face pieces still flatten.
- 2999820: `pathDivide`, `pathDividePieces`, `pathFacePieces`, `pathCrop`, `pathCropPieces`, `pathTrim` and `pathMerge` keep curves, as `pathUnion` and the other three booleans already did: each curve in a piece is a piece of an input curve, so a circle no other input touches comes back as its own cubics. This changes their output, which used to be straight segments only. They fall back to `polygon-clipping`, flattened, in the same cases the four booleans do. Signatures are unchanged.
- 6d5f7c2: `@weasel-js/geom/3d` adds `quatMultiply`, `quatConjugate` and `quatRotate`: composing two rotations, undoing one, and rotating a vector by one. Additive API.
- 14f8583: `@weasel-js/geom/nd` exports `createSettledCache()`: a value built only once its source holds still. Each `read(key, build)` passes the source's key as a tuple; the first read at a new key answers null, and the second at the same key builds and keeps the value (`reads` moves which read builds it, and `reads: 1` makes it a plain memo). Keys match element by element under `Object.is`. This adds API.
  
  Core's pick index, the diagram port and label indexes, and kernel3d's snap box index now use it, in place of three copies of that rule. They build at the same reads as before.
- 783756a: A scoped container's grid runs in the container's own frame: from its corner, along its axes, so
  it turns when the container does. `sceneGridRegions` gives each region its `frame` and, without an
  `outlineOf`, the outline the container draws; the grid layer draws a region's lattice in that
  frame, and `pointToGridCell`, `useGridCellHover` and `createCellHighlightLayer` count and draw a
  cell in it. `gridSnapSource` rounds in the same frame, read through the new
  `SnapCollect.frameOf`, which a scene session fills from `sceneBoxFrames`. This changes behavior
  for an unturned container too: its lattice now starts at its corner rather than at the grid's
  origin. A subject spread over two containers still snaps on the world lattice.
  `sceneGridRegions` now takes a `Scene`, and `GridRegionScene` is gone. geom adds `boxFrameOf` and
  `pxExtentInFrame`.
- e7fca17: `@weasel-js/geom` adds `joinPaths(parts)`, which joins polygon paths into one `'nonzero'` compound path measured from the first part's origin, re-measuring any part that has another. `textToPath`, `textToPathsByPaint` and `textClusters` join their glyphs through it, so text set far from 0 keeps an origin instead of dropping it, and a decoration rule there is measured from one too. A derived path made of several parts (a blend, a repeat) joins through it as well.
- a58fb4f: Every reader of a `PolygonPath`'s coords now reads them where its `origin` puts them: hit-testing and marquee/lasso picking, distance, anchors (`pathToAnchors`, anchor editing, corner expansion and restore), the booleans, `pathToD` and SVG export, cubic contours, puppet meshes, pose interpolation, derived parts, path warps, diagram connectors, and skinning. `translatePath` and `rotatePathAround` move the origin rather than the coords, and `anchorsToPath` given `like` writes back from its origin. This adds API: `worldCoords`, `pathPoint`, `originOf`, `addOrigin` and `coordsFrom` read and write coords in a path's own space.
  
  Paths far from 0 now get an origin where they are made: past `ORIGIN_THRESHOLD` (16,384), `anchorsToPath` without `like` (the pen tool), `pathFromD`, the booleans, and SVG import measure the path from `originFor`, the rounded center of its points. `PathBuilder.autoOrigin()` and `transformPath`'s `{ autoOrigin: true }` opt a producer in. A path near 0 is built as before.
- 8e6ed97: A `PolygonPath` can carry an `origin`, the point its `coords` are measured from, in doubles; a `Mesh` built from one carries it too. This adds API. Far from 0 a float32 coordinate loses its fraction (at x = 262,144 it sits on a 1/32 grid, 2 px at 64x); measured from an origin beside the shape it keeps it. `PathBuilder.setOrigin(x, y)` builds such a path from points given in the path's own space.
  
  The renderer draws one where its origin puts it, batched or by its own draw, filled, stroked, clipped, and culled. `tessellate`, `tessellateStroke`, `markerHeads`, `strokeToPath`, `transformPath` and `boundsOfPath` honor it, and so does a node's stroked bounds.
- 6b1b532: `findPathSnaps` and `findPathSnap` look up a probe's targets and segments in a bounding-volume tree built the first time an index is asked, instead of scanning every target and segment of every path on each probe. A snap over many paths now costs what the paths near the probe cost. The hits are the same, in the same order. An axis whose `scale` is 0 now reaches every target along it for the tangent, perpendicular and nearest kinds too, as it already did for the rest.
- 9ef7751: `warpPath` refits a warped path with fewer anchors. In the refit it shares with `simplifyPath`, each cubic now runs as far along the samples
  as one cubic can follow within the tolerance, and when the least-squares fit falls short, a search
  over its two handle lengths looks for one that holds. `warpPath` also samples more densely where
  the warp bends a segment. A puppet-warped bar pushed into an S refits with 11 anchors where it took
  22, and a pulled 24-segment star with 59 where it took 96. The refit costs about twice as long: the
  star's goes from 1.6 ms to 3.4 ms on an M-series Mac.
- 2e4943e: `trackRun` takes a `direction: 'ltr' | 'rtl'` option and reports it on the run. Under `'rtl'` the run starts at its right end on the side it stands on, `tangent` points the way it reads, and each item is still tipped upright as left-to-right reading would tip it. A curved `Bar`, segmented row, `RadioGroup`, `TabList` and `PageTabs` read their root's computed `direction`, so in a right-to-left locale item 1 sits at the right end as it does laid out straight, and the chevron past a scrolled run's end points out of the end it is at.
- 8e2c8c8: <!-- bump-approved: minor: maintainer — 1.14.0 release requested 2026-10-29 -->
  
  Three live path effects of one shape: Roughen, Zigzag, and Pucker & Bloat. geom adds the math as `roughenPath`, `zigzagPath`, and `puckerBloatPath`, each with its options type. Core adds `RoughenEffect`, `ZigzagEffect`, and `PuckerBloatEffect` to `PathEffect`: a path-effect node of one of these kinds has one source, `[shape]`, and paints it changed in its own fill and stroke. path-tools adds `roughenAction` (Alt+Shift+G), `zigzagAction` (Alt+Shift+Z), and `puckerBloatAction` (Alt+Shift+K) to `pathEffectsPreset`, each with a `path-tools:` glyph. Each makes one effect of every selected shape, just over it, and hides the shape while the effect shows it; Edit Path Effect, Expand to Paths, and Release work on them as on the others. This adds API.
- 0fc0e50: A thick stroke flattens its path so its edges, half a width out, stay within the flatten tolerance of the true ones,
  in place of capping every piece at 10° of turn. A bend whose edges sit far out still subdivides as finely as it
  needs; a wiggle smaller than the stroke no longer does, so a 4-wide stroke over 512 small curves flattens to 1,750
  points where it took 10,034. Breaking for callers of `extractPolylines`, `flattenCubicWithArcLen` and
  `flattenQuadraticWithArcLen`: the `maxTurn` option and argument are replaced by `offset`, the distance out from the
  path its outermost edge sits.
- dc6f83a: `tessellate` measures a rect reaching past `ORIGIN_THRESHOLD` (2^14) from an origin, as it already did for a polygon that carries one, so a rect drawn far from 0 keeps the fractions of its corners. The mesh's `origin` says where; a rect near 0 has none, as before.
- 97d889f: A `TrackRun` has `toShape(g)`, the fraction along its underlying shape that reading fraction `g` falls at. This adds a required member to the `TrackRun` interface, so an object built by hand to satisfy it needs one too. `Jog` reads left to right in a right-to-left locale as well, curved or straight, as playback controls do; its caption takes its own text's direction.
- 9adc0cd: `transformPath` now gives a polygon that lands past `ORIGIN_THRESHOLD` (2^14) with no origin one of its own by default, so resizing a path, `pathInWorld`, and an SVG element's own skew or scale baked in on import keep their fractions far from 0. A rect it promotes to a polygon under rotation is measured from an origin too. Pass `{ autoOrigin: false }` for the old float32-only result. A caller that read a far-out result's `coords` without its `origin` now has to read through `worldCoords`.
- 24e03ff: A puppet warp that folds solves faster, with the same result. Each round of the injective pass reads the
  Jacobians inline, solves both coordinates against the edge system in one pass over its factor, and finds
  the nearest flattening without allocating per triangle.
- b43c94c: A puppet warp that folds untangles in fewer rounds. The injective pass now steps along a limited-memory
  BFGS direction built over the same edge system, and stops after two settled rounds in a row instead of
  one. The squashed disc in the fold tests takes 17 rounds where it took 28, and the bar pushed into an S
  45 where it took 51, each ending at a lower untangling energy than before. Time per solve: the disc
  went from 5.0 ms to 4.1 ms; the bar from 6.2 ms to 6.7 ms, since each round costs more.
- dfdc8a6: A puppet warp that folds spends fewer rounds polishing once nothing is turned over. Past that point the
  injective pass scales each step to the curvature the last one saw, so a step now runs its full length
  where the line search used to halve nearly every one, and it stops once a round takes off less than 0.3%
  of the energy above a rigid motion, where it compared against the whole energy. The bar pushed into an S
  takes 34 rounds where it took 41; the squashed disc takes 19 where it took 18. Its result moves slightly,
  so a refit of the warped outline can land on a different number of anchors.
- e23101b: A puppet warp that folds untangles in fewer rounds when its bend is long. The injective pass shrinks its
  softening at least 20% a round while some triangle is turned over, and at least 5% once none is, where it
  shrank 10% throughout. The bar pushed into an S takes 41 rounds where it took 45; the squashed disc takes
  18 where it took 17. Its result moves slightly, so a refit of the warped outline can land on a different
  number of anchors.

## 1.13.0

### Patch Changes

- 7e5f9e3: A curved `Bar` scrolls smoothly. An item sliding off either end of its run now carries on along the curve, round the arc's circle rather than straight out along the end, and fades by how much of it is still on the run, instead of dimming to 40% and then vanishing. Wheel and focus moves glide to where they send the run over about 60 ms; a drag still follows the pointer, and a reader who prefers reduced motion gets every move at once. The chevrons that mark more past an end sit 10 px out past it, clear of the item fading there.
  
  `Along`'s `arc` can be given by where its middle faces and how far it reaches: `{ at: 0, span: '120deg' }`, or `{ at: 0, span: '180px' }`, which keeps the arc 180 px long however large its box grows. `spanDegrees` and the `ArcSpan`, `ArcEnds`, `ArcAround` and `AlongArcPlace` types are exported beside it.
  
  In geom, a track shape's `at(f, { open: true })` carries a station past 0 and 1 along the shape itself — a line and an open path straight on, an arc and an ellipse round themselves, a closed path round its contour — and `runStationAt` and `placeAlongRun` take `past: 'follow'` to lay places that way. `placeAlongRun`'s `past: 'hold'` now follows the shape with an item part past an end, where it used to carry it on straight, before holding it at the end once it is wholly past.
- c7516cd: `Jog` follows a curve. Inside an `Along`, or given a curved `shape`, its step and play buttons, readout and caption lie along the shape in reading order, each tipped to it, and the scrubber bends along the stretch of the run they leave between them, keeping at least 80 px. Without a scrubber the controls sit where the `Along`'s `align`, or Jog's own `align`, puts them. On a straight line it is the row it always was.
  
  In geom, `trackSlice(shape, from, to)` cuts a stretch of a track shape out as a shape of its own, running the same way: an arc stays an arc and an ellipse an ellipse, so `trackShapeD` still draws it with true arcs.
- 8c39126: Picks consult a BVH index kept beside the scene, so a marquee, a lasso or a click visits the nodes near the query instead of every node. `@weasel-js/geom` adds the tree. Three contracts tighten for the index to be sound. `NodeInk.outset` must not depend on the view scale: screen-space reach goes in `outsetPx`. In kernel3d, `world.bounds` must be a function of the node alone. Two picks change behavior: marquee and lasso now test a derived node at its derived path, and the point pick now tests a node carrying an override `path` against that path, which is what the renderer paints, instead of its pose box.
- 769eef8: `SwatchGrid` and `SwatchStrip` follow a curve. Inside an `Along`, or given a curved `shape`, each row of swatches lies on a ring of its own, every next row one row further in toward the curve's center, so a palette reads like a color wheel's rim. `SwatchStrip` puts the recent colors on the outer rings and the palette on the rings inside them, each section's heading — or the palette picker, when there is more than one palette — first on its section's first ring. Each arrow key moves to the swatch beside the focused one, along its ring or on the next ring in or out, that lies the arrow's way on screen, so Down goes down on a bottom arc as on a top one. A ring too long for its arc scrolls along itself, as a curved `Bar` does; where the curve bends too tight for another ring to keep its swatches apart, the rest of that palette's rows share its last ring. Outside a curve both render as before. Both take `shape` and `align` props, as `Bar` does.
  
  In geom, `shiftTrack(shape, shift)` is the track that lies a fixed distance along a shape's normal from it, addressed by its own length, or null where that distance passes a center of curvature and the track would fold; `bendSide(shape)` says which side of its normal a shape bends toward.
- 4c113da: Items along a curved `Bar` or `Slider` no longer read upside down at the ends of an arc across 3 or 9 o'clock. A run still picks its side from its middle. A bar item, stop label or readout whose spot would tip it past 90° turns a half turn about its own center there, keeping its place in the run and its side of the band. Ticks, thumbs and the chevrons that mark more past an end keep the run's direction.
  
  In geom, a `TrackPlace` carries `turned`, true where its up points down the screen: where an item that should read upright takes that half turn.

## 1.13.0-rc.0

### Patch Changes

- 7e5f9e3: A curved `Bar` scrolls smoothly. An item sliding off either end of its run now carries on along the curve, round the arc's circle rather than straight out along the end, and fades by how much of it is still on the run, instead of dimming to 40% and then vanishing. Wheel and focus moves glide to where they send the run over about 60 ms; a drag still follows the pointer, and a reader who prefers reduced motion gets every move at once. The chevrons that mark more past an end sit 10 px out past it, clear of the item fading there.
  
  `Along`'s `arc` can be given by where its middle faces and how far it reaches: `{ at: 0, span: '120deg' }`, or `{ at: 0, span: '180px' }`, which keeps the arc 180 px long however large its box grows. `spanDegrees` and the `ArcSpan`, `ArcEnds`, `ArcAround` and `AlongArcPlace` types are exported beside it.
  
  In geom, a track shape's `at(f, { open: true })` carries a station past 0 and 1 along the shape itself — a line and an open path straight on, an arc and an ellipse round themselves, a closed path round its contour — and `runStationAt` and `placeAlongRun` take `past: 'follow'` to lay places that way. `placeAlongRun`'s `past: 'hold'` now follows the shape with an item part past an end, where it used to carry it on straight, before holding it at the end once it is wholly past.
- c7516cd: `Jog` follows a curve. Inside an `Along`, or given a curved `shape`, its step and play buttons, readout and caption lie along the shape in reading order, each tipped to it, and the scrubber bends along the stretch of the run they leave between them, keeping at least 80 px. Without a scrubber the controls sit where the `Along`'s `align`, or Jog's own `align`, puts them. On a straight line it is the row it always was.
  
  In geom, `trackSlice(shape, from, to)` cuts a stretch of a track shape out as a shape of its own, running the same way: an arc stays an arc and an ellipse an ellipse, so `trackShapeD` still draws it with true arcs.
- 8c39126: Picks consult a BVH index kept beside the scene, so a marquee, a lasso or a click visits the nodes near the query instead of every node. `@weasel-js/geom` adds the tree. Three contracts tighten for the index to be sound. `NodeInk.outset` must not depend on the view scale: screen-space reach goes in `outsetPx`. In kernel3d, `world.bounds` must be a function of the node alone. Two picks change behavior: marquee and lasso now test a derived node at its derived path, and the point pick now tests a node carrying an override `path` against that path, which is what the renderer paints, instead of its pose box.
- 769eef8: `SwatchGrid` and `SwatchStrip` follow a curve. Inside an `Along`, or given a curved `shape`, each row of swatches lies on a ring of its own, every next row one row further in toward the curve's center, so a palette reads like a color wheel's rim. `SwatchStrip` puts the recent colors on the outer rings and the palette on the rings inside them, each section's heading — or the palette picker, when there is more than one palette — first on its section's first ring. Each arrow key moves to the swatch beside the focused one, along its ring or on the next ring in or out, that lies the arrow's way on screen, so Down goes down on a bottom arc as on a top one. A ring too long for its arc scrolls along itself, as a curved `Bar` does; where the curve bends too tight for another ring to keep its swatches apart, the rest of that palette's rows share its last ring. Outside a curve both render as before. Both take `shape` and `align` props, as `Bar` does.
  
  In geom, `shiftTrack(shape, shift)` is the track that lies a fixed distance along a shape's normal from it, addressed by its own length, or null where that distance passes a center of curvature and the track would fold; `bendSide(shape)` says which side of its normal a shape bends toward.
- 4c113da: Items along a curved `Bar` or `Slider` no longer read upside down at the ends of an arc across 3 or 9 o'clock. A run still picks its side from its middle. A bar item, stop label or readout whose spot would tip it past 90° turns a half turn about its own center there, keeping its place in the run and its side of the band. Ticks, thumbs and the chevrons that mark more past an end keep the run's direction.
  
  In geom, a `TrackPlace` carries `turned`, true where its up points down the screen: where an item that should read upright takes that half turn.

## 1.12.0

### Patch Changes

- dbd6711: Controls can run along a curve. `@weasel-js/geom` adds track shapes (`lineShape`, `arcShape`), reading runs over them
  (`trackRun`, whose `nearest` can leave the ends open) and their SVG path data (`trackShapeD`). `@weasel-js/ui` adds
  `Along`, which sizes an arc from its box and hands it to the controls inside; `Slider`, `DetentSlider` and `Bar`
  follow it, or a `shape` prop. `TrackCtx` gains a required `shape` field — the value span as a shape — so code that
  builds a `TrackCtx` itself no longer typechecks until it supplies one. `paintGradientTrack` paints straight tracks
  only. A menu opened under a button can ask to open above it (`placeMenuUnder`'s `above`, `MenuOpenRequest.above`).
- 13e597d: Text can follow a path. `@weasel-js/geom` adds a `'path'` track shape (`pathShape`), a `side` override on `trackRun`,
  and `placeAlongRun`, which turns item lengths into places along a run, in `RunOrder` `'reading'` or `'track'`.
  `TrackShape` gains a required `closed` member, so a shape implemented outside geom has to add it.
  `runPlaces` and `runLength` moved there from `@weasel-js/ui`, which re-exports `runPlaces` by name, so its curved rows
  come from geom's placement. `measurePath` takes `keepCorners`. `@weasel-js/text` adds `textClusters`, a line's
  grapheme clusters as outlines with their advances. `@weasel-js/core` adds the `textAlong` path effect; every effect
  takes `hideSources`, effect sources can carry a list of items, curved text is derived again when a font loads, a
  hidden source is edited through its effect, and Delete, Cut and Expand now remove an effect's hidden sources with
  it. A committed in-place text edit is labeled "Edit text" in history.
  `@weasel-js/path-tools` adds Text Along Path (Alt+Shift+X), Release and Set Path. `useTextEdit` in
  `@weasel-js/text-dom` gains `onDraft`.
  
  <!-- bump-approved: minor: maintainer — 1.12.0 release requested 2026-10-22 -->
- 94ebd35: Each lens body in `LensOverlay` carries a zoom slider along the bottom of its rim, stopping at every power of two from
  1× to 64×, the factors the `=` and `-` keys step through. Dragging it sets the factor as those keys do, resizing the
  reticle with it, and a whole drag is one undo entry; a press on it never moves or selects the body. It lies on an arc
  on a round body, on an ellipse on a stretched one, and runs straight on a square. A lens's readouts now sit at the top
  of its interior, clear of the zoom. `@weasel-js/geom` adds `ellipseShape`, an elliptical arc track addressed by
  fraction of its length, which `trackShapeD` draws as true elliptical arcs; with equal radii it is `arcShape`'s arc.
  `TrackShapeKind` gains `'ellipse'`, so an exhaustive switch over it no longer typechecks until it handles one.

## 1.11.1

### Patch Changes

- 4d99526: Constraint links now hold through whole-node transforms, preview through every path-edit drag, and have a gesture that makes them.
  
  - core: `PathEditExtension.finishTransform(ctx: PathTransformFinishCtx)` answers the other nodes a move, resize, rotate, flip, nudge or transform-again changes along with the ones it transforms — align and distribute too — committed in the same history entry; the `editAnchors` dep runs it as `transformOps(ops, label)`, and those actions now declare `editAnchors`. An extension may refuse a transform by answering null.
  - core: `pathEditPreview` finishes each frame itself through the new `finishPathEditFrame`, so bend segment and the path-tools drags preview the node's constraints and linked nodes as they will commit. Breaking: its `current` thunk now answers a `PathEditFrame` (`{ path, origins? }`) instead of a bare path.
  - geom: `PathsEditItem.yields` lets a path the edit left alone give way freely.
  - path-tools: the constraints extension carries linked nodes through whole-node transforms; `constraintLinkConflictsOf(scene, id)` reports the links tying a node that do not hold; `linkAnchorAction` (in `constraintsPreset`) links an anchor Alt-dragged onto another node's anchor (`coincident`) or segment (`onPath`), with `linkTargetAt` and `linkConstraint` beside it.
- 13fc67f: An edge label can be dragged along and beside its edge. `diagramLabelDrag({ scene, selected })`
  returns a layer and a contribution: a drag on a label (`diagram.moveLabel`) stores where it was
  dropped as a fraction along the route (`at`), an offset from the line (`offset`), and
  `dodge: false`, so label placement leaves it there and it keeps its spot when the edge reroutes. A
  click on a label selects its edge, and a double-click edits its text. Locked and hidden labels do
  not drag. With no `commit` the drag writes the scene in one undoable entry; `DiagramView` reports it
  through `onMoveLabel` instead. `diagram.resetLabel` (`RESET_LABEL_ACTION_ID`) puts the selected
  edges' dragged labels back to `LABEL_PLACEMENT`, which the main entry now exports.
  
  Geom adds `PathMeasure.nearest`, the arc length along a path nearest a point.
  
  All of it is additive. weaselchart adds label dragging and Format › Connector › Reset label.
- 50da815: The flat math decides "these two directions are one" the same way everywhere. `flatDim`,
  `closestOnFlat` and `intersectFlats` used to count two directions as distinct down to 1e-9 rad
  apart, while the solve behind `closestBetweenFlats` called them parallel below 1e-6 rad; the solve
  also judged a column against the longest one rather than its own length, so a short segment
  direction in a snap candidate's span could be dropped at a much wider angle. Both now treat
  directions under 1e-6 rad apart as one, measured against each direction's own length.
- 0f455dc: `trianglesToPath` unions a mesh by its outline instead of by its triangles. Edges that two
  triangles share in opposite directions cancel, and what is left is swept once under the nonzero
  rule, so the sweep no longer splits every interior edge at every other edge crossing it. A stroke
  whose ribbon overlaps itself all along — `strokeToPath` on 300 tall, narrow humps — used to make
  polygon-clipping give up ("Infinite loop when passing sweep line over endpoints"); it now
  outlines, and shorter ones of the same shape take about a third of the time they did.
- 15efc86: `trianglesToPath` joins a vertex lying on another triangle's edge into that edge before the union, so a mesh whose float32 vertices sit a hair off their neighbors' edges no longer leaves cracks. A stroke ribbon puts a join's pivot on its segments' ends, so `strokeToPath` and `offsetPath` answered hairline slivers beside every curve: `offsetPath` of a square with a round corner, grown by 10, gave six subpaths instead of one, and grown by the corner's radius it ran a spike into the interior. A 2,000-point zigzag stroked 6 wide, which made polygon-clipping throw ("Unable to find segment"), now outlines too.
- 07b686c: `puppetMap` is smooth across its mesh: points between the solved vertices are placed by a Clough–Tocher interpolant instead of each triangle's affine map, so a puppet-warped outline bends without the small corners it used to pick up where it crossed from one triangle to the next. Pins still land exactly where they are dragged, pins that have not moved leave the shape exactly where it is, and a point off the shape is carried on in a straight line from the outline. Every puppet-warped shape redraws slightly differently.
- 041bc38: `simplifyPath` and `warpPath` hold their refitted curves within the tolerance everywhere, not
  only at the points they sample from the original. A refit used to check only that those samples
  lay near the fitted cubic, and a straight segment is sampled at most eight times, so a cubic
  fitted across a turn and the start of a long flat could bulge between samples: 0.29 off at
  tolerance 0.1 on a rounded corner `offsetPath` grows. Each fitted cubic is now also checked
  against the run it replaces, and split where it strays.
- 2b267d5: Snap pipeline follow-ups.
  
  - kernel3d's `createSnap` takes `kitSettings` and reads its reach from `targets.snapPx` there, as a canvas does (`reachPx` still overrides it).
  - Two snap sources sharing an id now throw, on a canvas when a gesture begins and in kernel3d's `createSnap`, where before the later one silently replaced the earlier: a `<SceneCanvas snap>` source and a preset's alignment source were the likely pair, and the page box went with it. A source still replaces one of the canvas's defaults (`'rotation'`, `'path-snap'`) by taking its id. Core exports the check as `assertSnapSourceIds`.
  - The symmetry axis knob and a repeat's step handle turn through a `rotate` session on the `snap` dep: they now snap to quarter turns and other nodes' angles without Shift, Shift keeps the 15° steps, Ctrl suspends snapping, and the angle readout draws. Breaking: `handleChange` takes a `SymmetryHandleSnap` (`{ point, angle }`, new export) in place of its `stepped` flag and point function. Without a `snap` dep the handles do not snap, Shift included.
  - `resolveSnap` keeps every required candidate past `poolSize`, so Shift's steps can no longer be crowded out by 24 nearer targets, and drops a candidate with a non-finite locus direction instead of treating its line as a point.
  - A move begins its snap session once the drag passes its threshold, so a click on a selected body reads nothing for snapping, and its `geometry` probe is placed within the canvas's reach rather than a fixed 8px.
- 8f2c044: `resolveSnap` no longer lists a candidate in `members` when the other members already pin the same move — a line taken before a point on it now reports only the point. Such a candidate still appears in `satisfied`, and it no longer breaks a tie between two equally near combinations on its order.
- 71d4416: Synthetic-bold text reaches the outline tier. Past the outline threshold, a glyph faked bold from a
  lighter face used to stay on the distance field; it is now drawn as geometry, its outline grown by
  the distance the field's threshold shift moves the edge, so it is as heavy on either side of the
  threshold. A stroked synthetic-bold run, which stayed on the atlas unstroked, is now stroked. A
  grown glyph's `LaidOutOutlineGlyph.d` holds the grown outline, and its `key` names the growth.
  
  `@weasel-js/geom` gains `pathToD`, the inverse of `pathFromD`, also exported from `@weasel-js/core`.
  `@weasel-js/svg`'s `serializePathD` is now that function.
- cee04b9: A stroke on synthetic-bold text traces only the glyph's edge. The grown outline overlapped itself where grown parts met and looped at some inside corners, which a fill hides and a stroke drew as stray lines inside the glyph. New in geom: `mergeRegion`, which redraws a nonzero region as its outline alone, cutting contours where they cross and keeping only the pieces with fill on one side, curves kept as curves.
- e1eeb08: Speed up the crossing check every nonzero fill runs before triangulating: it reads the flattened
  coordinates without building an edge graph and sorts with a native numeric sort, which takes a
  64-curve fill from 0.21 ms back to 0.18 ms. The turn bound a thick stroke's flattening applies
  stops at the first control-polygon leg that exceeds it. Neither changes a mesh's vertices.

## 1.11.0

### Patch Changes

- 60d8e39: `@weasel-js/path-tools` adds three presets, each also in `pathTools`:
  
  - `anchorSelectionPreset` selects anchors along the path in path edit. `growAnchorSelection` (`]`) adds each selected anchor's neighbors in its subpath and `shrinkAnchorSelection` (`[`) drops the anchors at the ends of each selected run, wrapping round a closed subpath. `selectEveryNthAnchor` (Alt+N) selects every `params.n`th anchor counting from the first selected one; `selectCornerAnchors` (Alt+C), `selectSmoothAnchors` (Alt+M), and `invertAnchorSelection` (Alt+I) select by anchor kind and by complement. They are in the `ANCHOR_SELECTION_GROUP` group, change only the selection, and push no undo step.
  - `resamplePreset` brings `resamplePath`, an ongoing path command: it spreads each selected path's anchors evenly along it by arc length, to `params.count` anchors or at `params.spacing`, holds corner anchors fixed unless `params.keepCorners` is false, and refits the curves through the new anchors within `params.tolerance`, halving any piece that cannot follow the original that closely. It previews on `begin` and every update, and commits one undo step.
  - `addExtremesPreset` brings `addExtremeAnchors` (Alt+X), which splits curved segments at their x and y extremes without moving the shape: the segments whose two ends are selected, or the whole path while no anchor is. It is in the `anchors` group.
  
  `ActionParamSchema` types the params of `selectEveryNthAnchor` and `resamplePath`.
  
  Core exports `livePathEdit`, the builder behind `simplifyPath` and `offsetPath`, for a path command driven live by its params. A live path command now recomputes when any param changes, not only its main number, and reads params a tuning supplies as a thunk.
  
  `@weasel-js/geom` adds `resamplePath`, `addExtremaAnchors`, `segmentExtremaTs`, `cubicAxisExtremaTs`, and the selection walks `growAnchorSelection`, `shrinkAnchorSelection`, `everyNthAnchor`, `anchorsWhere`, `cornerAnchors`, `smoothAnchors`, and `invertAnchorSelection`.
- ed0e096: Path edit can show balance lines: one per curved segment, from the tip of its first handle to the tip of its second, with a grip at the middle. Dragging a grip (`balanceHandles`) scales both handles together, each along its own direction, so the segment fills out or flattens without either end turning; double-clicking it (`equalizeHandles`) gives the two handles the same proportion of the way to the corner their lines meet at. Under a `pathSymmetry` dep the grip drag carries every image of both handles with it, as an anchor or handle drag does. The grip drag keeps every handle's angle, and a length lock in force for handle drags, from `handleLock.length` or Mod, holds it still. The lines and grips show, and the grips hit-test as `balance:N` affordances, while chrome-caps shows the new `path-edit.balance` id (`PATH_BALANCE_CHROME_ID`), which is off by default. Their look comes from the `<SceneCanvas>` layer slot `layers.pathEditingOverlay`'s new `balance` option. Both actions are in the standard actions and the `paths` feature preset. Additive.
  
  `@weasel-js/routing` adds `isBalanceGrip`, and `isPathEditPart` now matches a balance grip too, so `move` turns a press on one down. `@weasel-js/geom` adds the geometry: `handleBalances`, `scaleSegmentHandles`, `balanceFactorToward`, and `equalizeSegmentHandles`.
- 5338358: Bridge: `bridgePaths` ("Bridge", Mod+Shift+J) joins the nearest open ends of two selected paths with a curve that leaves each end along the direction its path was heading, each new handle `params.tension` times the gap long (default `DEFAULT_BRIDGE_TENSION`, 0.4; `0` is the straight segment Join makes). The two paths become one, the first selected keeping its style, as one undo step; with one path selected, Bridge closes it. In path edit, `bridgeAnchors` ("Bridge anchors", Mod+Shift+J) does the same for the two selected end anchors. Both are in the standard actions and the `paths` feature preset, and their `tension` param types through `ActionParamSchema`, so `<SceneCanvas tune>` reaches it. Underneath, `joinSubpathEnds` and `joinAnchorsAt` in `@weasel-js/geom` take an optional `JoinOptions` with that `tension`. Additive.
- 6072e93: A path constraint conflict names every constraint it needs, not only the one left failing. Fixing both ends of an edge and then asking for it vertical reports all three, so the fix — drop either pin, or the new constraint — is on screen.
  
  `@weasel-js/geom` gains `conflictingConstraints(points, constraints, opts?)`: for each group of constraints sharing anchors that cannot all hold, a smallest subset that still cannot, found by dropping each member in turn and keeping it out when the rest still fail. Later constraints in the list are kept over earlier ones that conflict the same way, so the one just added stays in the set. A constraint that cannot apply at all is named on its own.
  
  In `@weasel-js/path-tools`, `constraintConflictsOf` and the overlay's conflict color cover the whole set, and `setConstraints` answers it — empty when every constraint holds, null when the dep cannot store — where it answered a boolean. This changes `setConstraints`' return type.
- 53ba41a: Path constraints can tie nodes together. A constraint link is a scene node: its `dependsOn` names the nodes it ties, and its `data.constraintLink` holds one path constraint whose anchors are numbered over theirs one after another. Being a node, it is saved and undone with the scene, and deleting a node it ties deletes it. Additive, except where noted below.
  
  `@weasel-js/geom` gains `constrainPathsEdit(items, links)`: an edit of several paths finished in one solve, each path's own constraints and each link renumbered through the edit, and the paths the edit left alone held unless nothing else can give way. `constrainPathEdit` is now its one-path case. A solve takes a frame per constraint (`axisAngles`), so paths drawn in different frames solve together. A dragged anchor held on a segment now starts from the nearest point on it and stays there while the rest give way, where before it slid by moving more freely than everything else, which let it drift off the pointer to satisfy unrelated constraints.
  
  In `@weasel-js/core`, a path-edit extension's `finishEdit` gets a fourth argument, a `PathEditFinishCtx` that reads other nodes, their paths and their dependents, and may answer `others`: nodes it changes along with the edited one, each with a new path, data, or `remove`. They are committed in the same history entry, and the anchor drag previews them. The `editAnchors` dep's `finishEdit` now answers `{ path, others }` where it answered the path. This changes its return type.
  
  In `@weasel-js/path-tools`, `constraintLinkNode` makes a link node and `constraintLinkOf` reads one. The constraints extension solves every node links reach from the edited one: an anchor held on another node's segment slides along it when dragged, and follows the segment when that node is edited. Link nodes draw nothing and take no clicks.
- 7162a7a: Corner shape: any corner anchor of a path takes a CSS `corner-shape`, and its radius can be changed later. Additive: `PolygonPath` gains `corners`, an optional `CornerSpec` (`{ shape, radius }`) per flat anchor index, where `shape` is one of the six `corner-shape` keywords (`square`, `squircle`, `round`, `bevel`, `scoop`, `notch`) or a finite `superellipse()` parameter, and `radius` is how far along each edge the cut starts. Following CSS Borders 4, every keyword is a point on one parameter, k: `square` is ∞, `squircle` 2, `round` 1, `bevel` 0, `scoop` -1, `notch` -∞. `cornerShapePieces(k, frame)` draws a corner for any k as the quarter superellipse `|u|^n + |v|^n = 1`, `n = 2^|k|`, spanned from the corner's center for k > 0 and from the outer corner for k < 0, fitted with cubics within `CORNER_FIT_TOLERANCE` of the setback and exact at k = 0, ±1, and ±∞. The command stream keeps the bare anchors, and `resolveCorners` expands the specs into plain geometry, each cut clamped so that the two cuts on a segment never overlap; `resolveCornersWithSources` also answers which source anchor each expanded anchor came from, and `remapPerAnchor` carries a per-anchor array across, so the renderer draws `vertexColors` on a cornered path with every point of a cut in its corner's color. Every reader of a path's geometry calls it first: tessellation, `extractPolylines`, the hit tests, `boundsOfPath`, `pathDistanceToPoint`, the booleans, `offsetPath`, the renderer's path draw, and `serializePathD`, which `@weasel-js/svg` now exports. A spec rides on its anchor through `pathToAnchors` / `anchorsToPath` (`PenAnchor.corner`), so anchor inserts and deletes keep it in place, and `transformPath` scales radii with the geometry. Also new: `cornerFrames` and `cornerFrameAt` (where each corner anchor can be cut, and how far), `withCorner`, `cornerAt`, `cornerSpecAt`, `cornerShapeK`, `cornerKeywordOf`, `isCornerShape`, `nextCornerShape`, and `CORNER_KEYWORDS`.
  
  `@weasel-js/path-tools` adds `cornerShapePreset` (and `createCornerShapePreset(style)`), which edits corners in path edit. Each corner anchor shows a widget just inside it, a small tile cut in the corner's shape, drawn and pressed as `corner:N` (matched by routing's new `isCornerWidget`) while chrome-caps shows `path-edit.corners`, which is on by default. A drag on one (`editCornerAction`) sets the corner's radius live and commits one undo step; pressing the widget of a selected anchor sets every selected corner. `cycleCornerShapeAction`, in the `anchors` group, steps the selected corners through the keywords, and `setCornersAction` sets their shape or radius from its `shape` and `radius` params, typed for `<SceneCanvas tune>`. `CORNER_CONTROLS`, `cornerControlsState`, `cornerControlsParams`, and the `useCornerControls` hook are a prefs-form panel over the selected corners: the keywords, a curvature slider from -4 to 4, and the radius, mixed where the corners differ.
  
  A path-edit extension's part (`PathEditPart`) can carry its own `hitRadiusPx` and a `standoff`, a screen-pixel push along a world-space normal, so it keeps its distance from the path at any zoom.
  
  A `PathEditHost` can own the anchor selection too, through optional `selectedAnchors` and `setSelectedAnchors`, so an app seeds which anchors start selected and shows what is selected. Giving a sharp corner a shape, through `setCorners` or `cycleCornerShape`, also gives it a radius: the call's own, or a quarter of the room the corner has.
- 765cd31: Path edit can show a curvature comb: teeth standing out of each curved segment along its normal, each as long as the curvature where it stands, with a line through their tips. It draws from the same in-flight path as the anchors, so it follows anchor and handle drags. It shows while chrome-caps shows the new `path-edit.comb` id, which is off by default; `editingAnchors`, now exported, is the usual rule to turn it on with. Its scale, teeth per segment, and color come from the `<SceneCanvas>` layer slot `layers.pathEditingOverlay`, which also takes the overlay's `style`. A `null` or a layer of your own in that slot now replaces the overlay, as it does for `selectionOverlay`.
  
  `@weasel-js/geom` adds the geometry underneath: `cubicCurvatureAt`, `cubicDerivativeAt`, and `curvatureComb` over an anchor set. `combTeeth` stands a comb on any `CurvatureSource`, a curve read as point, tangent, and curvature over t; `cubicCurvatureSource` makes one from a cubic, and `curvatureSourceOf` in `@weasel-js/geom/curves` makes one from any curve representation. The cubic and Spiro representations' `curvatureAt` now read `cubicCurvatureAt`.
- 8374354: `pathFacePieces` and `pathDividePieces` trace the arrangement of the paths' outlines once instead of clipping one region per subset of the paths, so the Shape builder stays quick with a dozen or more paths selected: sixteen overlapping circles cut into 241 faces in about 20 ms, where eight took two seconds before. The faces are the same. A region's parts now come left to right rather than in the order the clipper gave them, and `pathDividePieces` no longer warns against more than about eight inputs.
- 5adbb76: The `harmonizeAnchors` action makes smooth anchors curvature-continuous by changing only their handle lengths, along the directions the handles already have, keeping the product of each anchor's two lengths: the selected anchors, or every smooth anchor of the path while none is selected. Corners, open ends, and anchors the curve inflects through are left alone. It is labeled "Harmonize curvature", has no key of its own, and is in the standard actions, the `paths` preset, and the `anchors` group beside `retractHandles` and `makeHandlesSymmetric`, with the icon `core:harmonize`.
  
  `@weasel-js/geom` adds the edit underneath: `harmonizeAnchors(set, flatIndexes?)`.
- ebb8804: Booleans, Trim segment, Cut at crossings, and Offset path keep corner specs. Each works on what a path draws, its corners cut and spanned, and then folds every corner it left whole back into its anchor and spec, so the corner stays editable as a corner; a corner the operation cut into or moved stays as plain geometry. `keepCorners` and `restoreCorners` are the shared step, `cornerTraces` and `cornerCuts` say what each corner draws.
  
  Booleans used to ignore corner specs entirely and work on the sharp anchors. They now work on the rounded shape.
  
  Offset path keeps a corner where its offset is the same corner again, moved to where the offset edges meet and resized about the same center (`offsetCornerTraces`): a round corner at a right angle grows its radius by the distance. A corner whose offset is no longer its shape stays as plain geometry. At distance zero every corner is kept.
  
  `simplifyPath` no longer throws on a subpath with two coincident anchors.
- fb75358: Lengthen: in path edit, turn on the Lengthen path-edit tool and drag an open path's end anchor outward to grow the path from that end, or inward to shorten it along itself. It grows straight along the end tangent, or along a circular arc with the curvature the end has, meeting the path smoothly. The `lengthenPath` action's `mode` param (`'tangent'` or `'curvature'`, typed for `<SceneCanvas tune>`) sets which a plain drag does, and Shift, read on every move, picks the other. A straight end segment grows in place; a curved one is continued with a new segment, one per quarter turn of arc. Each drag is one undo step, "Lengthen path" or "Shorten path". `lengthenPreset` in `@weasel-js/path-tools` registers the action and its toggle, `pathEditTool.lengthen` (`lengthenToolAction`, drawn with `path-tools:lengthen`); `pathTools` includes it.
  
  `lengthenPathEnd(set, end, distance, mode)` (`@weasel-js/geom`) is the edit underneath, with a negative `distance` shortening. `openEndAt` names the open end an anchor is, `pathEndFrame` gives an end's point, outward tangent, and signed curvature, `lengthToward` turns a pointer position into a distance, and `pathEndAnchorIndex` finds the end anchor again after an edit. `lengthenOpenEnd`, which Extend to next path uses, is now `lengthenPathEnd` in tangent mode, so both tools grow a curved end by the same rule.
  
  While a path-edit tool is on, path edit's anchors and handles no longer show their own hover cursor, so the tool's action shows its own.
- 7cbedd8: `tessellate` fills a nonzero path whose outlines cross. A self-crossing outline used to go straight to earcut, which assumes it does not cross, so a figure eight lost the lobe wound the other way; outlines crossing each other lost regions or covered the overlap twice, which doubled a translucent fill. Such a path is now cut at its crossings and rebuilt as the boundary of what it fills before triangulating. Paths whose outlines do not cross triangulate as before.
- c17c978: `tessellate` covers a nonzero path once where its outlines nest without crossing. A ring inside another ring wound the same way was triangulated as a second shape, so the region they share was covered twice and a translucent fill drew darker there. An opposite-wound ring inside a hole, which nonzero fills, was left empty, and a counter listed before the outline around it was filled. Rings are now grouped by the winding inside each one, and a path that winds twice anywhere is rebuilt as the boundary of its fill before triangulating. Glyph outlines, whose counters wind opposite to the outline around them, triangulate as before and at the same cost.
- a4c99c1: An `onPath` path constraint holds an anchor on a segment of its own path, `{ kind: 'onPath', anchor, segment: [a, b] }`, anywhere along it. Additive.
  
  Each one gives the solve a parameter of its own, the place along the segment, started at the point nearest the anchor and kept between the segment's ends. A dragged anchor held on a segment slides along it rather than pulling the segment after it, and stops at its ends. An edit that splits or breaks the segment drops the constraint, as one that deletes a named anchor does. `segmentBetween(path, a, b)` answers the segment joining two anchors, in the order the path runs it.
  
  In `@weasel-js/path-tools`, `constrainAnchors` with kind `onPath` reads three selected anchors: the first held on the segment the other two end. The overlay marks it with a dot on a line.
- c53b0ae: `openPathEnds`, `openEndRay`, `extendToMeet` and `lengthenOpenEnd` now number an
  `OpenPathEnd`'s subpath the way the path's anchor set does, a bare `M` included,
  as `lengthenPathEnd` and `openEndAt` already did. On a path holding an empty
  subpath, Extend to next path used to extend a different end from the one picked.
- c4840ed: Geometric constraints on a path's anchors that hold while it is edited. Additive throughout.
  
  `@weasel-js/geom` gains `PathConstraint` — fixed, horizontal, vertical, parallel, perpendicular, equal length, length, and coincident, each naming anchors by flat index — and a damped Gauss-Newton solver for them. `solveConstraints` moves points the least that makes a list hold, with held points giving way last and fixed ones put back where they were; `solvePathConstraints` does the same over a path's anchors, carrying each anchor's handles with it. `constrainPathEdit` finishes an edit of a constrained path: it renumbers the constraints through the edit's point origins, holds the anchors the edit moved, and leaves out of the solve, and reports, any constraint that already failed before the edit. `unsatisfiedConstraints` says which of a list do not hold.
  
  In `@weasel-js/core`, a node's `data.constraints` holds through every path edit: the `editAnchors` dep's `editOps` solves and renumbers them before storing the path, an edit they cannot survive commits nothing, and the anchor drag calls the dep's new `constrainEdit` each frame so the preview is what the commit stores. `setConstraints` on the dep replaces a node's list in one history entry, moving the path to satisfy it and answering which constraints conflict; a conflicting one is kept, left out of later solves, and drawn as a conflict. The path-edit overlay marks each constraint beside the geometry (`getConstraints` and two colors in `PathEditingOverlayStyle`). The `paths` feature registers `constrainAnchors` (params `{ kind, length? }`, read from the selected anchors in selection order) and `unconstrainAnchors` (params `{ kind? }`), with no default bindings. Clicking a constraint's mark selects it (`selectedConstraint` on the dep, kept by the path-edit state beside the anchor selection, which it excludes), and `deleteConstraint`, on Delete and Backspace, removes it. A solve that holds only by collapsing a named segment to a point is a conflict, not a solution. Resize, rotate and flip carry the list unchanged; `constraintConflictsOf(node)` names what a transform broke, such as a set length under a scale. The whole-path commands — Simplify, Offset, Trim segment, Extend to next path, Join, Bridge, and Snip — drop `data.constraints`, as they drop a skin, since they rebuild the anchors with nothing to renumber the list through.
- 616a4b2: Path edit's handle drags gain a length lock beside the angle lock. Mod (Cmd or Ctrl) held while dragging a control handle keeps its length and changes only its angle, as Shift keeps its angle and changes only its length; both together freeze it. The lock in force draws what it holds the handle to — the line, or the circle round the anchor — as a `polyline` overlay of the new `lock` role.
  
  Two toggle actions, `handleLock.angle` and `handleLock.length` (group `anchors`, no default binding, in the `paths` preset), hold a lock for every handle drag without a modifier. They set `handleLocks` on the `editAnchors` dep, which `EditAnchorsDep` gains with `setHandleLocks`, so a bar, the command palette, and `<SceneCanvas tune>` reach one value: `editAnchors`'s new `handleLock: 'angle' | 'length'` param (`EditAnchorsParams`) is where the locks start until a toggle is pressed.
  
  `@weasel-js/geom` adds `handleAtItsLength`, the length-holding counterpart of `handleAlongItsAngle`.
- 0677769: Path edit gains soft selection and handle snapping, each a preset in `@weasel-js/path-tools` that nothing turns on by default, `pathTools` included.
  
  - **Soft selection** (`createSoftSelectionPreset(() => ({ radiusPx, falloff, onRadius }))`, its options read as each anchor drag starts; null leaves the drag hard). Dragging anchors also moves the anchors near them, each by a weight falling from 1 to 0 over the radius, which is measured along the path in screen pixels. The falloff is `'smooth'`, `'linear'` or `'sharp'`. The reach is drawn as a band while the drag lasts, and the wheel scrubs the radius mid-drag, reporting each new value to `onRadius`. Under a `pathSymmetry` dep a soft drag moves no symmetric images.
  - **Handle snapping** (`handleSnapPreset`, or `createHandleSnapPreset({ stepDeg, reachDeg, opposite })`, or a thunk of them read on every move). A dragged control handle's angle snaps to multiples of the step (45° by default) and to the line through the anchor's other handle, within the reach (6° by default), keeping its length. The line it snapped to is drawn. A held angle lock wins over the snap; a held length lock keeps the length while the angle snaps.
  
  Both reach the drag through a new member of core's `PathEditExtension`: `drag(start)`, asked as an anchor or handle drag starts, returns the extension's share of it (`PathEditDrag`) — anchors that follow an anchor drag and the share of its delta each moves by (`weights`), where a dragged handle goes after the locks (`handle`), a claim on the wheel mid-drag (`wheel`), and overlays drawn while the drag lasts (`overlays`). `PathEditDragStart` and `PathEditHandleMove` describe what it reads.
  
  `@weasel-js/geom` adds the geometry: `measureAnchorPath`, `softSelectionWeights`, `softSelectionBand` and `softFalloff` for soft selection.
- 974682d: Three live path effects: a blend between two shapes, a shape bent along a path, and copies of a shape along a path. Each is one scene node whose `dependsOn` names its sources and whose path and pose both derive from them, so editing a source — moving it, or dragging its anchors — updates the effect, and it saves and loads under the registry key `kit:pathEffect`. A scene holds path effects when it registers them — `createScene({ registry: withPathEffectsRegistry() })` — since reading a source's outline needs the painters; without that the actions are disabled. `pathEffectNode(effect, sources, layer, PATH_EFFECT_DERIVATIONS)` makes one; `data.pathEffect` holds its settings. Dragging an effect drags its sources; resizing or turning it resizes or turns them, as `shapeSources` now reaches through any node whose pose derives from named dependencies, not only a container's children.
  
  The actions are in the standard set and the `paths` preset, in the `pathEffects` group (`PATH_EFFECTS_GROUP`): `blend` (Alt+Shift+B) over the first two selected shapes, `bendAlong` (Alt+Shift+W) and `repeatAlong` (Alt+Shift+R) laying the first selected shape along the second, `editPathEffect` changing an effect's settings as one coalescing undo step, and `expandPathEffect` (Alt+Shift+E, "Expand to Paths") replacing an effect with the ordinary paths it shows. `ActionParamSchema` types their params for `<SceneCanvas tune>`.
  
  A blend matches anchors contour to contour, splitting the shape with fewer at its longest segments until the counts agree, and picks the second shape's start point and direction to keep matched anchors closest; `startOffset` and `reverse` override that. Fill and stroke mix through OKLab, and a turned source turns its neighbors rather than squashing them.
  
  A `derivePath` can now paint in several parts, each in its own fill and stroke: return `pathFromParts(parts)`, and the `kit:derived` painter draws each part as itself while picking and bounds see one path.
  
  `@weasel-js/routing` adds `BROWSER_RESERVED_CHORDS` and `browserReservedChord(spec)`: the key chords a major browser or desktop takes before the page does. The new bindings stay clear of them.
  
  `@weasel-js/geom` adds the geometry: `prepareBlend` and `blendPaths`, `bendAlongPath` (refit to a tolerance, corners kept), `stationsAlongPath` and `repeatAlongPath`, `measurePath` (arc length measured once, with an optional smoothed heading, which `pointAlongPath` now uses), and `pathToCubicContours` / `cubicContoursToPath`. `@weasel-js/paint` adds `lerpPaint`, `lerpFill` and `lerpStroke`.
- 7afe8cd: Geometric snapping onto paths. `pathSnapSource()` offers the geometry of every node on a visible, non-annotation layer as snap targets: its drawn outline (`nodeOutline`) and, for a painter marked `snapsToBox` (text and images), its pose box and the box's center. The targets are anchors and corners, box centers, where two strokes cross, the tangent and perpendicular points from where the line being drawn starts, segment midpoints, curve extremes and quadrant points, and the nearest point on a stroke. `kinds` turns each kind on or off and `only` names the ones offered. An anchor drag also snaps to its own path's other anchors and segments, leaving out the segments it moves. The snapped point is drawn with a glyph and its kind's name (`pathSnapGlyph`, `PATH_SNAP_LABELS`).
  
  `@weasel-js/geom` adds `createPathSnapIndex`, `findPathSnap`, `findPathSnaps`, `PATH_SNAP_KINDS`, and `pathAwayFromAnchors`.
- 71c079d: Path structure edits on an `AnchorSet`: `setSubpathStart(set, flatIndex)` makes an anchor its subpath's first — a closed subpath turns to start there, an open one reverses when given its last anchor — and `reverseSubpaths(set, subs?)` runs subpaths the other way without changing their shape, a closed one keeping its start anchor. `flatIndexesAfterReverse` says where a selection's anchors went, `subpathsOfAnchors` which subpaths hold them, and `directionMarks(set)` gives a point and heading at the middle of every segment, for drawing which way a path runs. Anchors move whole, so anything an anchor carries beside its point and handles goes with it.
  
  Segments convert in place: `convertSegments(set, segs, to?)` turns lines into curves with handles at their thirds, drawing the same line, and curves into lines by dropping the two handles that shape them; with no `to` it flips the lot. `segmentsBetweenAnchors(set, flatIndexes)` names the segments whose two ends are selected, and `isSegmentStraight` reads one.
  
  Anchors as typed numbers: `readAnchorFields(set, flatIndexes)` answers the selected anchors' X and Y — `null` where they differ — and a lone anchor's handle X, Y, angle and length; `writeAnchorField(set, flatIndexes, field, entry)` sets a value on every anchor or offsets each by an amount (`{ to }` or `{ by }`).
  
  `remapAnchorValues(values, stride, before, after, origins)` carries an array kept per anchor, such as vertex colors, through an edit `editAnchorSetTracked` reported, and `anchorOriginsOf(before, after, origins)` says where each anchor came from, for arrays that need more than a blend. A `PointOrigin` on an anchor's own point now carries `reversed: true` when its subpath runs the other way through it after the edit, read from which way its neighbors followed it before.
  
  A typed handle moves as a drag to that spot would: on a smooth anchor the opposite handle mirrors it, turning with it and taking its length, and on a corner it stays put.
- dcca70c: Three warp tools bend the selected paths and keep the warp editable until it is expanded. `useDistortTool` drags the four corners of the selection's box on their own, mapped bilinearly (`mode: 'free'`) or projectively (`'perspective'`, which keeps straight lines straight). `useEnvelopeTool` drags the points of a mesh over the box (`rows`, `cols`), interpolated as a bicubic surface or as one Coons patch per cell (`mapping`). `usePuppetTool` pins a path where it is clicked and bends it when a pin is dragged, moving everything else as rigidly as the pins allow; Alt-click takes a pin out. Pass them through `<SceneCanvas tools>`; their keys are F, M, and B, and `keybinding` overrides or (with `null`) omits one. Their drag and pin actions read the same settings as params, so `<SceneCanvas tune>` can set them too, and the controls drawn over a path holding no warp yet are drawn from those tuned settings. `ActionsRegistry.paramsOf(id, given)` answers the params an invocation would start with, tunings included, and `<SceneCanvas>` publishes it as the `actionParams` dep.
  
  A warp is held on each path as `data.warp`, beside the geometry it made, and survives moving, resizing and rotating the node. Two new actions in the `paths` preset work on whatever warp the selection holds: `expandWarp` drops it, leaving plain geometry, and `configureWarp` remakes it with new settings. Editing the path's anchors, or any path command, also drops it. `withPathWarp` builds a node that opens already warped; `heldPathWarpOf` and `resolvePathWarp` read one back.
  
  `@weasel-js/geom` adds the maps underneath — `bilinearQuad`, `projectiveQuad`, `bicubicMesh`, `coonsMesh`, and `rigidPuppetMap` — and `warpPath(path, map, { tolerance })`, which carries any path through any point map and refits each segment as cubics within the tolerance, keeping every anchor. `PathWarp` describes a warp as data, with `applyPathWarp`, `warpControls` and `moveWarpControl` over it.
- 5f12888: A puppet warp bends through the shape rather than across the plane. The shape's fill is triangulated with its outline as triangle edges (`puppetMesh`) and deformed as-rigid-as-possible (`createArapSolver`), so two limbs that nearly touch no longer move together when a pin on one is dragged. Both linear systems are factored once per pin set; a drag frame only re-solves them.
  
  Breaking: the warp API moved out of the root `@weasel-js/geom` entry into a new `@weasel-js/geom/warp` entry, because a puppet needs the optional `earcut` peer to triangulate. `pathWarpMap` now takes the source path as its second argument, and `rigidPuppetMap` is gone; `puppetMap(source, pins)` replaces it.
- d18df3e: A hard puppet warp no longer folds the outline back on itself. The as-rigid-as-possible solve now
  runs five local/global rounds after its two linear steps, and when those leave any triangle turned
  over, an injective pass rights them with the pins held exactly, so `warpPath` no longer refits a
  backward stretch as a loop or a spike. Every puppet-warped shape redraws a little differently.
  
  `ArapSolver.solve` takes options: `iterations` caps the local/global rounds (0 gives the two linear
  steps alone), `injectiveIterations` caps the injective pass (0 skips it), and `trace` is called with
  every vertex's position after each stage. New exports: `ArapSolveOptions`, `ArapStep`, `ArapStage`,
  `ARAP_ROUNDS`, and `ARAP_INJECTIVE_ROUNDS`.
- 46c731d: `puppetSolve(source, pins, opts?)` in `@weasel-js/geom/warp` returns the mesh `puppetMap` deforms for a pin set and where its vertices land, solved with `createArapSolver`'s options: pass `trace` to see every stage of the solve, or the round caps to bound it. `puppetMap` places points by the same solve, so with the default options the two agree. It is additive.
- 36eca7a: Breaking: `useAnimator` moved to `@weasel-js/animator/react`; the root entry has no React. `@weasel-js/core/math` no longer reaches routing or animator in its types. geom exports `FramedBox`. New `@weasel-js/font/metrics` entry carries `parseBmFont`, the face-metric readers and `cssFamilyName` with no DOM in its types, and `@weasel-js/diagram/layout` measures through it, so neither it nor `@weasel-js/diagram-elk` needs a browser. `faceMetricsOf` takes any value with `entry` and `outlineFace`, a `ResolveResult` included.
- c1680fd: A rectangle stored as a rect `data.path` can be edited in path edit: it shows its four corners as anchors, and the first edit stores it as the equivalent polygon, in the same undo step as that edit. Entering and leaving path edit without editing leaves it a rect. The path commands that act on the selected paths, such as offset, now take a rectangle too. Additive: `asPolygonPath` (geom, re-exported by core) returns any `Path` as a command stream, a rect as its corners clockwise from its origin, the order `countPathAnchors` numbers them in, so per-anchor colors keep their corners; core's `hasEditablePath(node)` says whether path edit can show anchors for a node.
- 0430dcc: Every type a public signature names is now exported, so the API reference links it. Signatures that named a file-local point alias (`Pt`, `XY`, `Vec`) take geom's `Point`, and ones that named a local `AnyScene` or `AnyNode` say `Scene<unknown, string, unknown>` or the node type outright. Newly exported: core's `AnnotationFlag`, `AnchorEdit`, `JoinPlan`, `PathEditPreview`, `PathStorageKind`, and `ViewPoseAdapter`; diagram's `RoutedScene`; prefs' `UsePrefsStoreOptions`; symmetry's `SymmetryKindDef`; path-tools' `WarpToolOptions`; and ui's `SceneLayerListProps`.
- c2048de: `@weasel-js/path-tools` adds `useShapeBuilderTool` (Shift+M), which builds shapes from the faces two or more selected paths cut each other into. The face under the pointer is shown; a drag unites every face it passes through into one path standing in for the first face's source, so it wears that source's paint, and an Alt-drag deletes them instead, Alt being read live through the drag. A click takes a single face. Every face not taken becomes a path of its own, and each gesture is one undo step. With fewer than two paths selected, a drag marquee-selects. `mode: 'delete'` swaps the two, so a plain gesture deletes and Alt unites. It reads the `booleansAdapter` dep the Pathfinder actions use, and counts an unfilled stroke as the region it covers, as they do.
  
  Core's `<SceneCanvas>` now publishes a `booleansAdapter` of its own over its path leaves (`data.path` drawn through the pose's box), so the Pathfinder actions and the shape builder work on a canvas whose consumer publishes none. A result is minted from the source it stands in for, keeping its layer, parent, frame, and data. A consumer's `useBooleansAdapter` under the canvas still replaces it — for text operands, which this one does not read. `useBooleansAdapterSource` is the hook behind it.
  
  `planShapeBuilder(adapter, opts)` is the engine under it: the faces, `faceAt(x, y)`, and a `commit(picked, 'merge' | 'delete')` that writes the batch. `facesAlong(plan, run, step)` answers the faces a run of points passes through, in the order it enters them.
  
  Core's `createPathOverlay({ id })` holds paths that are not nodes and gives a world-space `RenderLayer` drawing them over the scene, for a tool's `overlay` or a canvas's `layers`. Each path names a role, styled by `PATH_OVERLAY_ROLES` (`'chrome'`, `'picked'`, `'remove'`) or the caller's own.
  
  `@weasel-js/geom` adds `pathFacePieces(...paths)`: `pathDividePieces` with a region that falls apart split into one piece per connected part.
- 9073669: Path edit has tools: a set of named tools, one active at a time, that each change what a plain drag in path edit does. With none on, a drag edits anchors as before. The `editAnchors` dep carries the active one as `tool` and switches it with `setTool(id | null)`; a `<SceneCanvas pathEdit>` host may own it by also giving `tool()` and `setTool(id)`, as it already owns the open path. A tool belongs to the open path, so leaving path edit puts it down. `pathEditToolAction(tool, label, icon)` makes a bar toggle for one (id `pathEditTool.<tool>`, group `anchors`, pressed while on), and `pathEditTool.exit` puts the tool down on Escape, so a second Escape leaves path edit. While any tool is on, `editAnchors`, `bendSegment`, `marqueeAnchors`, and `selectAnchor` stand aside; Alt-click still inserts an anchor.
  
  The first tool is the Simplify brush, a local version of the Simplify command. Its toggle, `pathEditTool.simplifyBrush`, sits in the `anchors` bar with the icon `core:simplifyBrush`. While it is on, a plain drag gathers every anchor a round brush passes over, and each unbroken stretch of them along a subpath is refitted as one span by Simplify's own fitter, at a tolerance in world units (default 1, as for Simplify). Only the anchors the shape does not need within that tolerance go, corners stay, and anchors outside the brush are left exactly as they were. The path previews the result during the stroke, release commits one undo step, and Escape mid-stroke cancels it. The action is `simplifyBrush`, in the standard actions and the `paths` feature preset; `ActionParamSchema` types its `radiusPx` (screen pixels, default 12) and `tolerance` for `<SceneCanvas tune>`. The cursor over the canvas is the brush ring, as wide as the brush a drag there would start, a tuned radius included.
  
  An action's hover `cursor` may now be a function of the params the winning binding would start it with, tunings included; `actionCursor(action, params)` reads either form, and `resolveOnly` reports the winning binding's `params`.
  
  Path edit draws the open path's outline as a thin accent line over its own paint, so a path stays visible under its markers, and an unselected anchor that sits closer to a neighbor on screen than a marker is wide is drawn as a small dot, so a dense freehand run reads as a line of dots rather than a solid band. `PathEditingOverlayStyle` takes `outlineStroke`, `outlineWidthPx`, and `denseDotRadiusPx`.
  
  `@weasel-js/routing` adds a `brush` overlay variant: `{ kind: 'brush', points, radiusPx }`, the world path a round brush has taken and its radius on screen. `<SceneCanvas>`'s dispatcher overlay paints it as the swept band and a rim at the brush's position, gated by the `action.brush` chrome-caps id.
  
  `@weasel-js/geom` factors Simplify's fitter onto a span: `simplifySpan(sub, closed, from, to, tolerance)` refits one stretch of a subpath and `simplifySubpath` a whole one, both of which `simplifyPath` now runs on. `simplifyAnchorsAt(set, flatIndexes, tolerance)` refits each unbroken run of the named anchors, and `anchorsUnderBrush(set, from, to, { radiusPx, scale })` answers the anchors within `radiusPx` of a segment, measured on screen.
- f082c83: A Smudge brush: a round brush that pushes the outline of the selected paths along with the pointer. Points under the brush move with it, most at its center and not at all at its rim, and a segment the brush meets that is longer than a third of its radius is subdivided until it can bend there.
  
  `@weasel-js/geom` adds `smudgePath(path, opts)`, one dab of the brush.
  
  `@weasel-js/core` adds the `smudgeBrush` action to the `paths` preset and `useSmudgeBrushTool` (key S), whose drag routes to it. The action's `radiusPx` (screen px) and `strength` params are set with `<SceneCanvas tune>` and read on every move, its cursor is the Simplify brush's ring at that radius, and a stroke is one undo step.
- db8c16e: One snap pipeline for every gesture. Move, resize, rotate, insert (drag and click-place), pen and spiro placement, pen handles, anchor and handle drags in path edit, measure, and the symmetry center all begin a session on the `snap` dep at press and ask it each frame where their point lands. Every kind of target is a snap source, and one resolver ranks all of their candidates together: a point beats a line, a real target beats a fallback such as the grid, then the smaller move on screen wins, then source order. One readout layer draws what the result met. `docs/snapping.md` is the reference.
  
  **Breaking: removed APIs, with their replacements.**
  
  - `SnapDep.point` is gone: the `snap` dep is `begin(req)`, which returns a `SnapSession` (`at`, `angle`, `end`).
  - `<SceneCanvas toolOptions={{ snapPoint }}>` is gone: register a source in `<SceneCanvas snap={{ sources }}>`, `gridSnapSource` for a grid.
  - `selectTool.snap`, `SnapStrategy`, and core's `snap()` behavior adapter are gone: a grid is `gridSnapSource({ spacing, origin?, unitSystem? })`, ruler guides `guideSnapSource(getGuides)`. A pose that is neither a rect nor a `Path` passes its `OriginProjection` as `snap={{ originProjection }}`. Moving from `selectTool.snap: gridSnapStrategy(…)` to `gridSnapSource` also snaps resize corners, inserts and pen clicks to the grid, not only a move's origin.
  - `@weasel-js/guides`: `gridSnapStrategy`, `guideSnapStrategy`, `GuideSnapOptions`, `DEFAULT_GUIDE_TOLERANCE_PX`, and `pointSnapToGrid` are gone, and so are the `@weasel-js/guides/move`, `/resize` and `/insert` subpaths with their `snapToGrid`, `snapToGuides`, `SnapToGuidesMoveArgs`, `SnapToGuidesResizeArgs` and `SnapToGuidesInsertArgs`: use `gridSnapSource` and `guideSnapSource`. An import of `snapToGrid` from `@weasel-js/core/move` (a subpath that no longer had it) becomes `gridSnapSource` from `@weasel-js/guides`.
  - `@weasel-js/guides`: `alignMoveBehavior`, `alignInsertBehavior`, `alignResizeBehavior`, `AlignMoveArgs`, `AlignmentBehaviorBase`, `matchAlignment`, `MOVE_ANCHORS`, `AlignAnchor` and `AlignMatchResult` are gone: `alignmentSnapSource(opts)` snaps to siblings' edges and centers and `spacingSnapSource(opts)` to equal gaps, on move, resize and insert alike. `matchSpacing` and `measureGaps` stay.
  - `PointSnapBehavior`, `PointSnapContext`, `PointSnapResult`, `PointSnapFrame`, `ResizePolicy.pointSnap`, `useResizePolicy`'s `pointSnap`, and the resize option `pointSnapBehaviors` are gone: a resize snaps its dragged corner or edges through the session, so any source snaps it.
  - `lockAspectWithModifier` (with its `{ key }` option) and `DEFAULT_RESIZE_BEHAVIORS` are gone from `@weasel-js/core/resize`: Shift's aspect lock is the resize's `snap.constrain` role.
  - `snapRotationWithModifier`, `DEFAULT_ROTATION_SNAP_STEP` and `DEFAULT_ROTATE_BEHAVIORS` are gone: rotation snaps through `rotationSnapSource`, which every canvas asks, and the `snap.constrain` role (Shift) adds the 15° steps. `rotate: { behaviors: [] }` no longer turns rotation snapping off; `<SceneCanvas snap={{ omit: ['rotation'] }}>` does, and a source with the id `'rotation'` replaces the default.
  - `constrainTo45` is gone from `@weasel-js/core`: the pen's handle Shift is the session's angle step.
  - `usePenTool`'s `snapPoint` and `anchorSnapRadius` options are gone, and `useDragRect`'s and `useDragRadial`'s `snapPoint`: the pen and the drag gestures snap through the `snap` dep (`pathSnapSource` for anchors, `gridSnapSource` for a grid). A pen anchor joins an open end within `targets.penCloseHitPx` of the press before any snap.
  - kernel3d's `createSnap()` took nothing and snapped nothing; `createSnap(world, { sources?, reachPx?, store? })` takes the world and snaps.
  
  **New.**
  
  - `<SceneCanvas snap={{ sources, omit, reachPx, originProjection, readout, readoutStyle }}>` (`SceneCanvasSnap`), a feature preset's `snapSources`, and `useSnapSource(source)`.
  - One reach for every source that sets none, the kit setting `targets.snapPx` (8 screen px; `DEFAULT_SNAP_PX`).
  - The snap source contract: `SnapSource`, `SnapCollect`, `SourceCandidate`, `Locus`, `SnapProbeAt`, `SnapGesture` (with `'handle'`), `SnapEdge`, `SnapEdges`, `AngleCollect`, `AngleCandidate`, `SnapMark` and `SnapMarks`; the session types `SnapBegin` (with `reachRad` and `theta0`), `SnapConstrain`, `SnapMods`, `SnapOutcome`, `SnapResizeBox`, `SnapSession`.
  - Sources: `pathSnapSource` with `PathSnapSourceOptions` (and `only`), `measureEndSource` with `MeasureEndSourceOptions` (`reachPx`), and `rotationSnapSource` in core; `gridSnapSource`, `guideSnapSource`, `alignmentSnapSource` and `spacingSnapSource` in guides; `handleSnapSource` and `HandleSnapOptionsInput` in path-tools (`createHandleSnapPreset` and `createHandleSnapExtension` take options or a thunk of them, and the preset registers the source); `boxSnapSource`, `alignPlaneSource`, `groundGridSource` and `GroundGridSourceOptions` in kernel3d.
  - The modifier roles `snap.suspend` (Ctrl) and `snap.constrain` (Shift), declared by every snapping action: `SNAP_ROLES`, `snapMods`, `SNAP_ANGLE_STEP` (the one 15° step for a line insert, a measurement, a rotate and the symmetry axis), `SNAP_AXIS_STEP`, and `stepAngles`.
  - The readout: `createSnapReadoutLayer`, `SnapReadoutStyle`, `createSnapOutcomeStore`, the `snapReadout` dep (`SnapReadoutDep`), and the drawing helpers `tickedSegment`, `pillCommands` and `measuredSegmentCommands`. The debug overlay's `snap` feature draws every candidate the resolver weighed.
  - Building blocks for a host's own session: `resolveSnap` and its types in `@weasel-js/geom/nd`, with `stepLine` and the flat math under it (`Flat`, `Vec`, `flatDim`, `closestOnFlat`, `closestBetweenFlats`, `intersectFlats`); `gatherSnapCandidates`, `resolvedSnapMarks`, `snapSourcesFor`, `GatherSnapOptions`, `SnapCandidateMark` and `SnapGeometry` in core; `pointSnap`/`PointSnap` for a tool placing points.
  - `@weasel-js/geom/3d` gains `vec3`, `distance`, `lerp`, `pointOnRay`, `aabbOfPoints`, `closestPointOnLine`, `closestPointOnSegment` and `closestPointsRayLine`.
  - `@weasel-js/core/test-seams` gains `createSnapSession2dForTests` (with `SnapSession2dOptions`), a 2D session for tests outside core; it is not public API.
  - kernel3d: `projectSnapMarks` with `ScreenLine` and `ScreenPoint`, `projectPoint`, and `Snap3dOptions`.
  - `InsertDep.commit` and `InsertDep.build` take an optional `ends: InsertEnds` (the drag's start, end and `fromCenter`); click-place passes them too. kernel3d's `createInsert` builds its footprint from the two ends cast onto the ground, so a 3D click-place centers its footprint on the snapped ground point.
  - path edit: `PathEditDragStart.snap`, `PathEditDrag.end`, `SnapMods.hold`.
  
  **Behavior changes.**
  
  - Every `<SceneCanvas>` snaps point gestures to other nodes' anchors — rect and text corners, ellipse quadrants, path anchors — through a default source with `pathSnapSource`'s id, `'path-snap'`: pen placement and handle tips, spiro points, anchor drags, line and box insert, click-place, measure ends and the measurement end drag, and the symmetry center; not move, resize or rotate. `snap={{ omit: ['path-snap'] }}` drops it, and a consumer's own `pathSnapSource()` replaces it rather than doubling. A point target on the gesture's own `origin` is never offered, so a handle tip does not stick to its anchor.
  - A grid gives way to a target in reach on its axis, where alignment used to add its delta on top of the grid's. Guides and alignment reach 8px, not 6.
  - Ties between equally good results break by source order, then by the order a source yields its targets.
  - Ctrl suspends snapping on every snapping gesture, a pen drag and an anchor drag included; a handle drag keeps Ctrl as its length lock.
  - A rotate snaps to quarter turns and to other nodes' angles without Shift (new); near the pivot its reach is capped at 30°.
  - Shift on a move locks it to the horizontal, vertical or 45° line through the press (new), and so does Shift on an anchor drag (new).
  - Shift on a line insert, a measurement or a pen handle puts the end at the pointer's nearest point on the stepped line through the start (it used to keep the drag's length), and that line meets snap targets.
  - An anchor drag meets every point-gesture source, a grid included.
  - A multi-root move snaps each root's origin, the nearest winning, not only the first node's.
  - A move's behaviors run on the snapped delta, and a behavior's translate stands, so a container's slot preview wins over a snap target in reach.
  - A measurement end drag keeps its offset from the press (it used to jump the end to the pointer), and no longer snaps to its own measurement's ends.
  - kernel3d's `translate` puts its plane at `up · position`, the same as before for +y up.
- 4df0749: The path constraint solve is sparse. Each constraint's derivatives are analytic rather than central differences, and each step solves the damped normal equations by a Cholesky factorization kept inside the envelope of a reverse Cuthill-McKee ordering, rather than by dense elimination of an `m × m` matrix built from a full `m × 2n` Jacobian. A chain of constraints along a path now costs time close to linear in its length: a drag frame on a 200-anchor staircase went from about a second to a few milliseconds. Results are unchanged.
- Spiro curves: a curve drawn by its on-curve points alone. `@weasel-js/geom` solves one with `solveSpiro(points, closed)`: an Euler-spiral segment, whose curvature changes evenly along it, runs between each pair of points, and the segments are solved together so tangent and curvature carry straight through every `smooth` point. A `corner` lets its two sides turn independently, `left` continues the straight segment arriving at it, and `right` runs the curve into the straight segment leaving it. `spiroToPath(contours)` writes the solved curve as cubics, splitting a segment wherever one cubic would stray more than a ten-thousandth of its length, and reports which anchor each point became; `spiroContoursOf`, `spiroControlPath` and `spiroContoursFromControl` read the points back out of such a path and in from an edited control path. The `spiro` curve representation in `@weasel-js/geom/curves` now uses the solver.
  
  Breaking: `SharedAnchor.spiroType` takes a `SpiroKind` (`'smooth' | 'corner' | 'left' | 'right'`) where it took `'g2-smooth' | 'g4-smooth' | 'corner'`. G4 points were never solved as such.
  
  `@weasel-js/core` lets a path be drawn from another form it keeps beside it. A node's `data.representation` holds the form, named by its `kind`, and a `PathEditExtension`'s new `representation` (a `PathRepresentation`) says how path edit reads and writes forms of that kind: `editPath` gives what path edit shows and moves in place of the drawn path, `store` turns an edit of it back into the drawn path and the form, the live drag preview included, `anchorMarkers` shapes each anchor's marker (`AnchorMarkerShape`), and `segmentPress` takes a press on the outline in place of Bend segment. A form no representation on the canvas reads is edited as its drawn path and dropped, and `representation` joins `GEOMETRY_BOUND_DATA`, so a path command that replaces the geometry, such as Join or Simplify, leaves plain geometry. `pathEditPathOf` and `storeEditablePath` take the extensions to consult; the `editAnchors` dep's new optional `getOutlinePath` gives the drawn path the segment affordance hit-tests. The insert dep's `'path'` extras take a `data` laid under the path, and `createPointerFollower` is exported for tools that trail the pointer.
  
  `@weasel-js/path-tools` draws and edits spiro curves, all from `src/spiro`. `spiroPreset`, in `pathTools`, brings the spiro representation: a spiro node, `data.path` plus a `{ kind: 'spiro', kinds, at }` form (`spiroNodeData`, `spiroOf`, `withoutSpiro`), is edited through the straight-sided control path through its points, and every edit solves the curve again. Each point draws by its kind: a circle for smooth, a square for a corner, a half-disc facing away from the line for `left` and `right`. Dragging the curve between two points adds a smooth point there and drags it. The preset also brings `setSpiroKind`, which sets the kind of the points selected in path edit, and `releaseSpiro` ("Convert to path"), which turns a spiro curve into an ordinary path. The spiro tool, `useSpiroTool` (Shift+P), mounted through `<SceneCanvas tools>`, places points by clicking, each of the kind its `spiro.placePoint` action's `params.kind` names, Alt-click for a corner, and inserts the curve through the `insert` dep as a `'path'` carrying its form. Its glyph is `path-tools:spiro`.
- 365ab72: Spiro curves have a `g4` point kind: tangent, curvature, and the curvature's first two derivatives all carry through it, so a run of `g4` points bends more evenly than `smooth` ones. A segment with a `g4` point at either end is a cubic-curvature segment rather than an Euler spiral: `fitEulerSegment` takes the two higher terms (`k2`, `k3`) as optional arguments, `EulerFit` carries them (zero on an Euler spiral), and `eulerCurvatureDerivativesAt` answers the curvature's first two derivatives. Where such a segment meets a point that is not `g4`, its curvature's second derivative is zero there. `setSpiroKind` gains the kind as a variant, and path edit marks a `g4` point with a diamond.
- 7a31f9d: `textToPath` and `textToPathsByPaint` outline synthetic-bold text instead of throwing. A glyph whose weight is faked from a lighter face grows by the distance the renderer's field shift moves its edge (`SYNTH_BOLD_AMOUNT` of the field's span per texel of the atlas, 0.01 em a side on Inter's), with mitered corners and its curves kept. The `'synthetic-bold'` `TextOutlinesFailure` reason is removed, which breaks code that names it.
  
  New in `@weasel-js/geom`: `growRegion(path, distance, { join, miterLimit, tolerance })`, a filled region grown outward without a boolean. Each contour is offset, curves stay curves, and the grown contours overlap where they meet, filling once under `'nonzero'`. New in `@weasel-js/font`: `SYNTH_BOLD_AMOUNT` (moved from the renderer) and `syntheticBoldGrowth(source, family, weight, style)`, the growth in em for the atlas serving a face.
- 4cec295: A `tangent` path constraint keeps an anchor's two handles on one line through it, pointing apart — G1 continuity — with their lengths free. Additive.
  
  The solver now works over handles as well as anchors: each handle is an offset from its anchor, so it rides with the anchor as before, and becomes a variable only where a `tangent` reads it. `ConstraintPoint` carries `inHandle` and `outHandle`, `pathAnchorPoints` reports them, `solvePathConstraints` writes the turned handles back, and `solveConstraints` takes `heldHandles` beside `held`. `constrainPathEdit` holds the handles an edit moved, so a handle drag finished through it turns the other handle and leaves the dragged one where the pointer put it. A tangent on an anchor missing a handle cannot hold and is reported as unsatisfied; one the solve could satisfy only by shrinking a handle to nothing is a conflict. `constraintApplies` says whether a constraint can be solved over a set of points.
  
  In `@weasel-js/path-tools`, `constrainAnchors` with kind `tangent` constrains each selected anchor that has both handles, and the overlay marks a tangent anchor with a line touching a circle.
- 1faab2d: Trim segment. `useTrimTool` (key Y) hands a click to the new `trimPath` action, which removes the clicked piece of a stroke between the nearest crossings on either side, with any other node's outline or with the stroke itself. Curves split where they are cut and stay curves, a closed shape opens, an end piece runs back to the first crossing, and a stroke with nothing left is deleted, each as one undo step. While the tool is up it draws the piece under the pointer dashed, from the same `planTrim` the click commits. The action is in the standard actions and the `paths` preset.
  
  Extend to next path. The new `extendToMeet` action carries open ends along their tangent to the next stroke they meet: the selection's ends, the selected end anchors in path edit, or, with `useExtendTool` (key U), the end nearest a click. A straight end grows longer and a curved one gains a straight run. It is in the standard actions and the `paths` preset, with no key of its own.
  
  `@weasel-js/geom` adds what these stand on: `intersectSegments`, `pathSegments`, `pathCrossings`, `trimPathAt`, and `extendToMeet`, `lengthenOpenEnd`, `openEndRay`, and `openPathEnds`.
- d705830: A stroke can be drawn with a broad nib. `Stroke.nib` is `{ angle, ratio }`: the nib's edge in radians counterclockwise on screen, and its thinnest width as a fraction of its widest. The stroke is its full width moving across the nib and `ratio` of that moving along it, an elliptical pen's width in between, and it multiplies `vertexWidths` where both are set. Each side of a corner keeps its own width, so a square drawn with a level nib has thin level sides and full upright ones right up to the joins; a round join's arc runs between the two. `strokeToPath`, the renderer's ribbon cache, and SVG export follow it, and since a nib only ever narrows a stroke, bounds and culling are unchanged. `@weasel-js/stroke` adds `nibWidthScale`, the nib as a `WidthScale`, and `widestStrokeWidth`, which culling, picking, and flattening now share; picking used to ignore `vertexWidths`. Draw's stroke properties gain a Nib switch with its angle and thinnest ratio.
  
  A `vertexWidths` entry is a `VertexWidth`: a number, the full width centered on the path as before, or a `{ left, right }` pair giving each edge its own distance from the path, `right` being the side the normal `(−dy, dx)` points to, below a path running in +x on screen. Every reader resolves an entry through `vertexHalfWidths(entry, fallback)` in `@weasel-js/paint`: the tessellator, which carries the difference between the sides as the new `Polyline.offsets` through trimming, dashing, and the nib, and centers caps between the two edges; `strokeToPath`; the inner and outer ribbon; bounds, culling, and picking, through `widestHalfWidth`; and SVG, which writes a pair as `left/right` in `wzl:vertex-widths`. `vertexWidthFromSides` writes equal sides back as a number, and `scaleVertexWidth` scales either form. An entry of zero is now a zero width; it used to take the stroke's `width`.
  
  `useGirthTool` (Shift+W), in `@weasel-js/path-tools`, edits `vertexWidths` by dragging the stroke's edges. Hovering near either edge marks the grab point on it and the width point a press there moves: the anchor at that spot, or one inserted between two with `insertAnchorOnSegment`, so the path keeps its shape. The grabbed edge follows the pointer along the path's normal and the other mirrors it, writing a number; dragging inward pinches the stroke, down to zero. Alt-drag moves the grabbed edge alone and writes a pair. The drag moves the edge as drawn, so under a nib the stored width changes by more. Every drag is previewed live and committed as one undo entry. Alt-click on a width point clears it, so it takes the stroke's `width` again. The stroke last touched shows its anchors, with a line across the stroke at each that has a width. `strokeEdgeNear` in `@weasel-js/stroke` is the hit test behind it: the edge of a stroke nearest a point, measured along the path's normal, with each side's distance as drawn.
  
  A dashed stroke now keeps its per-vertex widths, which it used to drop. The anchor-parameter rule that trimming and dashing share is `anchorParamsBetween` in `@weasel-js/geom/tessellate`.
  
  SVG has no variable width. `serializeSvg` writes a stroke with `vertexWidths` or a `nib` as its outline: the path keeps its stroke attributes at `stroke-width="0"`, which draws nothing, with the real width, the per-vertex widths, the nib, and its markers in the `wzl` namespace, and the outline follows as a filled path in the stroke's paint that draws the marker heads. A node with an opacity wraps both in one group carrying it, so they composite as one layer. Other viewers draw the outline; `parseSvg` drops it and reads the stroke back off the path, and a transform it bakes in scales the per-vertex widths with the width.
- 329aa39: A polygon-pose node rotated after a warp keeps its warp. `resolvePathWarp` used to recover only a move or a resize of the stored coordinates; it now recovers any affine rewrite of them, with the new `fitAffine` in `@weasel-js/geom` (the least-squares affine map between two point sets, falling back to a similarity for points on one line).

## 1.10.1

### Patch Changes

- cbd5b4d: `@weasel-js/geom`'s six-number affine type is `Affine`, no longer `Mat3`. It sat one capital letter from `mat3`, the namespace over the nine-element column-major `GlMat3` a GL uniform takes, and the two are different matrices. `mat3.toAffine` and `mat3.fromAffine` already named the conversion this way.
  
  Breaking: `import type { Mat3 } from '@weasel-js/geom'` becomes `import type { Affine }`. The values are unchanged, and so are the free functions beside the type (`identity`, `multiply`, `invert`, and the rest).
- aaa2b4f: Path edit has two commands for the selected anchors' handles. `retractHandles` collapses them onto their anchors, making sharp corners; a segment whose ends both lose their handles turns straight. `makeHandlesSymmetric` gives each anchor two handles of equal length pointing opposite ways, making it smooth: the shared direction splits the difference between the two handles' own, the shared length is their mean, and an anchor with one handle mirrors it. The ends of an open path are skipped. Both are in the standard actions and the `paths` feature preset, in the `anchors` group, with icons `RetractHandlesIcon` and `SymmetricHandlesIcon`, and are disabled when they would change nothing.
  
  Dragging a control handle with Shift held keeps it at the angle it had at the press and changes only its length; it can shrink onto its anchor but not flip through it.
  
  `@weasel-js/geom` adds the edits underneath: `retractHandles(set, flatIndexes)`, `makeHandlesSymmetric(set, flatIndexes)`, and `handleAlongItsAngle(anchor, handle, to)`.
- c7b7ed5: In path edit, dragging a segment bends it: the point pressed follows the pointer and the segment's two handles move to carry it, and a straight segment becomes a curve. An end anchor that was smooth stays smooth, its other handle turning at its own length. It is the `bendSegment` action, in the standard actions and the `paths` feature preset. A drag that starts on an anchor or off the path still moves anchors or draws the marquee, and on a canvas with no mode registry a drag that starts on the edge no longer moves the shape.
  
  Path edit now lays a `segment` affordance along the edited path's outline, under its anchors and controls, and `bendSegment` binds to it. Affordance regions take a new shape for it, `{ kind: 'outline', path, hitRadiusPx }`: hit within that many screen pixels of the path's outline. `@weasel-js/routing` adds `isSegment` for that hit and `isPathEditPart` for any anchor, control, or segment hit; `move` turns down a press on any of them.
  
  `bendSegment(set, grip, dx, dy)` (`@weasel-js/geom`) is the edit underneath, taking the `{ sub, segIdx, t }` that `segmentAt` reports.
- ee59ccd: Deleting an anchor keeps the curve's shape. The segment that replaces the two either side of it keeps the directions they left and arrived with, and its handle lengths are now fitted to them rather than set to a third of the chord, so deleting one anchor of a circle leaves a round arc instead of a flat lobe. An anchor that was inserted on a curve and then deleted gives back the original curve. A gap between two straight segments closes with a straight one.
  
  `fitCubicWithTangents` (`@weasel-js/geom`) is the fit underneath: the one cubic through a run of samples whose control points keep given end tangents.
  
  Breaking: `fitCubicThroughDeletion(prev, next)` becomes `fitCubicThroughDeletion(prev, removed, next)`, since the fit needs the anchor being removed.
- 9eefcc7: The READMEs of `@weasel-js/geom` and `@weasel-js/gestures` are overviews now: what is in the package, how its parts relate, and examples, where each used to be an install line and an empty import. Each links to its page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, which shows the README beside the package's guides, API reference, and demos. No code changed in either.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- d8b51a4: Geometry for the path commands. `simplifyPath(path, tolerance)` refits a path with as few anchors as hold it within the tolerance, keeping corners, the ends of open subpaths, and long flats between curves. `snipPathsAtCrossings(paths)` (in `@weasel-js/geom/booleans`) cuts each path's stroke wherever another of them crosses it. `averageAnchorsAt` moves anchors to their mean position on one or both axes, and `joinAnchorsAt` / `joinSubpathEnds` join two open-subpath ends, closing a subpath or merging two, with `subpathEndAt` and `closestOpenEnds` to find them. In `@weasel-js/stroke`, `offsetPath(path, distance)` grows or shrinks the region a path fills, taking a stroke's miter, round, or bevel joins, and refits the result as curves.
- 62e766c: Editing the points of a skinned path keeps its weights with its points. Inserting, deleting, cutting, nudging, and dragging anchors, and continuing or joining the path with the pen, now write the node's `data.skin` in the same undo entry as its path, so one undo restores both. Before, the weight arrays kept their old numbering and every point after the edit followed the wrong joints. A new point takes weights between those of the anchors either side of it, by its distance to each; a point drawn past an end takes the end's. Hand-painted weights are kept: nothing is weighed again from the bones.
  
  Adds API: `editAnchorSetTracked(path, edit)` is `editAnchorSet` that also answers `origins`, where each point of the new path came from in the old one, and `remapPointValues(values, origins)` carries an array kept per point through that edit. `remapSkin(skin, origins)` does the same for a skin. `EditAnchorsDep.applyEdit` and `editOps` take `origins` as an optional fourth argument; a dep of your own that ignores it leaves a skin as it was.
- ab9ea7a: A stroke more than twice as wide as the flatten tolerance now flattens its curves in steps of at most 10°. Before, a tight bend under a thick stroke took steps of 40° or more and showed visible facets on the stroke's edges. Thinner strokes still flatten on the same vertices as their fill. `extractPolylines` takes a new `maxTurn` option, and `flattenCubicWithArcLen` and `flattenQuadraticWithArcLen` take a trailing `maxTurn` argument.
- e962494: New package, `@weasel-js/symmetry`: live symmetry groups. A group's copies (a mirror at any angle, both axes, a point, radial, kaleidoscope, or a repeat with an optional glide) are drawn from its real children. Every edit to a child therefore reaches every copy, a click on a copy selects the child it copies, and `bakeSymmetry` turns the copies into real nodes. `createSymmetry(scene).contribution` draws the guide with draggable center, axis, and step handles, sends every tool's shapes into the active group, and keeps a path that is its own image under its group symmetric while its anchors are dragged or nudged.
  
  Core gains what the package is built on, and each piece is usable on its own:
  
  - `ContainerNode.copiesFromPose`: a container draws its subtree again under each affine it returns. Hit tests reach into the copies, and the clip travels with each one. Additive.
  - The `insertInto` dep: the container the `insert` dep puts new nodes into.
  - The `pathSymmetry` dep: transforms that anchor drags and nudges keep a path symmetric under.
  
  `@weasel-js/geom` adds `anchorSymmetry`, `anchorSymmetries`, `translateAnchorsSymmetric`, and `moveHandleSymmetric`. `@weasel-js/svg` writes a container's copies as transformed groups.

## 1.10.0

### Patch Changes

- a86d79f: geom: the anchor-set edits live here now (`editAnchorSet`, `translateAnchorBy`, `moveHandleTo`, `insertAnchorOnSegment`, `deleteAnchorsAt`, `openSubpathAt`, `segmentAt`, `anchorsInRect`, `anchorAt`, `anchorCount`, `locateAnchor`, `flatAnchorIndex`, with `AnchorSet`, `AnchorRect`, and `SegmentHit`), beside `pathInWorld`, `pathInPoseFrame`, `worldEditToStorage`, and `PathInWorldPose`. `nearestPathAnchor`, `reverseAnchors`, and `PathAnchorHit` are exported here; they were not exports of `@weasel-js/core` before.
  
  text: `textToPath`, `textToPathsByPaint`, `loadTextOutlines`, and `TextOutlinesError` live here now, with `TextOutlineSource`, `TextNodeSource`, `TextPaintPath`, `TextToPathOptions`, and `TextOutlinesFailure`. `SYNTHETIC_ITALIC_RADIANS`, the lean a faked italic takes, is exported here; it was not an export of `@weasel-js/core` before.
  
  `@weasel-js/core` still exports every name it did before.
- 1837952: Adds API: `pathDividePieces` and `pathCropPieces` in `@weasel-js/geom/booleans`, which return each result path as a `BooleanPiece` with the `sources` it came from: the indices of the inputs covering a Divide region, ascending, and the one input a Crop piece was clipped from. `pathDivide` and `pathCrop` return the same paths in the same order and are now those pieces without their sources.
- 126116b: A clip can hold a path. `toClip` used to throw on a key whose value has a typed array in it, which is every `Path`. It now writes each one as its type's tag and its numbers, `{ __ta: 'f32', data: [...] }`, at any depth of the value, and `bindClip` makes it the typed array again, so a track tweening a path-shaped pose goes through `JSON.stringify` and `JSON.parse` and back. An event's `data` is passed as written, as before.
  
  Changed behavior: `bindClip` now copies each key's value where it used to share it with the clip, so a plain object in a key's value that has `__ta` and `data` members of that shape is read as a typed array.
  
  Adds API in `@weasel-js/geom`, where the encoding lives: `tagTypedArrays(value)` and `reviveTypedArrays(value)` copy a value with its typed arrays tagged or made again, `typedArrayReplacer` is the first as a `JSON.stringify` replacer, and `tagTypedArray` and `untagTypedArray` do one array. Every number array type is covered: `Int8Array` through `Float64Array`, `Uint8ClampedArray` included. The types are `TaggedTypedArray`, `TypedArrayTag`, and `NumberTypedArray`.
- b260415: geom: `mat3`, the `GlMat3` type, and `viewToMat3` live here now, moved from core's renderer. `@weasel-js/core/renderer` still exports all three. `mat3` works on the nine-element column-major matrix a GL uniform takes; geom's `Mat3` type and its free functions (`identity`, `multiply`, `invert`) remain the six-number affine.
- 54174b6: Fixes: SVG import and export, the booleans, and the renderer's mesh cache disagreed with a path whose open subpaths no fill closes (`openFill: 'none'`, or `setDefaultOpenFill('none')`).
  
  - `parseSvg` stamps `openFill: 'close'` on a `<polyline>` or `<path>` with an open subpath, since SVG always closes one to fill it. Such a path now carries a field it did not, and keeps painting under a `'none'` default.
  - `serializeSvg` writes open subpaths no fill closes with `fill="none"`. A path mixing closed and open subpaths is written as a `<g>` of two `<path>`s, the group carrying the node's opacity, rotation, and metadata, so it reads back as a group of two.
  - `pathUnion`, `pathIntersect`, `pathSubtract`, `pathExclude`, `pathDivide`, and the slice cuts leave such an open subpath out of the region. This changes their result for a path that says `'none'`.
  - A mesh the renderer cached under one default rule is rebuilt after `setDefaultOpenFill` changes it, so the default no longer has to be set before the first paint.
  
  Adds API: `splitByClosure(path)` and `hasOpenSubpath(path)` in `@weasel-js/geom`, re-exported from `@weasel-js/core`.
- 4edad85: Fixes: a filled path with an open subpath painted and could not be clicked. `tessellate` and `pathSignedArea` closed the subpath, and `pointInPath`, `pathContainsRect`, `pathIntersectsRect`, and the polygon tests ignored it. All of them now ask the path.
  
  Adds API: `PolygonPath.openFill`, `'close'` (a fill closes an open subpath with a straight edge back to its start, as SVG and canvas do) or `'none'` (an open subpath never fills), and `setDefaultOpenFill(rule)` / `defaultOpenFill()` in `@weasel-js/geom` for a path that names neither; the default starts at `'close'`. `fillsOpenSubpaths(path)` is the one answer. Set the default before anything is painted: a mesh already built keeps the rule it was built under.
  
  Changes behavior: the filled-region hit tests now count an open subpath of three or more points as closed, so such a path is picked across the area its ends enclose. A node whose painter reports unfilled ink is still picked on its outline only. A marquee or lasso reads that ink too: it meets the open subpaths of a node painted with no fill only where it touches the stroke.
  
  Fixes: `editAnchorSet` returned a path with `fillRule: 'nonzero'` whatever the path it was given said. It, `reversePath`, `splitSubpaths`, the path transforms, the pen's continue and join, and the rig's skinned path now hand back a path with the fields of the one they were given. `anchorsToPath` takes that path as an optional third argument.
- 335f192: geom: the path anchor model and the small shape builders live here now. That is `pathToAnchors`, `anchorsToPath`, `countPathAnchors`, `isAnchorSmooth`, `nearestSegmentT`, and the `PenAnchor` type, plus `circlePath`, `squarePath`, `rectMarkerPath`, and `roundRectPath`. `@weasel-js/core` still exports every one of them. New from geom: `segmentEnds` and `isStraightSegment`.
- 7b9de2d: Adds API: `pathTrim` and `pathMerge` in `@weasel-js/geom/booleans`. `pathTrim(...paths)` removes from each path what the paths after it cover, so given back to front every piece is the part of its input left showing, and an input wholly hidden gives none. `pathMerge(paths, keyOf)` trims, then unites the pieces of the inputs `keyOf` gives the same key, which a caller keys by paint. Both return `BooleanPiece`s naming the inputs each piece came from. Uniting same-key pieces that do not touch into one path of several contours, where Illustrator's Merge leaves them apart, was an agent's judgment. No Boolean action runs either one yet.
- ea54a64: geom: the box-pose frame math lives here now: `poseFrameOf`, `poseFrameInverseOf`, `poseLinearOf`, `pathThroughPoseFrame`, `poseRotationOf`, and `rotatePathAround`, with the `PoseLinear` and `PoseRotation` types. They read a pose as plain numbers and need no scene. `@weasel-js/core` still exports every one of them.
- 955defa: geom: the screen-pixel helpers live here now: `pxExtent`, `scaleDelta`, `screenAngleOf`, `standoff`, `withinPxBox`, `withinPxRadius`, and `meanScale`, with the `Scale2` type. They take a view's scale as two numbers and need nothing else from core. `@weasel-js/core` still exports every one of them.
- 46fcc7e: Adds API: `TYPED_ARRAY_CONSTRUCTORS`, the constructor of each typed array `tagTypedArray` can write, under the tag it writes it by. `TypedArrayTag` is its keys and `NumberTypedArray` an instance of any of them, as before; the table they are read from is now exported with them.
- a297730: Fixes: a marquee or lasso in `intersect` mode drawn wholly inside a closed shape with no fill selected it, though a click there did not. A region now takes an unfilled shape only where it meets the outline or encloses it. This changes what a marquee selects: one drawn inside a stroke-only rect to reach the nodes within it no longer takes the rect too.
  
  Adds API: `polygonIntersectsPath(polygon, path, { filled: false })` in `@weasel-js/geom` reads a closed subpath as a line, and `regionTakes` takes a sixth argument, `filled`, a thunk asked only when the bounds cannot decide. Both default to filled.

## 1.9.4

### Patch Changes

- a843f5a: The cubic, quadratic, and spiro curve representations share one definition of their default handles and segment lookup. No behavior change.
- f66ec41: `composePath` and `decomposePath` took a polygon parent's origin from the smallest control-point coordinate instead of its bounds, so a child of a curved parent composed off from where `boundsOfPath` puts that parent (12.5 units for `M0 0 C-50 0 -50 100 0 100`). Both now use `boundsOfPath`.
- 1896646: A path whose drawing commands follow a `Z` with no `M` between (`M0 0 L10 0 L10 10 z l-10 0 l0 -10 z`, legal SVG for two triangles) was read four different wrong ways: `pointInPath` missed the second shape, `extractPolylines` and `tessellate` joined it onto the first as one contour, and `pathToMultiPolygon` dropped it from every boolean op. All four now open a new subpath at the pen, as SVG does. `forEachSegment` tells its visitor when a command opens a subpath this way, and `extractPolylines` no longer throws on a path with no opening `M`.
- ccf595e: `resolveEasing` kept every bezier easing it had ever resolved, so a curve editor dragging a handle grew the cache by an entry per pointer move for the life of the page. The cache now holds the 256 most recently added curves.
- 546fd8a: Curve flattening treated a Bezier whose control points sit on the line through its endpoints as flat, even when they lie past an end: `M0 0 Q200 0 100 0` reaches x = 133.3 but flattened to one segment ending at x = 100, so its stroke, hit test, and boolean geometry disagreed with `boundsOfPath`. Flatness is now measured to the chord segment, so such a curve is subdivided along its real extent.
- 310c9db: `nurbs.curvatureAt` was wrong at t = 0 and t = 1: the finite-difference stencil clamped onto the end sample and lost its second derivative, so a curvature comb's first and last teeth did not match the curve. The stencil now sits one step inside the ends.
- ad0b554: `pathFromD` built a path from data SVG treats as in error. A `d` string with no opening moveto (`L10 10 L20 0`) became a path with no `M`, and a command with too few arguments (`L 10`, or an arc whose flag is not 0 or 1) was dropped silently while later relative commands carried on from the wrong point. Data that does not begin with a moveto now builds an empty path, a malformed command ends the path before it, and both are reported through `onWarn`.
- 7da269f: `schneiderFit` measured a fit's error at evenly spaced curve parameters instead of the ones it had fitted each sample at, so samples spaced unevenly along a stroke (a fast move, then a slow one) read as badly fit and the curve was split far more than its tolerance asked for, down to one cubic per pair of samples. Four collinear samples at x = 0, 1, 2, and 100 now come back as the single cubic they are.
- f21325d: `splitBySegment.ts` keeps the knife and snip entry points, and its segment math, contour reading, crossing detection, loop tracing, region assembly, and cut-polyline handling each move into a module beside it. Nothing it computes or exports changes.
- bb5c5dc: `strokeHitTest` with a `slop` whose transform has no scale (a view mid-collapse) divided the pixel slop by zero and hit every path from any distance. It now hits nothing.
- 04caa20: `trimPolyline` emitted its first point twice when the start inset landed exactly on a vertex, leaving a zero-length segment at the head of the trimmed stroke.
- 9e51015: `splitPathBySegment`, `splitPathByPolyline`, and `snipPathByPolyline` scale their tolerances by the path's extent. A shape drawn in a very small coordinate space (0 to 0.001, say) had every cut piece discarded as negligible, so a knife cut returned `[]`, and a snip could merge two distinct crossings into none.
- 4d559ca: `isPlainObject` lives in `@weasel-js/registry` (core still exports it), and `@weasel-js/geom` exports a scalar `clamp(v, lo, hi)`. theme, prefs, labkit, and forge read plain objects through the one realm-safe test, so a `Date` or a `Map` no longer passes where they accept a record; ui's Slider and ResizeHandle, hud's loupe, and labkit's ZoomControl use geom's clamp. When its bounds cross, ResizeHandle now holds to `min` where it held to `max`. theme and prefs gain a dependency on registry, and ui's on geom moves from dev to runtime.
- 0cf2bf4: `strokeToPath(path, stroke)` returns the region a stroke covers as a fillable path: width, cap, join, miter limit, dash, alignment, per-vertex widths, and marker heads all included, with self-overlaps resolved. `trianglesToPath` in `@weasel-js/geom/booleans` is the union of a triangle mesh it is built on. Both are additions.
- 8953d33: `transformPath` keeps a rect a rect when the matrix's rotation and shear terms are within 1e-9 of zero, so a rect under a half turn or any composed map that is axis-aligned to rounding is no longer promoted to a polygon. `@weasel-js/svg` now transforms and measures paths with geom's `transformPath` and `boundsOfPath` in place of its own copies.
- 0d82f92: `View`, `ZOOM_FLOOR`, and a pure `normalizeZoom` live in `@weasel-js/geom`; routing and core re-export them under the names they had. `@weasel-js/loupe` depends on geom and no longer peers on core, so its framework-free model installs without core or React. routing gains a dependency on geom. loupe's model no longer logs core's dev warning for an invalid zoom factor; it still clamps it.

## 1.9.3

No changes in this release.

## 1.9.2

No changes in this release.

## 1.9.1

No changes in this release.

## 1.9.0

No changes in this release.

## 1.8.1

### Patch Changes

- 7e72192: Add a `@weasel-js/geom/nd` subpath: the port-curve rule over plain number
  arrays, in any dimension.
  
  `PORT_REACH`, `portControls`, `portCurvePoints` and `cubicAt` take and return
  `readonly number[]`, so a tuple `[x, y, z]` passes as it is, with no conversion
  to `{ x, y, z }`. They are the same functions the root barrel and `./3d` wrap,
  so the three entries return the same numbers. `portCurvePoints` is new at this
  level. As in the other entries it leaves out the start point, and the 2D and 3D
  `portCurvePoints` now both call it.

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
