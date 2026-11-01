# @weasel-js/stroke

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
