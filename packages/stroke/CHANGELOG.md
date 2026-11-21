# @weasel-js/stroke

## 2.0.0

### Major Changes

- 12df18a: `dashLength` is renamed `dashRunLength`: it is the length a dash pattern runs along the whole path, not the length of a dash.
  
  ```ts
  // before
  const length = dashLength(path);
  // after
  const length = dashRunLength(path);
  ```
  
  <!-- entry: breaking api -->
- 7293e22: `strokeEdgeNear` is renamed `nearestStrokeEdge`: it returns the single nearest edge, where a `…Near` name elsewhere returns every match in reach.
  
  ```ts
  // before
  const hit = strokeEdgeNear(path, stroke, x, y);
  // after
  const hit = nearestStrokeEdge(path, stroke, x, y);
  ```
  
  <!-- entry: breaking api -->
- 6bdf14d: `resolveStrokeWidth` is removed; `resolveScreenLength` from `@weasel-js/paint`, which it only called, resolves a stroke width the same way.
  
  ```ts
  // before
  import { resolveStrokeWidth } from '@weasel-js/stroke';
  const w = resolveStrokeWidth(stroke.width ?? 1, scale);
  // after
  import { resolveScreenLength } from '@weasel-js/paint';
  const w = resolveScreenLength(stroke.width ?? 1, scale);
  ```
  
  <!-- entry: breaking api -->
- 2f2e3ca: `strokeSpaceOf` is renamed `strokeMetricOf`: it splits a linear map into its scale and its stroke metric, and returns `{ scale, metric }`.
  
  ```ts
  // before
  const { scale, metric } = strokeSpaceOf(m[0], m[1], m[3], m[4]);
  // after
  const { scale, metric } = strokeMetricOf(m[0], m[1], m[3], m[4]);
  ```
  
  <!-- entry: breaking api -->
- a9a0abc: `insetPath` is renamed `trimPathEnds`: it cuts a length off each end of an open path, where "inset" elsewhere means an offset.
  
  ```ts
  // before
  const shaft = insetPath(path, start, end);
  // after
  const shaft = trimPathEnds(path, start, end);
  ```
  
  <!-- entry: breaking api -->
- 880ed50: `trimmedRuns` takes its two switches as an options bag, `{ dashed, byClosed }`, both defaulting to false, rather than two positional booleans.
  
  ```ts
  // before
  trimmedRuns(cut, true, true);
  // after
  trimmedRuns(cut, { dashed: true, byClosed: true });
  ```
  
  <!-- entry: breaking api -->
- 6975d7b: `inkWidth` is renamed `widthHasInk`, since it answers whether a ribbon of that width has anything to draw.
  
  ```ts
  // before
  if (inkWidth(width)) draw();
  // after
  if (widthHasInk(width)) draw();
  ```
  
  <!-- entry: breaking api -->

### Minor Changes

- d455bd2: `ClipRibbonOptions` names the options bag `clipRibbon` takes, each field documented.
  
  <!-- entry: api -->
- bfc26b4: `MeasuredPolyline` and `RibbonStyle` are exported, the types of `ClipRibbon`'s `pieces` and `style` and of `splitForDash`.
  
  `RibbonStyle`'s `join` and `cap` are the same unions as `Stroke`'s.
  
  <!-- entry: api -->

### Patch Changes

- e4b8859: An inner or outer rect stroke under a metric that rotates the rect gets the centered ribbon `ribbonAligns` reports, drawing its full width.
  
  <!-- entry: fix visual -->
- 4f264d0: Values held between two bounds go through geom's `clamp` and `clamp01` rather than local copies.
  
  A loupe whose `minFactor` is above its `maxFactor` now settles on the low bound, as `clamp` does, where it settled on the high one.
  
  <!-- entry: rank=-5 behavior -->
- 7b0562e: A trim on a very long path (tens of millions of units) no longer bleeds one subpath into the next.
  
  <!-- entry: fix visual -->
- 34090f0: The unregistered-marker warning keeps no keys in production and only the last 256 in development.
  
  <!-- entry: rank=-5 fix -->
- b3b9f5e: A `miter` join on very short segments draws its miter rather than a bevel, so a corner looks the same at any scale.
  
  <!-- entry: fix visual -->
- e0f4c91: Registering a stroke marker under a built-in marker's id replaces it without a development warning.
  
  <!-- entry: behavior -->
- 62aede0: An install that nests `@weasel-js/geom` under stroke now resolves `earcut` and `polygon-clipping`, which stroke depends on.
  
  geom's `./tessellate` and `./booleans` load them, and geom lists them only as optional peers.
  
  <!-- entry: fix -->
- bda75b2: `nearestStrokeEdge` reads per-vertex widths where the drawn stroke does on a path with rounded or cut corners.
  
  <!-- entry: fix -->
- 5bf7f01: Dashes, trims, markers, and variable-width strokes carry a stroke's end width, offset, and position exactly at the end of a run.
  
  <!-- entry: fix visual -->
- 6a423ea: A trimmed stroke still draws a capped dot (a subpath of no length) wherever its window reaches it, as the untrimmed stroke does.
  
  <!-- entry: fix visual -->
- 774e9cc: A trimmed stroke with a `nib`, or with per-vertex widths under a stretching metric, is cut where the same trim cuts a plain stroke.
  
  `polylineAtCurve` counts a corner split into two coincident points as one anchor.
  
  <!-- entry: fix visual -->
- d2002e0: A stroke naming a marker nobody registered warns once per key in development instead of drawing a plain line in silence.
  
  <!-- entry: fix -->
- Updated dependencies [e973dcd]
- Updated dependencies [851a4d3]
- Updated dependencies [d764d06]
- Updated dependencies [a98ad34]
- Updated dependencies [2c2ab71]
- Updated dependencies [4fb8cbf]
- Updated dependencies [9249b26]
- Updated dependencies [ec44e4c]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
- Updated dependencies [29d293c]
- Updated dependencies [6cef61c]
- Updated dependencies [fcc5602]
- Updated dependencies [c3da788]
- Updated dependencies [ece64a6]
- Updated dependencies [fcc5602]
- Updated dependencies [bfc26b4]
- Updated dependencies [0046729]
- Updated dependencies [fcc5602]
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
- Updated dependencies [36dac61]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [daba59f]
- Updated dependencies [7a053e0]
- Updated dependencies [acb38fe]
- Updated dependencies [644baad]
- Updated dependencies [cbd9a26]
- Updated dependencies [8c2d558]
- Updated dependencies [af85c85]
- Updated dependencies [6a9cd12]
- Updated dependencies [af85c85]
- Updated dependencies [5d79d0e]
- Updated dependencies [43e65cf]
- Updated dependencies [e280844]
- Updated dependencies [f889447]
- Updated dependencies [b9a8c62]
- Updated dependencies [a3caa9d]
- Updated dependencies [1dc92ce]
- Updated dependencies [ced5841]
- Updated dependencies [4949266]
- Updated dependencies [9f6da2d]
- Updated dependencies [15a78d8]
- Updated dependencies [f54c013]
- Updated dependencies [2acda2a]
- Updated dependencies [1cc8fea]
- Updated dependencies [3588b89]
- Updated dependencies [9a45d4a]
- Updated dependencies [4f2ce5c]
- Updated dependencies [4e54b4e]
- Updated dependencies [2b26641]
- Updated dependencies [eec8a23]
- Updated dependencies [353033f]
- Updated dependencies [27f0928]
- Updated dependencies [a3f0833]
- Updated dependencies [0157b15]
- Updated dependencies [4f35254]
- Updated dependencies [0118cd0]
- Updated dependencies [70213a5]
- Updated dependencies [4f9848f]
- Updated dependencies [4c0bb1b]
- Updated dependencies [4dff167]
- Updated dependencies [514f6ad]
- Updated dependencies [d455bd2]
- Updated dependencies [11c9e5f]
- Updated dependencies [241446a]
- Updated dependencies [81cc3f8]
- Updated dependencies [e0a11e4]
- Updated dependencies [e280844]
- Updated dependencies [a7fd87a]
- Updated dependencies [0f0c7e5]
- Updated dependencies [ce89e1f]
- Updated dependencies [c4d419b]
- Updated dependencies [da7dd2e]
- Updated dependencies [8cbcaf4]
- Updated dependencies [2d649c0]
- Updated dependencies [5b84935]
- Updated dependencies [02900a7]
- Updated dependencies [308226e]
- Updated dependencies [b2ecf6d]
- Updated dependencies [8af195e]
- Updated dependencies [7459739]
- Updated dependencies [5d43ec9]
- Updated dependencies [57af464]
- Updated dependencies [2338cee]
- Updated dependencies [8882b53]
- Updated dependencies [174d6ef]
- Updated dependencies [a20fc8c]
- Updated dependencies [a2fbf00]
- Updated dependencies [e6871f1]
- Updated dependencies [1ad4f25]
- Updated dependencies [1eb7552]
- Updated dependencies [7863d23]
- Updated dependencies [de8f61d]
- Updated dependencies [ec23b4e]
- Updated dependencies [de8f61d]
- Updated dependencies [28b5165]
- Updated dependencies [ff70ebe]
- Updated dependencies [0f43324]
- Updated dependencies [f4b9a4a]
- Updated dependencies [adb1290]
- Updated dependencies [b98bad7]
- Updated dependencies [0d377ec]
- Updated dependencies [435c248]
- Updated dependencies [e1e7241]
- Updated dependencies [977164c]
- Updated dependencies [9aed377]
- Updated dependencies [c491f93]
- Updated dependencies [aadb086]
- Updated dependencies [09f0c86]
- Updated dependencies [d11dc30]
- Updated dependencies [5ad7bc0]
- Updated dependencies [481218b]
- Updated dependencies [f8172cf]
- Updated dependencies [e5395a6]
- Updated dependencies [cd7ffdb]
- Updated dependencies [8ced7e2]
- Updated dependencies [5ed6215]
- Updated dependencies [9cacd4b]
- Updated dependencies [f95e342]
- Updated dependencies [d6ba47e]
- Updated dependencies [fcc5602]
- Updated dependencies [fcc5602]
- Updated dependencies [880cbbf]
- Updated dependencies [2932eb2]
- Updated dependencies [c1a3072]
- Updated dependencies [968362b]
- Updated dependencies [f4bfab5]
- Updated dependencies [e6c888e]
- Updated dependencies [fcc5602]
- Updated dependencies [3cf6a17]
- Updated dependencies [56089ae]
- Updated dependencies [f544aeb]
- Updated dependencies [4f2d1e0]
- Updated dependencies [ece64a6]
- Updated dependencies [9c507b5]
- Updated dependencies [9c507b5]
- Updated dependencies [ff4504e]
- Updated dependencies [58f9d2e]
- Updated dependencies [c67bcfa]
- Updated dependencies [f04bbbc]
- Updated dependencies [0f60e3d]
- Updated dependencies [5124d5a]
- Updated dependencies [0f60e3d]
- Updated dependencies [3207a40]
- Updated dependencies [e49aa18]
- Updated dependencies [70076bc]
- Updated dependencies [6a9a3dc]
- Updated dependencies [3f553ff]
- Updated dependencies [5d75785]
- Updated dependencies [dd5a540]
- Updated dependencies [4a4d7c9]
- Updated dependencies [73f549e]
- Updated dependencies [73f549e]
- Updated dependencies [a13982c]
- Updated dependencies [52ee422]
- Updated dependencies [73f549e]
- Updated dependencies [4bcea5f]
- Updated dependencies [6fcc7aa]
- Updated dependencies [eb8fe62]
- Updated dependencies [e9613f8]
- Updated dependencies [f004638]
- Updated dependencies [52d9d64]
- Updated dependencies [e3c67e9]
- Updated dependencies [34090f0]
- Updated dependencies [03b9392]
- Updated dependencies [15e923d]
- Updated dependencies [5962dc2]
- Updated dependencies [5dae54d]
- Updated dependencies [0208a3b]
- Updated dependencies [bb7bb11]
- Updated dependencies [ee1de44]
- Updated dependencies [56fda8d]
- Updated dependencies [f88d616]
- Updated dependencies [1c2c1ac]
- Updated dependencies [1d8e163]
- Updated dependencies [e08d172]
- Updated dependencies [429e80c]
- Updated dependencies [002ff57]
- Updated dependencies [7a7ea82]
- Updated dependencies [9521334]
- Updated dependencies [12cfcfc]
- Updated dependencies [415e5b8]
- Updated dependencies [e68cb62]
- Updated dependencies [0ee2887]
- Updated dependencies [767af8a]
- Updated dependencies [fb702eb]
- Updated dependencies [c11f37e]
- Updated dependencies [e39dbc5]
- Updated dependencies [98d2f9a]
- Updated dependencies [cf2ad81]
- Updated dependencies [60c082d]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
- Updated dependencies [1f05956]
- Updated dependencies [a8efdf5]
- Updated dependencies [774e9cc]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [0d977b8]
- Updated dependencies [12816b7]
- Updated dependencies [aec0cec]
- Updated dependencies [5202a9f]
- Updated dependencies [174070d]
  - @weasel-js/geom@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/paint@2.0.0

## 1.19.1

### Patch Changes

- Updated dependencies [71c3f85]
- Updated dependencies [1691dec]
- Updated dependencies [b62d643]
- Updated dependencies [8562ebe]
  - @weasel-js/geom@1.19.1
  - @weasel-js/paint@1.19.1
  - @weasel-js/registry@1.19.1

## 1.19.0

### Patch Changes

- 63edf95: An arrowhead on a slanted edge is no longer culled while its tip is on screen, and its node's grab reach and paint box cover it.
  
  `markerReach` now measures how far a marker head reaches in any direction, not along its own axes.
  
  <!-- entry: fix visual -->
- 77cc6e1: The width tool finds the right edge on a path measured from an `origin`.
  
  `strokeEdgeNear` measures such a path where its line is, and an inner or outer stroke reads its inked side from the right point.
  
  <!-- entry: fix -->
- afa1429: A round- or square-capped dot more than 2^53 units from the origin is drawn instead of throwing from `tessellateStroke`.
  
  <!-- entry: rank=-5 fix -->
- 582dfcb: A `{ px }` stroke under an infinite scale keeps its dashes, rather than drawing solid.
  
  Its dashes and dash offset resolve as its width does, left as given, in `strokeAtScale`, `strokeToPath` and the renderer.
  
  <!-- entry: rank=-5 fix visual -->
- 5bc9b94: A `{ px }` stroke's per-vertex widths draw at their true size under a transform that stretches one axis more than the other.
  
  `populatePolylineWidths` given a `scale` splits each corner into two coincident points, one per edge, as a nib already does.
  
  <!-- entry: fix visual -->
- Updated dependencies [aaeec8d]
- Updated dependencies [65ee9a0]
- Updated dependencies [8c4c266]
- Updated dependencies [6ae419d]
- Updated dependencies [f8a6830]
- Updated dependencies [9ec70fe]
- Updated dependencies [d09a6c1]
- Updated dependencies [42e088a]
- Updated dependencies [214a57e]
- Updated dependencies [8a41dc2]
- Updated dependencies [433a5ad]
- Updated dependencies [b1309b2]
- Updated dependencies [01e5634]
- Updated dependencies [4ecaf12]
- Updated dependencies [3ed07dc]
- Updated dependencies [25b09cf]
- Updated dependencies [867f10c]
- Updated dependencies [d5a83f9]
- Updated dependencies [799636f]
- Updated dependencies [c09afdf]
- Updated dependencies [e36ca03]
- Updated dependencies [d83feb6]
- Updated dependencies [337b676]
- Updated dependencies [c2465cd]
- Updated dependencies [458e1c2]
- Updated dependencies [dd13518]
- Updated dependencies [b62813d]
- Updated dependencies [f68d93b]
- Updated dependencies [6321d2a]
- Updated dependencies [b1309b2]
- Updated dependencies [7a7c2ef]
- Updated dependencies [f718790]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [2bf3397]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [f0c159d]
- Updated dependencies [886642a]
- Updated dependencies [b1309b2]
- Updated dependencies [eaff448]
- Updated dependencies [b1309b2]
  - @weasel-js/geom@1.19.0
  - @weasel-js/paint@1.19.0
  - @weasel-js/registry@1.19.0

## 1.18.2

### Patch Changes

- 07205dd: A stroke whose width is 0 draws nothing, whatever its per-vertex widths and marker sizes, on every path.
  
  - The renderer draws no marker head for a stroke with no width. Before, a head given its own `size` was drawn on a line that drew nothing, where SVG and PDF export drew neither.
  - A node's stroke with no width is no longer hit by a click or hover within its per-vertex widths or its heads (`inkReach`), where nothing is drawn.
  - `strokeEdgeNear` answers `null` for a stroke with no width, so the Girth tool no longer finds or drags edges of a stroke that draws nothing.
  - `inkWidth`, the tessellator's test of whether a width puts down ink, is exported from `@weasel-js/stroke`.
  - `resolveStroke`'s docs no longer say a stroke with no width can draw through its per-vertex widths.
- Updated dependencies [30dd2dc]
- Updated dependencies [b188aea]
- Updated dependencies [07205dd]
  - @weasel-js/paint@1.18.2
  - @weasel-js/registry@1.18.2
  - @weasel-js/geom@1.18.2

## 1.18.1

### Patch Changes

- @weasel-js/geom@1.18.1
  - @weasel-js/paint@1.18.1
  - @weasel-js/registry@1.18.1

## 1.18.0

### Patch Changes

- fe6a382: Stroke, paint and alignment fixes:
  
  - A closed zero-length subpath (`M5 5Z`, `M5 5L5 5Z`) draws its round or square cap as a dot, as SVG strokes it.
  - A closed subpath's last vertex takes a mid marker.
  - An inner stroke at least as wide as a rect's narrower side fills the rect, as it does the same polygon, instead of turning the rect inside out and drawing outside it. `ribbonAligns` (stroke) and `alignedStrokeRectHolds` (paint) say when a rect's aligned ribbon is built in place.
  - An upright selection outline and the selection handles' outlines are aligned once; they were shifted for `align` and then shifted again by the renderer.
  - SVG export writes gradient stops in offset order, and a stop past 0..1 as the color the ramp has there, so the file reads back as the gradient the kit paints.
  - Interpolating two gradients pairs their stops by offset, not by list position.
- 89b2c65: Fixes from a second audit of the geometry kernel and stroking, on degenerate input:
  
  - `intersectSegments` reports where two collinear lines overlap when their points only round onto one line; it reported one crossing at an arbitrary place along them about a third of the time. A cut that doubles back along its own line no longer closes a degenerate loop when splitting a path.
  - `intersectRayAabb` and `Bvh.raycast` miss every box along a ray with a NaN component, as `intersectRayPlane` does; they hit every box at t = 0.
  - A length table measures a straight segment with a non-finite point as no distance, as it already measured such a curve; one bad point made the whole path's length NaN.
  - `resamplePath` reads a count that is not a finite number as no count; NaN dropped every anchor after the first, and Infinity never finished.
  - A dash offset that lands exactly on a zero-length dash draws its dot at the line's start, as the dash does anywhere else along the line.
- Updated dependencies [fe6a382]
- Updated dependencies [b7ef242]
- Updated dependencies [206b78d]
- Updated dependencies [a78c393]
- Updated dependencies [cfe8a8a]
- Updated dependencies [b93c1dd]
- Updated dependencies [d83476e]
- Updated dependencies [89b2c65]
- Updated dependencies [1e0adbb]
- Updated dependencies [2455bb4]
  - @weasel-js/paint@1.18.0
  - @weasel-js/geom@1.18.0
  - @weasel-js/registry@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [13c6f66]
  - @weasel-js/geom@1.17.3
  - @weasel-js/paint@1.17.3
  - @weasel-js/registry@1.17.3

## 1.17.2

### Patch Changes

- 32e0dd5: An inner or outer stroke on a rect with a negative width or height (a pose flipped by a drag past its opposite edge) stays on its own side of the rect. `alignedStrokeRect` used to shift such an axis the wrong way, so an outer stroke drew inside the rect along it and an inner one outside.
- caf38d2: New `strokeAtScale(stroke, scale)` in stroke resolves every `{ px }` length of a stroke at a view scale the way the renderer does: the width, each marker size, and the dashes of a `{ px }` width. `strokeToPath` now reads a `{ px }` stroke's dashes at its `scale` option, where it used to take them as world units. A node's stroked bounds, measured at a view scale without a screen map, now size a `{ px }` marker head at that scale instead of at 1.
- 33c0cbd: `Stroke.dashOffset` sets how far into `dash` each subpath starts, as SVG's `stroke-dashoffset` and Canvas2D's `lineDashOffset` do. A negative offset starts before the pattern's beginning, and a non-finite one reads as 0. The canvas, `writePdf` and `serializeSvg` all draw it. `parseSvg` reads `stroke-dashoffset`, which it used to drop with no warning, and `svgNodesToKitDrafts` and `svgStrokeFromKit` carry it. A `{ px }` stroke resolves the offset with its dash, `lerpStroke` interpolates it, and a stroke-mesh cache entry is keyed on it.
  
  New in `@weasel-js/paint`, and re-exported from `@weasel-js/core`: `dashPhase(pattern, phase)` wraps a phase into one cycle of a pattern, and `scaledDash(stroke, k)` scales a dash and its offset together. A trimmed stroke's PDF dash phase is now written wrapped into one cycle (`[4 2] 4 d` where it used to write `[4 2] 10 d`), which draws the same.
- f6e234a: `strokeToPath` reads a marker sized `{ px }` at its `scale` option, as it does a `{ px }` width. A head under any scale but 1 used to come back sized as though the view were at 1, along with the gap cut from the line under it.
- Updated dependencies [32e0dd5]
- Updated dependencies [dd926dc]
- Updated dependencies [019b877]
- Updated dependencies [47679f8]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
  - @weasel-js/paint@1.17.2
  - @weasel-js/geom@1.17.2
  - @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/geom@1.17.1
  - @weasel-js/paint@1.17.1
  - @weasel-js/registry@1.17.1

## 1.17.0

### Patch Changes

- c29b1f7: A round join where a path turns exactly 180° draws its half disc around the tip. The tessellator read a turn of exactly 180° as no turn at all, so a line that doubled straight back ended flat there, as if butt-capped.
- 8fd23c2: A stroke whose width is infinite or NaN tessellates to an empty mesh, as one of width zero does. It used to give a ribbon of non-finite vertices.
- 9f29268: An animating stroke trim no longer rebuilds a translucent, vertex-colored, gradient- or pattern-painted stroke too large to batch, one built in a stretched view's metric, nor any stroke's marker heads. Such a stroke is clipped from its one cached ribbon in the shader, as an opaque solid one already was, and paints each pixel once through the stencil, so it does not darken where its ribbon turns. An untrimmed stroke too large to batch draws from the same ribbon, so a tween that ends at the full stroke looks as the stroke does with its trim removed; a translucent one no longer darkens at a sharp turn, and a vertex-colored one gives a sharp turn's overlap to the segment before it rather than splitting it at the bisector. Heads are built once and drawn under the transform that places them, so a trim only moves them. A head's own paint (`MarkerEntry.fill` or `outline.paint` other than `'line'`) is now resolved against the head's unplaced box and turns with the head, as a node's box paint turns with the node, where it was resolved against the placed head's axis-aligned box.
  
  `@weasel-js/stroke` adds `markerPlacements`, `markerShape`, `markerPlacementMap` and `markerPolylines`, which say where each head goes without building it.
- 305c461: A zero-length dash that falls exactly on an open line's last point draws its round or square cap, as one mid-line does. It was dropped, so a round-capped `dash: [0, gap]` line whose length was a whole number of gaps had no dot at its end.
- a3ff22a: A round or square cap draws on a zero-length run, as SVG strokes one: a subpath such as `M5 5 L5 5`, and each zero-length dash, so a round-capped `dash: [0, gap]` draws a row of dots. Both drew nothing. A zero-length dash's square cap faces along its line; a zero-length subpath's faces the x axis.
- 15a5e1d: A zero-length subpath such as `M5 5 L5 5` places its start and end markers, facing along the x axis as SVG orients a head with no direction. Both were dropped. A lone moveto still places none.
- Updated dependencies [6539d70]
- Updated dependencies [b497b07]
- Updated dependencies [75ef6d9]
- Updated dependencies [12e9c39]
- Updated dependencies [9d25103]
- Updated dependencies [3b08834]
- Updated dependencies [ceff0c3]
- Updated dependencies [52fd33e]
- Updated dependencies [454e8e1]
  - @weasel-js/geom@1.17.0
  - @weasel-js/paint@1.17.0
  - @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- Updated dependencies [944faa2]
- Updated dependencies [847875c]
  - @weasel-js/geom@1.16.2
  - @weasel-js/paint@1.16.2
  - @weasel-js/registry@1.16.2

## 1.16.1

### Patch Changes

- 6b503a5: Seat a marker head the line stops short of on the shaft's cut end. The head's back now sits on the end of the shortened shaft and points along the shaft there, so a curving shaft enters the back of an arrowhead square instead of poking out its side; the tip lands the head's inset past the cut. The canvas, PDF, and outlined strokes place heads through `markerHeads`, and `markerSites` takes the insets as a new optional argument.
  
  SVG export follows the same rule: it cuts the stroked shaft back by each start and end head's inset and moves the head's `<marker>` reference point back to match, so any viewer's `orient="auto"` draws the head the way the canvas does. The element keeps its path as authored in `wzl:d`, and import reads it back, along with the kit marker it references. A mid marker, or an end too short to cut, references an unseated `-tip` def.
  
  PDF export strokes an inset-headed shaft natively, cut back by exact arc length, instead of filling a flattened outline, which showed facets on curves when zoomed. The cut is the new `insetPath` from `@weasel-js/stroke`, which the SVG writer uses too.
  
  A `TrialSceneCanvas` is now its trial's camera, so the lab header's zoom buttons, readout, and zoom keys drive a scene lab's view.
- b45f2cc: An animating `Stroke.trim` no longer rebuilds the stroke's ribbon every frame. For an opaque solid stroke too large to batch, the renderer builds the ribbon once, untrimmed, with an arc length on every vertex, and the trim clips it in the shader, so a tween changes a uniform; only the cut ends, a few triangles with their caps, and the marker heads are built per frame. A trim tween on a 1,000-anchor path now makes no ribbon rebuild after its first frame. Other trimmed strokes are still rebuilt trimmed: translucent ones, ones the batch takes, ones built in a stretched view's metric, vertex-colored ones, and any paint but a solid. `@weasel-js/stroke` exports what the clip is built from: `clipRibbon`, which builds the ribbon, and `clipWindow`, which turns a trim into the window of lengths to draw and the geometry for its cut ends.
- Updated dependencies [3afef45]
- Updated dependencies [5a2e82a]
- Updated dependencies [25a1ff7]
  - @weasel-js/geom@1.16.1
  - @weasel-js/registry@1.16.1
  - @weasel-js/paint@1.16.1

## 1.16.0

### Patch Changes

- 63056ee: A stroke can now draw only part of its path. `Stroke.trim` is a `StrokeTrim`, `{ start?, end?, pace? }`, and the stroke draws the stretch between `start` and `end` in the order the path was authored. Each edge is a `TrimAt`: a bare number is a fraction of the whole path, `{ length }` an absolute distance, `{ anchor }` a vertex index (`2.5` is halfway along the segment after anchor 2) and `{ subpath }` a subpath index. `pace` (`TrimPace`) says what a fraction is a fraction of: `'length'` (the default) moves at constant speed, and `'anchor'` gives every segment an equal share. An edge omitted is the path's start or end, and a window whose start is at or past its end draws nothing. Lengths are exact arc lengths in the path's own space, so the cut doesn't move with zoom or flattening tolerance. Tween `end` from 0 to 1 to draw a line on, then `start` after it to draw it off.
  
  `markerStart` and `markerEnd` sit at each visible run's ends, so an end arrow rides the growing line; a run cut from a closed subpath takes neither. `markerMid` shows on the vertices inside the window. Dashes keep the pattern the untrimmed stroke has, so drawing on reveals the pattern rather than sliding it. Picking hits only the visible part of the stored trim. SVG and PDF export write the visible geometry, with curves split rather than flattened. SVG also writes `stroke-dashoffset` where a run starts mid-pattern. Import recovers no trim. Outlined text ignores its stroke's trim, since each glyph is stroked on its own.
  
  To animate a trim without ops or undo, `Animator.trimOverrides` is a `TrimOverrideRegistry` (with `TrimOverride` and `TrimEdge`), read at draw time the way vertex-color overrides are. `<SceneCanvas animator>`, `<SceneViewCanvas animator>` and `MinimapCanvas` paint it and repaint when an override is set or cleared. `renderSceneToCanvas`, `renderSceneToPixels` and `createPathLayer` take `trimOverrides` beside `colorOverrides`. core exports both as one `PaintOverrides` type, which each of those argument types extends. `NodePaintCtx.trim` and `NodeInk.trim` carry a node's trim to its painter. In diagrams, `EdgeStyle.trim` trims an edge, and `DiagramViewProps.animator` animates it by the edge's scene node id. The draw.io, Mermaid and DOT writers warn when they drop a trim, and the scene reader reads it back.
  
  New exports:
  
  - paint: `StrokeTrim`, `TrimAt`, `TrimPace` and `strokeTrimKey`, a stable cache key per trim. core re-exports the three types.
  - geom: `lengthTable`, `pathLengthTable`, `LengthTable`, `LengthRun`, `LengthSpan`, `lengthAtAnchor`, `anchorAtLength`, `lengthAtSubpath`, `lengthAtSegmentFraction`, `closingAnchor` and `pointAtLength`: exact pen-order arc length over 2D or 3D runs of lines and Bézier curves. Also `curveSpan`, `lengthAtCurve`, `runSegments`, `CurvePosition` and `CurveSpan`, which name a place on a path as a segment and curve parameter so every flattening cuts at the same point. Also `segmentLength(coords, dim, a?, b?)` and `segmentTAtLength(coords, dim, length, total?)` over flat control points, and the new fields `StrokeHitTestOptions.span` and `Polyline.closeAnchor`. In `geom/tessellate`: `polylineAtCurve` and `PolylinePlace`. In `geom/3d`: `pointAtLength3`.
  - stroke: `resolveTrim`, `trimSpan`, `trimmedPath`, `TrimmedPath`, `trimmedRuns` and `TrimmedRun`. `splitForDash` takes an optional `phase`.
  - animator: `ColorOverrideRegistry.subscribe`.
  - svg: `SvgStroke.trim` and `SvgStroke.dashOffset`. svg now depends on `@weasel-js/stroke`.
  
  Breaking and behavior changes:
  
  - `buildSceneViewCommands` (core) takes a `PaintOverrides` object as its seventh argument instead of a `ColorOverrideRegistry`. Pass `{ colorOverrides }` where you passed the registry.
  - `ColorOverrideRegistry.has(id)` (animator) no longer counts a target that was asked for and never moved. It is true only for an override from `set`, or for a target an animation has committed.
  - `measurePath` and `pointAlongPath` (geom) now measure exact arc length rather than a flattening. Lengths and points move by up to a few hundredths of a unit on curved paths, and a label at 0.5 now sits where a trim at 0.5 cuts. `flattenTolerance` now affects only the headings and the `nearest` search.
  - Rounded corners are measured by their exact arc length rather than by a fixed 32-step table, so corner segment lengths change slightly.
  - `pathThroughPoseFrame` (geom) rounds a path's `corners` before applying a stretch or skew, as the renderer does, and returns them already rounded. A uniform frame still keeps them as corners.
  - `extractPolylines` records, in `closeAnchor`, the anchor of a closing point it drops as a duplicate of the first.
  - Diagram edges whose style sets no width now draw at `EDGE_STROKE_WIDTH`, 1.5, instead of 2 (`DEFAULT_EDGE_STROKE` and `themeEdgeStroke`).
  - `svgPaintFromKit`, `svgStrokeFromKit` and `SvgKitPose` moved to their own module in svg; they are still exported from the package root.
- f9cfd00: Degree and radian conversions in these packages use geom's `DEG_TO_RAD` and `RAD_TO_DEG` instead of
  writing `Math.PI / 180` out by hand. Results are unchanged up to floating-point rounding.
- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/paint@1.16.0
  - @weasel-js/geom@1.16.0
  - @weasel-js/registry@1.16.0

## 1.15.2

### Patch Changes

- a4138b6: `@weasel-js/geom` states the nearest point of a segment, point distance and lerp once, in any
  dimension, and every tier answers through that one rule.
  
  - `@weasel-js/geom/nd` adds `segmentT`, `closestPointOnSegment`, `pointSegmentDist`,
    `pointSegmentDist2`, `distance`, `distance2` and `lerp` over plain number arrays.
  - The root barrel adds `segmentT` and `pointSegmentDist` over loose scalars, which allocate nothing,
    beside the existing `pointSegmentDist2`; `distance`, `distance2` and `lerpPoint` over `Point`; and a
    scalar `lerp`.
  - `@weasel-js/geom/3d`'s `closestPointOnSegment` and `lerp` now go through the same rule, so a planar
    problem gets the same numbers in 2D, 3D and `nd`.
  
  A segment's parameter is clamped to [0, 1] and is 0 on a zero-length segment; at `t = 1` the nearest
  point is the far end exactly. `nearestOnLine` and the private copies in core's measurement hit test,
  animator's auto-skinning, diagram's route and label code, stroke's edge test, path-tools'
  extend-to-meet and guides' layout snaps now call these, so their distances can move by a rounding
  step (`Math.hypot` became a square root of the summed squares).
  
  Corner shapes (`cornerShapePieces`) now fit the true superellipse within `CORNER_FIT_TOLERANCE` for
  every finite `k`. Past `|k| ≈ 9` they strayed up to nine times the tolerance off the curve's straight
  legs, because the fit stepped in an angle that crowds those legs into less than a double resolves;
  it now steps evenly along each leg. The same corners draw with about a third fewer cubics.
- Updated dependencies [507f539]
- Updated dependencies [c6edab2]
- Updated dependencies [a4138b6]
- Updated dependencies [5a0375b]
- Updated dependencies [f1906a8]
- Updated dependencies [6544399]
- Updated dependencies [5f6111b]
  - @weasel-js/paint@1.15.2
  - @weasel-js/geom@1.15.2
  - @weasel-js/registry@1.15.2

## 1.15.1

### Patch Changes

- Updated dependencies [2992b55]
  - @weasel-js/geom@1.15.1
  - @weasel-js/paint@1.15.1
  - @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

- 51ca29e: A stroke's ribbon no longer covers the inside of a turn twice. The two segments meeting at a join used to overlap past
  the corner on the inside of the turn, so a translucent stroke blended twice there: half-transparent red read alpha 192
  inside each corner of a stroked square where Canvas2D reads 128, with every join. Their inner corners now move to where
  their inner edges cross, and the join is drawn as a fan from that point, for miter, bevel and round joins, on open and
  closed paths and along flattened curves. Where a turn is tighter than the stroke's half-width, so that the crossing lies
  past a segment's far end, the segments keep their corners and still overlap there.
- Updated dependencies [b7d362d]
- Updated dependencies [a95d3a4]
- Updated dependencies [30bf607]
- Updated dependencies [48b6c4c]
- Updated dependencies [fce0494]
  - @weasel-js/geom@1.15.0
  - @weasel-js/paint@1.15.0
  - @weasel-js/registry@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [4bba14d]
  - @weasel-js/registry@1.14.2
  - @weasel-js/geom@1.14.2
  - @weasel-js/paint@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/geom@1.14.1
  - @weasel-js/paint@1.14.1
  - @weasel-js/registry@1.14.1

## 1.14.0

### Patch Changes

- e1bbdcd: Diagram outlines are now a registrable table. `registerOutline(name, def)` adds a named outline (or shadows a built-in until disposed), `outlineFromD(d, opts)` builds one from unit-square SVG path data, and `outlineDetail` gives the strokes an outline draws over its fill. `Outline` widens to any registered name; an unregistered one paints as `rect` and warns once. Eleven built-ins join the flowchart seven: `roundRect`, `cylinder`, `document`, `note`, `cloud`, `triangle`, `octagon`, `folder`, `cube`, `actor`, and `doubleEllipse`. Each keeps its content box inside the visible shape, and `diagramShape` strokes a cylinder's rim, a note's fold, a folder's tab, a cube's front edges, and a double ellipse's inner ring.
  
  New stroke markers: the crow's-foot family `crow-one`, `crow-many`, `crow-zero-one`, `crow-one-many`, and `crow-zero-many`, and `triangle-hollow` for UML generalization. `KitMarkerKey` lists them.
  
  DOT, Mermaid, and draw-style XML read and write the new outlines and markers where the format has a counterpart. Mermaid's writer no longer throws on an outline it has no brackets for: it writes a rectangle and warns. draw-style XML reads `rounded=1` below the stadium arc as `roundRect`, a hollow `block` head as `triangle-hollow`, Mermaid reads `(text)` as `roundRect`, and DOT and Mermaid read a double circle as `doubleEllipse`. DOT reads `onormal` as `triangle-hollow`.
- 8e6ed97: A `PolygonPath` can carry an `origin`, the point its `coords` are measured from, in doubles; a `Mesh` built from one carries it too. This adds API. Far from 0 a float32 coordinate loses its fraction (at x = 262,144 it sits on a 1/32 grid, 2 px at 64x); measured from an origin beside the shape it keeps it. `PathBuilder.setOrigin(x, y)` builds such a path from points given in the path's own space.
  
  The renderer draws one where its origin puts it, batched or by its own draw, filled, stroked, clipped, and culled. `tessellate`, `tessellateStroke`, `markerHeads`, `strokeToPath`, `transformPath` and `boundsOfPath` honor it, and so does a node's stroked bounds.
- 78213f7: Add a built-in `dot` stroke marker, centered on its anchor rather than trailing back from it like every other built-in. It is the one to reach for as `markerMid`: a terminator such as `diamond` puts its tip on the interior vertex and its body behind it, which reads as off-center. `KitMarkerKey` gains `'dot'`, and `Stroke.markerMid`'s docs now say where a head's anchor lands.
- 0fc0e50: A thick stroke flattens its path so its edges, half a width out, stay within the flatten tolerance of the true ones,
  in place of capping every piece at 10° of turn. A bend whose edges sit far out still subdivides as finely as it
  needs; a wiggle smaller than the stroke no longer does, so a 4-wide stroke over 512 small curves flattens to 1,750
  points where it took 10,034. Breaking for callers of `extractPolylines`, `flattenCubicWithArcLen` and
  `flattenQuadraticWithArcLen`: the `maxTurn` option and argument are replaced by `offset`, the distance out from the
  path its outermost edge sits.
- Updated dependencies [e1bbdcd]
- Updated dependencies [e974dba]
- Updated dependencies [30582cb]
- Updated dependencies [2999820]
- Updated dependencies [b142892]
- Updated dependencies [6d5f7c2]
- Updated dependencies [14f8583]
- Updated dependencies [783756a]
- Updated dependencies [b0a55a6]
- Updated dependencies [e7fca17]
- Updated dependencies [a58fb4f]
- Updated dependencies [8e6ed97]
- Updated dependencies [6b1b532]
- Updated dependencies [9ef7751]
- Updated dependencies [2e4943e]
- Updated dependencies [8e2c8c8]
- Updated dependencies [78213f7]
- Updated dependencies [0fc0e50]
- Updated dependencies [dc6f83a]
- Updated dependencies [97d889f]
- Updated dependencies [9adc0cd]
- Updated dependencies [24e03ff]
- Updated dependencies [b43c94c]
- Updated dependencies [dfdc8a6]
- Updated dependencies [e23101b]
  - @weasel-js/paint@1.14.0
  - @weasel-js/geom@1.14.0
  - @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- Updated dependencies [7e5f9e3]
- Updated dependencies [c7516cd]
- Updated dependencies [8c39126]
- Updated dependencies [769eef8]
- Updated dependencies [4c113da]
  - @weasel-js/geom@1.13.0
  - @weasel-js/paint@1.13.0
  - @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- Updated dependencies [7e5f9e3]
- Updated dependencies [c7516cd]
- Updated dependencies [8c39126]
- Updated dependencies [769eef8]
- Updated dependencies [4c113da]
  - @weasel-js/geom@1.13.0-rc.0
  - @weasel-js/paint@1.13.0-rc.0
  - @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- 400b393: A dash whose entries are all zero, or that has a negative entry, strokes solid instead of hanging stroke tessellation. A dash with a NaN or infinite entry draws no stroke, and `@weasel-js/pdf` drops and reports the command holding it. `dashPattern` (`@weasel-js/paint`) is the one reading of a dash array that the tessellator, `strokeDashStyleOf` and the PDF writer share.
- 40d87f7: A dash pattern too fine for the path it strokes now strokes solid instead of making work without bound: `dashPattern` (`@weasel-js/paint`) takes the path's length and reads a pattern that would cut it into more than `MAX_DASH_RUNS` (100,000) dash and gap runs as `'solid'`. The tessellator decides this once per path, over every subpath, and `@weasel-js/pdf` writes no dash for the same strokes. `@weasel-js/stroke` exports `dashLength`, the length a pattern runs along a path.
- Updated dependencies [dbd6711]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [400b393]
- Updated dependencies [40d87f7]
- Updated dependencies [78f29de]
- Updated dependencies [2c52cc5]
- Updated dependencies [94ebd35]
- Updated dependencies [3bf5edb]
  - @weasel-js/geom@1.12.0
  - @weasel-js/paint@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- 15efc86: `trianglesToPath` joins a vertex lying on another triangle's edge into that edge before the union, so a mesh whose float32 vertices sit a hair off their neighbors' edges no longer leaves cracks. A stroke ribbon puts a join's pivot on its segments' ends, so `strokeToPath` and `offsetPath` answered hairline slivers beside every curve: `offsetPath` of a square with a round corner, grown by 10, gave six subpaths instead of one, and grown by the corner's radius it ran a spike into the interior. A 2,000-point zigzag stroked 6 wide, which made polygon-clipping throw ("Unable to find segment"), now outlines too.
- Updated dependencies [4d99526]
- Updated dependencies [13fc67f]
- Updated dependencies [50da815]
- Updated dependencies [0f455dc]
- Updated dependencies [15efc86]
- Updated dependencies [07b686c]
- Updated dependencies [041bc38]
- Updated dependencies [2b267d5]
- Updated dependencies [8f2c044]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [e1eeb08]
  - @weasel-js/geom@1.11.1
  - @weasel-js/paint@1.11.1
  - @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- 7162a7a: Corner shape: any corner anchor of a path takes a CSS `corner-shape`, and its radius can be changed later. Additive: `PolygonPath` gains `corners`, an optional `CornerSpec` (`{ shape, radius }`) per flat anchor index, where `shape` is one of the six `corner-shape` keywords (`square`, `squircle`, `round`, `bevel`, `scoop`, `notch`) or a finite `superellipse()` parameter, and `radius` is how far along each edge the cut starts. Following CSS Borders 4, every keyword is a point on one parameter, k: `square` is ∞, `squircle` 2, `round` 1, `bevel` 0, `scoop` -1, `notch` -∞. `cornerShapePieces(k, frame)` draws a corner for any k as the quarter superellipse `|u|^n + |v|^n = 1`, `n = 2^|k|`, spanned from the corner's center for k > 0 and from the outer corner for k < 0, fitted with cubics within `CORNER_FIT_TOLERANCE` of the setback and exact at k = 0, ±1, and ±∞. The command stream keeps the bare anchors, and `resolveCorners` expands the specs into plain geometry, each cut clamped so that the two cuts on a segment never overlap; `resolveCornersWithSources` also answers which source anchor each expanded anchor came from, and `remapPerAnchor` carries a per-anchor array across, so the renderer draws `vertexColors` on a cornered path with every point of a cut in its corner's color. Every reader of a path's geometry calls it first: tessellation, `extractPolylines`, the hit tests, `boundsOfPath`, `pathDistanceToPoint`, the booleans, `offsetPath`, the renderer's path draw, and `serializePathD`, which `@weasel-js/svg` now exports. A spec rides on its anchor through `pathToAnchors` / `anchorsToPath` (`PenAnchor.corner`), so anchor inserts and deletes keep it in place, and `transformPath` scales radii with the geometry. Also new: `cornerFrames` and `cornerFrameAt` (where each corner anchor can be cut, and how far), `withCorner`, `cornerAt`, `cornerSpecAt`, `cornerShapeK`, `cornerKeywordOf`, `isCornerShape`, `nextCornerShape`, and `CORNER_KEYWORDS`.
  
  `@weasel-js/path-tools` adds `cornerShapePreset` (and `createCornerShapePreset(style)`), which edits corners in path edit. Each corner anchor shows a widget just inside it, a small tile cut in the corner's shape, drawn and pressed as `corner:N` (matched by routing's new `isCornerWidget`) while chrome-caps shows `path-edit.corners`, which is on by default. A drag on one (`editCornerAction`) sets the corner's radius live and commits one undo step; pressing the widget of a selected anchor sets every selected corner. `cycleCornerShapeAction`, in the `anchors` group, steps the selected corners through the keywords, and `setCornersAction` sets their shape or radius from its `shape` and `radius` params, typed for `<SceneCanvas tune>`. `CORNER_CONTROLS`, `cornerControlsState`, `cornerControlsParams`, and the `useCornerControls` hook are a prefs-form panel over the selected corners: the keywords, a curvature slider from -4 to 4, and the radius, mixed where the corners differ.
  
  A path-edit extension's part (`PathEditPart`) can carry its own `hitRadiusPx` and a `standoff`, a screen-pixel push along a world-space normal, so it keeps its distance from the path at any zoom.
  
  A `PathEditHost` can own the anchor selection too, through optional `selectedAnchors` and `setSelectedAnchors`, so an app seeds which anchors start selected and shows what is selected. Giving a sharp corner a shape, through `setCorners` or `cycleCornerShape`, also gives it a radius: the call's own, or a quarter of the room the corner has.
- ebb8804: Booleans, Trim segment, Cut at crossings, and Offset path keep corner specs. Each works on what a path draws, its corners cut and spanned, and then folds every corner it left whole back into its anchor and spec, so the corner stays editable as a corner; a corner the operation cut into or moved stays as plain geometry. `keepCorners` and `restoreCorners` are the shared step, `cornerTraces` and `cornerCuts` say what each corner draws.
  
  Booleans used to ignore corner specs entirely and work on the sharp anchors. They now work on the rounded shape.
  
  Offset path keeps a corner where its offset is the same corner again, moved to where the offset edges meet and resized about the same center (`offsetCornerTraces`): a round corner at a right angle grows its radius by the distance. A corner whose offset is no longer its shape stays as plain geometry. At distance zero every corner is kept.
  
  `simplifyPath` no longer throws on a subpath with two coincident anchors.
- 3318cf7: `strokeEdgeNear` measures an inner- or outer-aligned stroke to the edge it
  draws: the one on its side of the path's fill, twice as far from the path as a
  centered stroke's, with `factor` doubled to match. The Girth tool used to grab
  such a stroke off its drawn edge.
- d705830: A stroke can be drawn with a broad nib. `Stroke.nib` is `{ angle, ratio }`: the nib's edge in radians counterclockwise on screen, and its thinnest width as a fraction of its widest. The stroke is its full width moving across the nib and `ratio` of that moving along it, an elliptical pen's width in between, and it multiplies `vertexWidths` where both are set. Each side of a corner keeps its own width, so a square drawn with a level nib has thin level sides and full upright ones right up to the joins; a round join's arc runs between the two. `strokeToPath`, the renderer's ribbon cache, and SVG export follow it, and since a nib only ever narrows a stroke, bounds and culling are unchanged. `@weasel-js/stroke` adds `nibWidthScale`, the nib as a `WidthScale`, and `widestStrokeWidth`, which culling, picking, and flattening now share; picking used to ignore `vertexWidths`. Draw's stroke properties gain a Nib switch with its angle and thinnest ratio.
  
  A `vertexWidths` entry is a `VertexWidth`: a number, the full width centered on the path as before, or a `{ left, right }` pair giving each edge its own distance from the path, `right` being the side the normal `(−dy, dx)` points to, below a path running in +x on screen. Every reader resolves an entry through `vertexHalfWidths(entry, fallback)` in `@weasel-js/paint`: the tessellator, which carries the difference between the sides as the new `Polyline.offsets` through trimming, dashing, and the nib, and centers caps between the two edges; `strokeToPath`; the inner and outer ribbon; bounds, culling, and picking, through `widestHalfWidth`; and SVG, which writes a pair as `left/right` in `wzl:vertex-widths`. `vertexWidthFromSides` writes equal sides back as a number, and `scaleVertexWidth` scales either form. An entry of zero is now a zero width; it used to take the stroke's `width`.
  
  `useGirthTool` (Shift+W), in `@weasel-js/path-tools`, edits `vertexWidths` by dragging the stroke's edges. Hovering near either edge marks the grab point on it and the width point a press there moves: the anchor at that spot, or one inserted between two with `insertAnchorOnSegment`, so the path keeps its shape. The grabbed edge follows the pointer along the path's normal and the other mirrors it, writing a number; dragging inward pinches the stroke, down to zero. Alt-drag moves the grabbed edge alone and writes a pair. The drag moves the edge as drawn, so under a nib the stored width changes by more. Every drag is previewed live and committed as one undo entry. Alt-click on a width point clears it, so it takes the stroke's `width` again. The stroke last touched shows its anchors, with a line across the stroke at each that has a width. `strokeEdgeNear` in `@weasel-js/stroke` is the hit test behind it: the edge of a stroke nearest a point, measured along the path's normal, with each side's distance as drawn.
  
  A dashed stroke now keeps its per-vertex widths, which it used to drop. The anchor-parameter rule that trimming and dashing share is `anchorParamsBetween` in `@weasel-js/geom/tessellate`.
  
  SVG has no variable width. `serializeSvg` writes a stroke with `vertexWidths` or a `nib` as its outline: the path keeps its stroke attributes at `stroke-width="0"`, which draws nothing, with the real width, the per-vertex widths, the nib, and its markers in the `wzl` namespace, and the outline follows as a filled path in the stroke's paint that draws the marker heads. A node with an opacity wraps both in one group carrying it, so they composite as one layer. Other viewers draw the outline; `parseSvg` drops it and reads the stroke back off the path, and a transform it bakes in scales the per-vertex widths with the width.
- Updated dependencies [304f53a]
- Updated dependencies [60d8e39]
- Updated dependencies [ed0e096]
- Updated dependencies [5338358]
- Updated dependencies [6072e93]
- Updated dependencies [53ba41a]
- Updated dependencies [7162a7a]
- Updated dependencies [765cd31]
- Updated dependencies [8374354]
- Updated dependencies [5adbb76]
- Updated dependencies [63b310c]
- Updated dependencies [ebb8804]
- Updated dependencies [fb75358]
- Updated dependencies [7cbedd8]
- Updated dependencies [c17c978]
- Updated dependencies [a4c99c1]
- Updated dependencies [c53b0ae]
- Updated dependencies [c4840ed]
- Updated dependencies [616a4b2]
- Updated dependencies [0677769]
- Updated dependencies [974682d]
- Updated dependencies [7afe8cd]
- Updated dependencies [71c079d]
- Updated dependencies [dcca70c]
- Updated dependencies [5f12888]
- Updated dependencies [d18df3e]
- Updated dependencies [46c731d]
- Updated dependencies [36eca7a]
- Updated dependencies [c1680fd]
- Updated dependencies [0430dcc]
- Updated dependencies [1be2ea9]
- Updated dependencies [c2048de]
- Updated dependencies [9073669]
- Updated dependencies [f082c83]
- Updated dependencies [db8c16e]
- Updated dependencies [4df0749]
- Updated dependencies
- Updated dependencies [365ab72]
- Updated dependencies [7a31f9d]
- Updated dependencies [4cec295]
- Updated dependencies [1faab2d]
- Updated dependencies [d705830]
- Updated dependencies [329aa39]
  - @weasel-js/registry@1.11.0
  - @weasel-js/geom@1.11.0
  - @weasel-js/paint@1.11.0

## 1.10.1

### Patch Changes

- cbd5b4d: `@weasel-js/geom`'s six-number affine type is `Affine`, no longer `Mat3`. It sat one capital letter from `mat3`, the namespace over the nine-element column-major `GlMat3` a GL uniform takes, and the two are different matrices. `mat3.toAffine` and `mat3.fromAffine` already named the conversion this way.
  
  Breaking: `import type { Mat3 } from '@weasel-js/geom'` becomes `import type { Affine }`. The values are unchanged, and so are the free functions beside the type (`identity`, `multiply`, `invert`, and the rest).
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- d8b51a4: Geometry for the path commands. `simplifyPath(path, tolerance)` refits a path with as few anchors as hold it within the tolerance, keeping corners, the ends of open subpaths, and long flats between curves. `snipPathsAtCrossings(paths)` (in `@weasel-js/geom/booleans`) cuts each path's stroke wherever another of them crosses it. `averageAnchorsAt` moves anchors to their mean position on one or both axes, and `joinAnchorsAt` / `joinSubpathEnds` join two open-subpath ends, closing a subpath or merging two, with `subpathEndAt` and `closestOpenEnds` to find them. In `@weasel-js/stroke`, `offsetPath(path, distance)` grows or shrinks the region a path fills, taking a stroke's miter, round, or bevel joins, and refits the result as curves.
- ab9ea7a: A stroke more than twice as wide as the flatten tolerance now flattens its curves in steps of at most 10°. Before, a tight bend under a thick stroke took steps of 40° or more and showed visible facets on the stroke's edges. Thinner strokes still flatten on the same vertices as their fill. `extractPolylines` takes a new `maxTurn` option, and `flattenCubicWithArcLen` and `flattenQuadraticWithArcLen` take a trailing `maxTurn` argument.
- Updated dependencies [cbd5b4d]
- Updated dependencies [aaa2b4f]
- Updated dependencies [c7b7ed5]
- Updated dependencies [ee59ccd]
- Updated dependencies [9eefcc7]
- Updated dependencies [886380f]
- Updated dependencies [d8b51a4]
- Updated dependencies [62e766c]
- Updated dependencies [ab9ea7a]
- Updated dependencies [e962494]
  - @weasel-js/geom@1.10.1
  - @weasel-js/paint@1.10.1
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- 9c19d5e: stroke: a new package holding a stroke as geometry, moved out of core. `tessellateStroke` and `resolveStrokeWidth` build the ribbon mesh; `registerMarker`, `getMarker`, `listMarkers`, `markerRegistry`, `markerGeneration`, and `BUILTIN_MARKERS` are the marker registry; `markerSites`, `markerHeads`, `markerInset`, `markerKeyOf`, `resolveMarkerSize`, `strokeInsets`, and `markerReach` place and measure marker heads; `strokeToPath` outlines the whole stroke as a path. It depends on `@weasel-js/geom`, `@weasel-js/paint`, and `@weasel-js/registry`, and has no scene and no React.
  
  The stroke metric functions the renderer uses are exported here too (`strokeSpaceOf`, `polylineIntoMetric`, `coordsOutOfMetric`, and the rest, with `StrokeMetric`, `ScreenSpace`, and `StrokeSpaces`), as are `splitForDash`, `populatePolylineWidths`, `trimInSpace`, `markerHeads`, `markerReadsKey`, and `markerReach`. These were not exports of `@weasel-js/core` before; they are additions. `_resetMarkersForTests` is at `@weasel-js/stroke/test-seams`.
  
  `@weasel-js/core` still exports every name it did before.
- bf9a262: Adds API: `strokeToPath`'s options take `frame`, the matrix from the frame a stroke is drawn in to the path's coordinates. The outline is built in that frame and carried back through it, so a stroke under a pose `transform` comes out skewed or stretched the way the canvas draws it, and a `{ px }` width under a view that scales each axis apart holds its thickness on screen when the frame is the inverse of the view's scale. A frame that cannot be inverted gives an empty path. Nothing in core passes it yet.
- Updated dependencies [a86d79f]
- Updated dependencies [1837952]
- Updated dependencies [126116b]
- Updated dependencies [b1f7521]
- Updated dependencies [18547a3]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [b260415]
- Updated dependencies [54174b6]
- Updated dependencies [4edad85]
- Updated dependencies [335f192]
- Updated dependencies [7b9de2d]
- Updated dependencies [ea54a64]
- Updated dependencies [955defa]
- Updated dependencies [27b827e]
- Updated dependencies [ee08fa5]
- Updated dependencies [54242f0]
- Updated dependencies [46fcc7e]
- Updated dependencies [a297730]
  - @weasel-js/geom@1.10.0
  - @weasel-js/paint@1.10.0
  - @weasel-js/registry@1.10.0
