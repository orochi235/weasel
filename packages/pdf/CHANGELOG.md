# @weasel-js/pdf

## 1.19.0

### Patch Changes

- 1ba5d83: A dash whose every length rounds to 0 in a PDF strokes solid, as in the renderer, instead of drawing nothing.
  
  <!-- entry: rank=-5 fix visual -->
- 048b375: A PDF leaves out and reports an image whose host pixels, from `readPixels` or `rasterize`, are the wrong size.
  
  The report reads `image has the wrong number of pixels`. A bitmap needs a whole number of pixels each way, at least one, and four bytes for each.
  
  <!-- entry: fix -->
- 1ba5d83: A stroke with a miter limit below 1 is written to PDF with a limit of 1, which bevels every corner as the renderer does.
  
  <!-- entry: rank=-5 fix -->
- ee3cfe4: Groups nested past 512 deep are left out of the PDF page and reported, as the SVG reader caps nesting, instead of failing the whole file.
  
  <!-- entry: fix -->
- 1ba5d83: A path or group clip holding a non-finite coordinate is dropped from the PDF and reported, instead of possibly throwing out of `writePdf`.
  
  <!-- entry: rank=-5 fix -->
- 54f3c97: The PDF writer's number formatter keeps a whole number's trailing zeros when asked for no decimals; no file it writes changes.
  
  <!-- entry: internal -->
- f39af93: `writePdf` refuses a page whose width or height is not finite or would be written as 0, naming the page (`pdf: page 2 is 0 by 0.001; …`).
  
  <!-- entry: fix -->
- 1ba5d83: A PDF writes numbers as finely as the transforms around them need, so a group scaled far down or up draws where it should.
  
  Each matrix keeps four decimals of each axis's own scale, and coordinates, dashes and gradient geometry under a group scaled up keep their position to 1e-4 of a page unit. A texture tile far smaller or larger than a unit is written as a unit tile its pattern matrix scales.
  
  <!-- entry: fix visual -->
- b368c65: Text in a TrueType face whose tables the PDF subsetter cannot read whole is drawn as outlines instead of failing the file.
  
  <!-- entry: fix -->
- Updated dependencies [aaeec8d]
- Updated dependencies [65ee9a0]
- Updated dependencies [2595ad3]
- Updated dependencies [8c4c266]
- Updated dependencies [6ae419d]
- Updated dependencies [c5202b9]
- Updated dependencies [f8a6830]
- Updated dependencies [9ec70fe]
- Updated dependencies [d09a6c1]
- Updated dependencies [a5c9cf0]
- Updated dependencies [0717d38]
- Updated dependencies [0dd9f6e]
- Updated dependencies [88147f8]
- Updated dependencies [e97950f]
- Updated dependencies [874d96f]
- Updated dependencies [1b65290]
- Updated dependencies [309adac]
- Updated dependencies [0a8d096]
- Updated dependencies [4355423]
- Updated dependencies [9ce04e0]
- Updated dependencies [5bd979f]
- Updated dependencies [ca98945]
- Updated dependencies [b0e09ef]
- Updated dependencies [9975edb]
- Updated dependencies [88b4697]
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
- Updated dependencies [33bca4e]
- Updated dependencies [d83feb6]
- Updated dependencies [63edf95]
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
- Updated dependencies [f0c159d]
- Updated dependencies [043db55]
- Updated dependencies [886642a]
- Updated dependencies [b1309b2]
- Updated dependencies [ebab03f]
- Updated dependencies [eaff448]
- Updated dependencies [3bedaa8]
- Updated dependencies [77cc6e1]
- Updated dependencies [afa1429]
- Updated dependencies [582dfcb]
- Updated dependencies [204596e]
- Updated dependencies [c3dc307]
- Updated dependencies [2a9727c]
- Updated dependencies [521bc15]
- Updated dependencies [997e4f3]
- Updated dependencies [12f254e]
- Updated dependencies [4224853]
- Updated dependencies [4e6aad8]
- Updated dependencies [01b996e]
- Updated dependencies [b1309b2]
- Updated dependencies [5bc9b94]
- Updated dependencies [6999cce]
- Updated dependencies [4d16c8a]
  - @weasel-js/geom@1.19.0
  - @weasel-js/renderer@1.19.0
  - @weasel-js/text@1.19.0
  - @weasel-js/font@1.19.0
  - @weasel-js/stroke@1.19.0
  - @weasel-js/paint@1.19.0

## 1.18.2

### Patch Changes

- fc38c90: Fixes to pattern tiles, text bounds, markdown layout and pasted tables, and the image cache closes the bitmaps it drops.
  
  - A `chunks` tile whose `chunkSize` is zero, negative or NaN, or whose `density` is infinite, scatters no chunks. Before, a zero size looped forever building the tile and hung the page, and a negative one threw from the canvas. A `dots` tile with a negative or NaN `radius` draws no dot rather than throwing.
  - A text command's painted bounds reach each glyph's pen step as well as its advance, so a retained group no longer cuts off the end of an underline, strikethrough or overline that letter spacing carries past the last letter.
  - `layoutMarkdown` measures its width without spreading every line into one call, which overflowed the stack on a text of a million lines or so.
  - A pasted table row keeps a tab for each empty cell before a cell with text, so `a`, an empty cell and `b` paste as `a\t\tb` rather than `a\tb`.
  - The image cache owns its bitmaps and closes each one it drops: evicted to fit its budget, released with `releaseImage`, replaced by a sharper SVG raster, or landing for a load already released. Before, it dropped them without closing them, leaving their memory until garbage collection. **A bitmap taken from the cache with `getImageBitmap` is valid only until the cache drops it**, so read it again each frame rather than keep it. A draw command still holding a closed bitmap draws nothing. Work that holds draw commands across an `await` can call the new `holdImageBitmaps()` (from `@weasel-js/renderer` and `@weasel-js/core`), which keeps what the cache drops open until the hold is released; `writePdf`, `exportPagesPdf` and `sceneToLbx` hold one themselves. A `bitmapSrc` bitmap is still its maker's and is never closed.
- 30dd2dc: Fixes to PDF texture fills, retained bounds, canvas readback, SVG lengths and runtime bitmaps, hex colors and pattern tiles.
  
  - `writePdf` looks a texture paint up as the renderer does, so an image paint (`{ kind: 'image', src }`) the renderer has not drawn yet, and a tile pattern evicted from its cache, export instead of being skipped. A texture paint's `width` and `height` set the tile's size in the PDF, as they do on the canvas; it used to tile at the texture's pixel size. `getTexture` and `tileExtent` are exported from `@weasel-js/renderer` for this.
  - A path with no points and a sprites run of no sprites bound as empty, so neither stretches a retained surface, or a PDF group rasterized for its effects, to the whole buffer.
  - `WeaselRenderer.readPixels` and `readPixelsSync` throw a `RangeError` for a rect that is not whole device pixels. Such a rect used to come back with its rows misplaced.
  - `parseSvg` reads a length too large to hold (`width="1e400"`, `letter-spacing="1e400"`, `stroke-width="1e400"`) as unset, where it read an infinity.
  - `byteHex`, and every hex color written through it (`rgbaToHex`, `lerpPaint`, `colorLiteralToHex`), writes a NaN channel as `00`. It used to write the letters `NaN`, which nothing parses back.
  - A tile pattern whose `size` holds no whole pixel (0, a fraction below 1, negative, NaN, infinite) resolves no texture and draws nothing. In Chromium it used to throw out of the painter that resolved it.
  - `serializeSvg` writes an image, or an image pattern, drawn from a `bitmapSrc` bitmap (a canvas snapshot, a video frame) as a PNG data URL, so the exported file shows it. It used to write the bitmap's runtime name, which no other document can load. Where no 2D canvas can draw the bitmap (no DOM, a closed bitmap) it keeps the name and warns. `isBitmapSrc` is exported from `@weasel-js/core` alongside `bitmapSrc`.
- Updated dependencies [348fb68]
- Updated dependencies [fc38c90]
- Updated dependencies [30dd2dc]
- Updated dependencies [07205dd]
  - @weasel-js/renderer@1.18.2
  - @weasel-js/text@1.18.2
  - @weasel-js/paint@1.18.2
  - @weasel-js/stroke@1.18.2
  - @weasel-js/font@1.18.2
  - @weasel-js/geom@1.18.2

## 1.18.1

### Patch Changes

- dd5b82a: Fixes to PDF output, SVG transform reading, the Mermaid and draw.io round trips, and the d3 binding's docs.
  
  - `writePdf` writes no fill for a path whose fill covers nothing (no commands, or only open subpaths under `openFill: 'none'`), and clips such a path to an empty rectangle. Before, it wrote a painting or clipping operator with no path, which PDF has no meaning for.
  - Mermaid text reads `&` only as the start of an HTML reference (`&amp;`, `&#65;`) and `#` only as the start of Mermaid's (`#quot;`, `#65;`). Text such as `&65;` or `&x41;` no longer reads back as `A`, and `##65;` keeps its first `#`.
  - Mermaid sequence text escapes an `&` before a `#`, so a message reading `&#65;` reads back as written instead of as `#65;`.
  - A Mermaid quadrant chart point named like a statement (`title Outlier`, `x-axis drift`, `accTitle`, `%% note`) is written quoted, so it reads back as a point instead of as a title, an axis, accessibility text or a comment. A quoted quadrant name or label is escaped like other Mermaid text, so one holding a literal `#35;` or `#quot;` reads back as written.
  - draw.io end labels are written as plain text (`html=0`), so a label holding `<b>` or `&amp;` reads back, and draws in draw.io, as written instead of as markup.
  - Mermaid pie, packet and xychart labels and titles are escaped like every other Mermaid text, so a label holding a literal `#quot;`, `#35;` or `<b>` reads back as written. Reading their quoted text now decodes every Mermaid and HTML reference, not only `#quot;`.
  - `parseSvg` ignores a `transform` list that does not parse whole, as browsers do: an unknown function, a function with the wrong number of arguments (`matrix()` short of six, `rotate(30 5)`), an argument that is not a plain number (`translate(10px)`), or text between functions. Before, it applied the functions it could read. The warning now says which of these it was; only an unknown function is reported as unsupported.
  - `BindOptions.layer` documents its default as the first of `scene.layers`, which is what `join()` uses, rather than the first system layer.
- Updated dependencies [c9fb4d6]
  - @weasel-js/font@1.18.1
  - @weasel-js/renderer@1.18.1
  - @weasel-js/text@1.18.1
  - @weasel-js/geom@1.18.1
  - @weasel-js/paint@1.18.1
  - @weasel-js/stroke@1.18.1

## 1.18.0

### Patch Changes

- b7ef242: Fix SVG import and PDF path output found in an audit.
  
  - `writePdf` places a path measured from an origin (far from 0) at its own coordinates instead of offset by the origin.
  - `parseSvg` reads `<rect>` `rx`/`ry` as SVG 2 does: a missing or negative radius takes the other's value, the two stay independent, each is clamped to half its own side, and either one at 0 gives square corners.
  - `parseSvg` gives an `<ellipse>` radius left out the other's value.
  - `pathFromD` reads a form feed between arc arguments as whitespace.
  - `parseSvg` multiplies a color's own alpha by `fill-opacity` / `stroke-opacity` rather than replacing it.
  - `parseSvg` reads `fill-opacity` and a color's alpha on `<text>` and `<tspan>`, and `serializeSvg` writes a run's fill opacity.
  - `serializeSvg`'s default `viewBox` boxes each path's stroke and marker heads, not just its geometry, so a stroked shape at the edge keeps the outer half of its stroke. Core exports `strokedBounds`, the box a stroke covers along a path, which it measures with.
- Updated dependencies [fe6a382]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [206b78d]
- Updated dependencies [e405e70]
- Updated dependencies [a78c393]
- Updated dependencies [cfe8a8a]
- Updated dependencies [082fa2f]
- Updated dependencies [b93c1dd]
- Updated dependencies [5f9b5d0]
- Updated dependencies [d83476e]
- Updated dependencies [89b2c65]
- Updated dependencies [d025e1b]
- Updated dependencies [c675905]
- Updated dependencies [1e0adbb]
- Updated dependencies [2455bb4]
  - @weasel-js/stroke@1.18.0
  - @weasel-js/paint@1.18.0
  - @weasel-js/renderer@1.18.0
  - @weasel-js/geom@1.18.0
  - @weasel-js/font@1.18.0
  - @weasel-js/text@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [13c6f66]
  - @weasel-js/geom@1.17.3
  - @weasel-js/renderer@1.17.3
  - @weasel-js/stroke@1.17.3
  - @weasel-js/text@1.17.3
  - @weasel-js/font@1.17.3
  - @weasel-js/paint@1.17.3

## 1.17.2

### Patch Changes

- 35c291a: SVG export and PDF read a stroke's `dash` through `dashPattern`, the rule the canvas uses, so the three draw the same thing:
  
  - `serializeSvg` strokes solid a dash too fine for its path's whole, untrimmed length, and an all-zero or negative one, where it used to write the `stroke-dasharray` as given. A leaf whose group's dash it would otherwise inherit states `stroke-dasharray="none"`.
  - A dash with a non-finite entry draws no line in either writer, and its marker heads still draw. The PDF writer used to drop the whole path, its fill included, and report a skip. `serializeSvg` used to write NaN as `0`, a solid line. A text run's stroke with such a dash draws nothing.
  
  `dashPattern` is now exported from `@weasel-js/core` as well as `@weasel-js/paint`.
- 1a6ad20: `writePdf` draws no marker heads on a text stroke it writes as glyph outlines (an aligned stroke, a gradient one, or faked bold), as the canvas draws none on text. A `markerMid` used to put a head on every vertex of every glyph.
- 33c0cbd: `Stroke.dashOffset` sets how far into `dash` each subpath starts, as SVG's `stroke-dashoffset` and Canvas2D's `lineDashOffset` do. A negative offset starts before the pattern's beginning, and a non-finite one reads as 0. The canvas, `writePdf` and `serializeSvg` all draw it. `parseSvg` reads `stroke-dashoffset`, which it used to drop with no warning, and `svgNodesToKitDrafts` and `svgStrokeFromKit` carry it. A `{ px }` stroke resolves the offset with its dash, `lerpStroke` interpolates it, and a stroke-mesh cache entry is keyed on it.
  
  New in `@weasel-js/paint`, and re-exported from `@weasel-js/core`: `dashPhase(pattern, phase)` wraps a phase into one cycle of a pattern, and `scaledDash(stroke, k)` scales a dash and its offset together. A trimmed stroke's PDF dash phase is now written wrapped into one cycle (`[4 2] 4 d` where it used to write `[4 2] 10 d`), which draws the same.
- Updated dependencies [32e0dd5]
- Updated dependencies [dd926dc]
- Updated dependencies [c089c61]
- Updated dependencies [cc591ff]
- Updated dependencies [e6e7a72]
- Updated dependencies [d162fbb]
- Updated dependencies [019b877]
- Updated dependencies [47679f8]
- Updated dependencies [fce3d09]
- Updated dependencies [d12d868]
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
- Updated dependencies [f6e234a]
- Updated dependencies [d3654a1]
  - @weasel-js/paint@1.17.2
  - @weasel-js/stroke@1.17.2
  - @weasel-js/geom@1.17.2
  - @weasel-js/text@1.17.2
  - @weasel-js/renderer@1.17.2
  - @weasel-js/font@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/font@1.17.1
  - @weasel-js/geom@1.17.1
  - @weasel-js/paint@1.17.1
  - @weasel-js/renderer@1.17.1
  - @weasel-js/stroke@1.17.1
  - @weasel-js/text@1.17.1

## 1.17.0

### Patch Changes

- Updated dependencies [13ca1ea]
- Updated dependencies [d3820c9]
- Updated dependencies [7e3d359]
- Updated dependencies [6539d70]
- Updated dependencies [b497b07]
- Updated dependencies [75ef6d9]
- Updated dependencies [12e9c39]
- Updated dependencies [9d25103]
- Updated dependencies [3b08834]
- Updated dependencies [ceff0c3]
- Updated dependencies [d5cc782]
- Updated dependencies [e3a95da]
- Updated dependencies [ee9bc7f]
- Updated dependencies [52fd33e]
- Updated dependencies [3517855]
- Updated dependencies [8e888a9]
- Updated dependencies [ee7d8ce]
- Updated dependencies [cb58393]
- Updated dependencies [5b39acd]
- Updated dependencies [c29b1f7]
- Updated dependencies [454e8e1]
- Updated dependencies [e78e03c]
- Updated dependencies [e95d9fc]
- Updated dependencies [8fd23c2]
- Updated dependencies [9f29268]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [df080bc]
- Updated dependencies [305c461]
- Updated dependencies [a3ff22a]
- Updated dependencies [15a5e1d]
  - @weasel-js/renderer@1.17.0
  - @weasel-js/geom@1.17.0
  - @weasel-js/paint@1.17.0
  - @weasel-js/stroke@1.17.0
  - @weasel-js/font@1.17.0
  - @weasel-js/text@1.17.0

## 1.16.2

### Patch Changes

- Updated dependencies [944faa2]
- Updated dependencies [8f2e1e1]
- Updated dependencies [12d3c17]
- Updated dependencies [847875c]
  - @weasel-js/renderer@1.16.2
  - @weasel-js/geom@1.16.2
  - @weasel-js/stroke@1.16.2
  - @weasel-js/text@1.16.2
  - @weasel-js/font@1.16.2
  - @weasel-js/paint@1.16.2

## 1.16.1

### Patch Changes

- 25378d9: An exported PDF's Arabic text reads back as written when a mark sits on a word's last letter: `بَبَ بت` used to come back from pdf.js as `بَب َ بت` and from poppler (`pdftotext`) as `ب بتبَ َ`, and now comes back from both as `بَبَ بت`. Each right-to-left mark's code now has a width that takes the pen back to just before its base, so poppler puts the mark ahead of the base in its word. Where a mark follows a space, or that width moves the pen back, the text also carries one extra glyph, raised far off the page so neither reader takes it for text, whose kern puts pdf.js's pen back where pdf.js measures the word gap from. Every glyph is drawn where it was.
- 6b503a5: Seat a marker head the line stops short of on the shaft's cut end. The head's back now sits on the end of the shortened shaft and points along the shaft there, so a curving shaft enters the back of an arrowhead square instead of poking out its side; the tip lands the head's inset past the cut. The canvas, PDF, and outlined strokes place heads through `markerHeads`, and `markerSites` takes the insets as a new optional argument.
  
  SVG export follows the same rule: it cuts the stroked shaft back by each start and end head's inset and moves the head's `<marker>` reference point back to match, so any viewer's `orient="auto"` draws the head the way the canvas does. The element keeps its path as authored in `wzl:d`, and import reads it back, along with the kit marker it references. A mid marker, or an end too short to cut, references an unseated `-tip` def.
  
  PDF export strokes an inset-headed shaft natively, cut back by exact arc length, instead of filling a flattened outline, which showed facets on curves when zoomed. The cut is the new `insetPath` from `@weasel-js/stroke`, which the SVG writer uses too.
  
  A `TrialSceneCanvas` is now its trial's camera, so the lab header's zoom buttons, readout, and zoom keys drive a scene lab's view.
- Updated dependencies [3afef45]
- Updated dependencies [5a2e82a]
- Updated dependencies [3905b08]
- Updated dependencies [6b503a5]
- Updated dependencies
- Updated dependencies [b45f2cc]
  - @weasel-js/geom@1.16.1
  - @weasel-js/renderer@1.16.1
  - @weasel-js/stroke@1.16.1
  - @weasel-js/text@1.16.1
  - @weasel-js/font@1.16.1
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
- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/paint@1.16.0
  - @weasel-js/geom@1.16.0
  - @weasel-js/stroke@1.16.0
  - @weasel-js/renderer@1.16.0
  - @weasel-js/text@1.16.0
  - @weasel-js/font@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [507f539]
- Updated dependencies [c6edab2]
- Updated dependencies [a4138b6]
- Updated dependencies [5a0375b]
- Updated dependencies [f1906a8]
- Updated dependencies [6544399]
- Updated dependencies [5f6111b]
  - @weasel-js/paint@1.15.2
  - @weasel-js/geom@1.15.2
  - @weasel-js/stroke@1.15.2
  - @weasel-js/text@1.15.2
  - @weasel-js/renderer@1.15.2
  - @weasel-js/font@1.15.2

## 1.15.1

### Patch Changes

- d2110bc: A baked atlas or canvas face is now shaped when its font file is registered too: call
  `registerFontOutlines` for the same family and variant beside `registerFont` or `registerCanvasFont`,
  and a registered shaper reads that file. A letter the shaping leaves as its own glyph still draws from
  the atlas. A shaped cluster (a Devanagari conjunct, an Arabic joining form, a placed mark) draws from
  its outline, and on a canvas face below the outline size from one tile the canvas tier bakes from that
  outline (`DynamicFace.requestShaped`). A baked atlas must be cut from the same file, or its advances
  disagree with the shaper's. PDF export writes such text as the shaped glyphs, where it used to leave
  the clusters out.
  
  A bracket that gives up its shaped glyph on an atlas face now draws its own glyph rather than nothing.
- 937167e: Shaped text in an exported PDF reads back as written in pdf.js and poppler more often. A glyph drawn for
  two different texts (the ka under a Devanagari i-matra and a lone ka) now takes a separate code for
  each, mapped to the same glyph, so `/ToUnicode` reads `किक` back as `किक` rather than `किकक`. A
  cluster's text goes on its widest glyph, a mark the shaper gave no advance moves the pen nowhere, and a
  right-to-left cluster's glyphs that stand for no text are drawn after the rest of the line in one span,
  so pdf.js keeps right-to-left text in one piece and poppler no longer sets a fatha off as a word.
  
  `ShapedCluster.glyphs` entries carry the shaper's `advance`.
- Updated dependencies [d2110bc]
- Updated dependencies [2992b55]
- Updated dependencies [937167e]
  - @weasel-js/font@1.15.1
  - @weasel-js/text@1.15.1
  - @weasel-js/geom@1.15.1
  - @weasel-js/renderer@1.15.1
  - @weasel-js/stroke@1.15.1
  - @weasel-js/paint@1.15.1

## 1.15.0

### Patch Changes

- 8612dd7: A shaped cluster's glyphs that stand for no text of their own (an Arabic letter's dotless body, the consonant under a Devanagari i-matra) now map to U+2060 WORD JOINER in `/ToUnicode`, and the glyph after one is placed with `Td`. pdf.js, which ignores `/ActualText`, read such a glyph as a control character (`بت` came back as `\u0007ت ب`) and now reads `تب`; readers that honor `/ActualText` read the same text as before.
- Updated dependencies [2bdba7b]
- Updated dependencies [3f13a49]
- Updated dependencies [719d457]
- Updated dependencies [d40f593]
- Updated dependencies [b7d362d]
- Updated dependencies [a95d3a4]
- Updated dependencies [e05ddd3]
- Updated dependencies [30bf607]
- Updated dependencies [48b6c4c]
- Updated dependencies [a1cb281]
- Updated dependencies [fbc7ebf]
- Updated dependencies [d25ad30]
- Updated dependencies [fce0494]
- Updated dependencies [51ca29e]
  - @weasel-js/renderer@1.15.0
  - @weasel-js/font@1.15.0
  - @weasel-js/text@1.15.0
  - @weasel-js/geom@1.15.0
  - @weasel-js/stroke@1.15.0
  - @weasel-js/paint@1.15.0

## 1.14.2

### Patch Changes

- 98c5c23: PDF export writes the document's language as the catalog's `/Lang`, and marks text in another language with
  its own `/Lang`, so a screen reader or text extraction no longer guesses it. `writePdf` and `exportPagesPdf`
  take the document's language as a new `lang` option; left out, it is the language every run of text shares,
  and the document has none when they do not share one. A run's language is its `lang`, or its text node's.
- Updated dependencies [012cae5]
- Updated dependencies [56f9771]
- Updated dependencies [3c3e00b]
- Updated dependencies [9b0c6ee]
- Updated dependencies [dedcb92]
- Updated dependencies [c5cba19]
- Updated dependencies [dec74a9]
- Updated dependencies [64b59af]
  - @weasel-js/renderer@1.14.2
  - @weasel-js/font@1.14.2
  - @weasel-js/text@1.14.2
  - @weasel-js/stroke@1.14.2
  - @weasel-js/geom@1.14.2
  - @weasel-js/paint@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/font@1.14.1
  - @weasel-js/geom@1.14.1
  - @weasel-js/paint@1.14.1
  - @weasel-js/renderer@1.14.1
  - @weasel-js/stroke@1.14.1
  - @weasel-js/text@1.14.1

## 1.14.0

### Patch Changes

- 2f3d924: Text runs can turn their glyphs. A `StyledRun`'s new `rotate` turns each of its glyphs that many degrees, clockwise, each about its own pen on the baseline, as SVG's `rotate` does; the glyphs keep their places along the line. Layout carries it on each `PlacedGlyph` as `rotate`, and the renderer draws it on every tier: atlas and canvas quads, color glyphs and outline glyphs, with painted bounds grown to hold the turned glyph. `textToPath`, `textClusters` and PDF export turn the glyphs the same way.
  
  SVG import reads `rotate` on a `<text>` or `<tspan>` instead of warning: each value turns one glyph, a glyph past the end of a list takes its last value, and a `<tspan>`'s own list wins over the text's. A list naming different angles over white space SVG collapses is reported and not read. Export writes a run's turn as `rotate` on its `<tspan>`.
  
  This adds API: `StyledRun.rotate`, `ResolvedRun.rotate`, `PlacedGlyph.rotate`, `LaidOutOutlineGlyph.rotate`, `glyphTurn`, and `penX` and `rotate` on `LaidOutQuad`. `QUAD_STRIDE` is now 11: each packed quad in `LaidOutGroup.quadData` gains its pen and its turn after `baselineY`, so code reading `quadData` by a hard-coded stride of 9 breaks.
- 5af16a6: `@weasel-js/text` exports `glyphOutlineAt(d, glyph, dx, dy)`, which sets a glyph's em-space outline data where the
  renderer's outline tier draws it: wound positive, grown for synthetic bold, and sheared for synthetic italic.
  `textToPath` and `textClusters` already placed glyphs this way. `@weasel-js/pdf` now does too, so a glyph it draws
  as an outline is wound positive whichever way its face winds it, and glyphs from faces that disagree on winding fill
  where they overlap under nonzero, as they do on the canvas.
- 966c37f: `writePdf` exports shaped text as the glyphs its shaper chose. Before, a shaped run was written one code point at a time, so Arabic lost its joining forms and Devanagari its conjuncts, and every code point of a cluster drew its own glyph on top of the one the cluster drew. Now each cluster's glyphs are written by glyph index where the shaper set them, a mark lifted off the baseline with `Ts`. A cluster of one glyph reads back through `/ToUnicode` as all of its code points (क्ष copies as क्ष); a cluster `/ToUnicode` cannot give back, such as a letter drawn as a body and its dots, is wrapped in `/ActualText` with its text. A face that cannot be embedded draws the shaped cluster's outline rather than each code point's.
  
  This adds API: `ShapedCluster.text`, the text a cluster's glyphs stand for.
- Updated dependencies [79357fc]
- Updated dependencies [d6221a7]
- Updated dependencies [38bb299]
- Updated dependencies [e1bbdcd]
- Updated dependencies [e974dba]
- Updated dependencies [30582cb]
- Updated dependencies [2999820]
- Updated dependencies [7b048f4]
- Updated dependencies [aba8563]
- Updated dependencies [b142892]
- Updated dependencies [ec07e24]
- Updated dependencies [6d5f7c2]
- Updated dependencies [14f8583]
- Updated dependencies [2f3d924]
- Updated dependencies [783756a]
- Updated dependencies [2692828]
- Updated dependencies [8763fc3]
- Updated dependencies [b0a55a6]
- Updated dependencies [e7fca17]
- Updated dependencies [64d4e97]
- Updated dependencies [d7d29f9]
- Updated dependencies [a58fb4f]
- Updated dependencies [8e6ed97]
- Updated dependencies [6b1b532]
- Updated dependencies [5af16a6]
- Updated dependencies [966c37f]
- Updated dependencies [941f382]
- Updated dependencies [9ef7751]
- Updated dependencies [561472d]
- Updated dependencies [d68c4f8]
- Updated dependencies [c66c536]
- Updated dependencies [cbb344e]
- Updated dependencies [4c0141f]
- Updated dependencies [d3fdba8]
- Updated dependencies [f9282f7]
- Updated dependencies [0509c29]
- Updated dependencies [3803ba2]
- Updated dependencies [2e4943e]
- Updated dependencies [8e2c8c8]
- Updated dependencies [78213f7]
- Updated dependencies [0fc0e50]
- Updated dependencies [058fcdf]
- Updated dependencies [dc6f83a]
- Updated dependencies [880f2b0]
- Updated dependencies [4a8b5be]
- Updated dependencies [32889fc]
- Updated dependencies [1fb8193]
- Updated dependencies [ab41dea]
- Updated dependencies [f645651]
- Updated dependencies [5399b45]
- Updated dependencies [55375c0]
- Updated dependencies [486ff61]
- Updated dependencies [23dcddf]
- Updated dependencies [f2acefd]
- Updated dependencies [95eb9d3]
- Updated dependencies [ff3c2ad]
- Updated dependencies [b0d5f18]
- Updated dependencies [7507e13]
- Updated dependencies [97d889f]
- Updated dependencies [9adc0cd]
- Updated dependencies [24e03ff]
- Updated dependencies [b43c94c]
- Updated dependencies [dfdc8a6]
- Updated dependencies [e23101b]
  - @weasel-js/font@1.14.0
  - @weasel-js/renderer@1.14.0
  - @weasel-js/text@1.14.0
  - @weasel-js/stroke@1.14.0
  - @weasel-js/paint@1.14.0
  - @weasel-js/geom@1.14.0

## 1.13.0

### Patch Changes

- Updated dependencies [16464c5]
- Updated dependencies [9a76fb5]
- Updated dependencies [7e5f9e3]
- Updated dependencies [c7516cd]
- Updated dependencies [8c39126]
- Updated dependencies [769eef8]
- Updated dependencies [4c113da]
  - @weasel-js/renderer@1.13.0
  - @weasel-js/text@1.13.0
  - @weasel-js/geom@1.13.0
  - @weasel-js/stroke@1.13.0
  - @weasel-js/font@1.13.0
  - @weasel-js/paint@1.13.0

## 1.13.0-rc.0

### Patch Changes

- Updated dependencies [7e5f9e3]
- Updated dependencies [c7516cd]
- Updated dependencies [8c39126]
- Updated dependencies [769eef8]
- Updated dependencies [4c113da]
  - @weasel-js/geom@1.13.0-rc.0
  - @weasel-js/renderer@1.13.0-rc.0
  - @weasel-js/stroke@1.13.0-rc.0
  - @weasel-js/text@1.13.0-rc.0
  - @weasel-js/font@1.13.0-rc.0
  - @weasel-js/paint@1.13.0-rc.0

## 1.12.0

### Patch Changes

- 400b393: A dash whose entries are all zero, or that has a negative entry, strokes solid instead of hanging stroke tessellation. A dash with a NaN or infinite entry draws no stroke, and `@weasel-js/pdf` drops and reports the command holding it. `dashPattern` (`@weasel-js/paint`) is the one reading of a dash array that the tessellator, `strokeDashStyleOf` and the PDF writer share.
- 40d87f7: A dash pattern too fine for the path it strokes now strokes solid instead of making work without bound: `dashPattern` (`@weasel-js/paint`) takes the path's length and reads a pattern that would cut it into more than `MAX_DASH_RUNS` (100,000) dash and gap runs as `'solid'`. The tessellator decides this once per path, over every subpath, and `@weasel-js/pdf` writes no dash for the same strokes. `@weasel-js/stroke` exports `dashLength`, the length a pattern runs along a path.
- 953c402: `writePdf` embeds each TrueType face as a subset holding only the glyphs the document draws, plus
  `.notdef` and the components of any composite glyph, under a tagged name (`ABCDEF+Inter-Regular`).
  A one-line page in Inter drops from about 16 KB to under 4 KB. Glyph ids are unchanged, so text
  stays selectable and extractable as before. `subsetFonts: false` embeds each face whole, as earlier
  releases did.
- 929736f: `@weasel-js/pdf` draws a group's Porter-Duff `composite` exactly instead of source-over. With a `rasterize` hook, a group whose composite is anything but `source-over` is handed to the hook together with everything the page drew before it, inside the groups it sits in, so the renderer composites it onto its real backdrop; the raster is placed on white paper over the group's bounds, or over the whole page for an operator that clears what the group leaves empty. An isolated group holding such a composite is rasterized whole. The hook's signature is unchanged; without one, a composite is still drawn source-over and reported in `skipped`.
  
  `@weasel-js/renderer` exports `leavesUncovered(composite)`, whether an operator leaves the destination as it was wherever the source is empty, and `readsBackdrop(commands)`, whether any group in a list has its own composite.
- d9fd036: `@weasel-js/pdf` rasterizes a group with effects over the group's bounds grown by how far its effects reach, rather than over the whole page, so a small blurred badge no longer costs a full-page bitmap. An `Effect` can now say how far it reaches with the new optional `reach`, in device pixels; `blur` sets it, and `effectsReach` (`@weasel-js/renderer`) adds up a stack's. An effect without one, such as `vignette`, still covers the whole page. The renderer's retained surfaces use the same bound, and `commandsBounds` takes the scale the commands will be drawn at.
  
  `screen`-unit paint inside a rasterized group now lands in the PDF where the vector path puts it, in page points rather than raster pixels. `WeaselRenderer.render` takes `screen` in its options, naming what screen space is when it is not the drawing surface, and `renderSceneToPixels` and a raster session's `render` pass it through as `screen`.
- bb7e6b5: A text stroke whose dash is too fine for its glyphs is written solid, as the renderer draws it. The
  dash's run count is measured against the segment's longest glyph outline, since the renderer
  strokes each glyph on its own.
- Updated dependencies [dbd6711]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [400b393]
- Updated dependencies [40d87f7]
- Updated dependencies [78f29de]
- Updated dependencies [2c52cc5]
- Updated dependencies [94ebd35]
- Updated dependencies [24f2495]
- Updated dependencies [929736f]
- Updated dependencies [d9fd036]
- Updated dependencies [3bf5edb]
  - @weasel-js/geom@1.12.0
  - @weasel-js/paint@1.12.0
  - @weasel-js/text@1.12.0
  - @weasel-js/stroke@1.12.0
  - @weasel-js/renderer@1.12.0
  - @weasel-js/font@1.12.0

## 1.11.1

### Patch Changes

- c29ac84: New package, `@weasel-js/pdf`: `writePdf` turns draw commands into a PDF document — vector paths, gradient shadings, images, and fonts embedded whole so text can be selected and copied. `@weasel-js/font` adds `fontEmbedding` and the `FaceEmbedding` type, and a custom outline parser can supply one through the new optional `OutlineFace.embedding`; the built-in parser offers none for a WOFF file. `@weasel-js/renderer` exports `markerDrawCommands`, `commandsBounds`, `isOwnComposite`, `applyColorMatrix` and `composeColorMatrix`, and `resolveStrokeLengths` takes `{ quantize: false }`; `@weasel-js/text` exports `syntheticBoldOffset` and `emboldenGlyphD`; `@weasel-js/diagram-formats` adds `exportPagesPdf`, every page of a diagram as one PDF.
- Updated dependencies [1dd65f5]
- Updated dependencies [4d99526]
- Updated dependencies [13fc67f]
- Updated dependencies [50da815]
- Updated dependencies [0f455dc]
- Updated dependencies [15efc86]
- Updated dependencies [c29ac84]
- Updated dependencies [07b686c]
- Updated dependencies [041bc38]
- Updated dependencies [2b267d5]
- Updated dependencies [8f2c044]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [e1eeb08]
- Updated dependencies [f148f50]
  - @weasel-js/renderer@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/stroke@1.11.1
  - @weasel-js/font@1.11.1
  - @weasel-js/text@1.11.1
  - @weasel-js/paint@1.11.1
