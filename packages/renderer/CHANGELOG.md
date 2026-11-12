# @weasel-js/renderer

## 1.19.1

### Minor Changes

- 16900c1: New `imageLoadsSettled()`, which settles once every image load in flight has landed or failed.
  
  For a render with no next frame to redraw in; `warmRender` waits on it.
  
  <!-- entry: api -->

### Patch Changes

- 69b696d: The image cache's budget no longer drops a picture the latest frame drew as an image pattern, as it already spared one drawn as an image.
  
  <!-- entry: fix -->
- 4fb0c17: `releaseImage` frees the texture an image pattern drew the picture through, along with its registry entry.
  
  <!-- entry: fix perf -->
- 20878ef: `setImageMinification` on a disposed `WeaselRenderer` does nothing, rather than leaving a cache that caps other renderers' texture size.
  
  <!-- entry: fix -->
- 04ac694: A `WeaselRenderer` that fails to construct on a lost context no longer rebuilds itself, unowned, when the context comes back.
  
  <!-- entry: fix -->
- 92e4fa8: Outlined text shows the new glyphs of a face `registerFontOutlines` registers again, not the shapes it first tessellated.
  
  <!-- entry: fix visual -->
- f3618cb: A disposed WebGPU `WeaselRenderer` is no longer kept alive by the device it drew on. A lost device is logged once, not once per renderer.
  
  <!-- entry: fix perf -->
- Updated dependencies [08dd689]
- Updated dependencies [71c3f85]
- Updated dependencies [55b0f04]
- Updated dependencies [2f6b0e9]
- Updated dependencies [1691dec]
- Updated dependencies [b62d643]
- Updated dependencies [8562ebe]
- Updated dependencies [bce70ba]
  - @weasel-js/font@1.19.1
  - @weasel-js/geom@1.19.1
  - @weasel-js/text@1.19.1
  - @weasel-js/paint@1.19.1
  - @weasel-js/registry@1.19.1
  - @weasel-js/stroke@1.19.1

## 1.19.0

### Patch Changes

- 65ee9a0: Layouts, bounds, legends and reports over hundreds of thousands of items no longer overflow the call stack. This covers, for example, a grid of a million nodes, a million pages, a polyline of a million points and a store of a million prefs records.
  
  <!-- entry: fix -->
- c5202b9: Text cut by a rect clip, such as a sticky note's descenders under `overflow: 'clip'`, no longer draws as black-and-white wedges.
  
  <!-- entry: fix visual -->
- 33bca4e: A hatch or crosshatch tile with a `lineWidth` of 0, a negative one or NaN draws no lines on the canvas, as the SVG export already did.
  
  <!-- entry: fix visual -->
- 63edf95: An arrowhead on a slanted edge is no longer culled while its tip is on screen, and its node's grab reach and paint box cover it.
  
  `markerReach` now measures how far a marker head reaches in any direction, not along its own axes.
  
  <!-- entry: fix visual -->
- 043db55: A retained group being redrawn no longer composites pixels from a draw that never finished. After `reserve` hands its surface out, the surface matches no key until `commit` names the one its new pixels were drawn under.
  
  <!-- entry: fix visual -->
- ebab03f: A shadow's spread rounds corners as CSS `box-shadow` does, so a square box casts a square shadow.
  
  This holds for `dropShadowLayers`, `dropShadowCommand` and a HUD's inset shadow. The rule is exported as `spreadRadius` from `@weasel-js/renderer` and `@weasel-js/core/renderer`.
  
  <!-- entry: fix visual api -->
- 582dfcb: A `{ px }` stroke under an infinite scale keeps its dashes, rather than drawing solid.
  
  Its dashes and dash offset resolve as its width does, left as given, in `strokeAtScale`, `strokeToPath` and the renderer.
  
  <!-- entry: rank=-5 fix visual -->
- 204596e: A `{ px }` stroke with per-vertex widths is no longer culled while on screen under a transform that stretches one axis more than the other.
  
  `strokeReachAt`, which culling and retained-surface bounds read, grows those widths by the square of the transform's stretch.
  
  <!-- entry: fix visual -->
- 12f254e: A text node with a `background` can draw an `edge` and a `shadow`, and sticky notes have both by default.
  
  `edge` (`{ width, shade }`) is a rule just inside the box in the background's color mixed toward black, keeping the background's hue when it changes; `shadow` (`{ x, y, blur, alpha }`) draws under it. `textFrameOf` describes the frame once, and the canvas painter and the SVG export both draw from it. The renderer's new `dropShadowLayers` and `dropShadowCommand` build a shadow as stacked translucent shapes with no blur pass, and hud's `box-shadow` now draws through them.
  
  <!-- entry: rank=10 new api visual -->
- Updated dependencies [aaeec8d]
- Updated dependencies [65ee9a0]
- Updated dependencies [2595ad3]
- Updated dependencies [8c4c266]
- Updated dependencies [6ae419d]
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
- Updated dependencies [3bedaa8]
- Updated dependencies [77cc6e1]
- Updated dependencies [afa1429]
- Updated dependencies [582dfcb]
- Updated dependencies [c3dc307]
- Updated dependencies [2a9727c]
- Updated dependencies [521bc15]
- Updated dependencies [997e4f3]
- Updated dependencies [4224853]
- Updated dependencies [4e6aad8]
- Updated dependencies [01b996e]
- Updated dependencies [b1309b2]
- Updated dependencies [5bc9b94]
- Updated dependencies [6999cce]
- Updated dependencies [4d16c8a]
  - @weasel-js/geom@1.19.0
  - @weasel-js/text@1.19.0
  - @weasel-js/font@1.19.0
  - @weasel-js/stroke@1.19.0
  - @weasel-js/paint@1.19.0
  - @weasel-js/registry@1.19.0

## 1.18.2

### Patch Changes

- 348fb68: Fixes to pasted tables, hatch pattern tiles and the dither protect texture.
  
  - A paste of an HTML table drops the white space a cell opens with, as a browser collapses it, so pretty-printed markup (`<td>\n  b\n</td>`) pastes as `a⇥b` instead of `a⇥ b`.
  - A `hatch` tile runs its diagonals and corner stubs far enough past the tile to cover a line wider than about 2.8 units, so a thick hatch no longer shows notches where the tiles meet. The SVG export draws the same tiles.
  - `protectTexture` makes a texture for a grid of no dots instead of throwing from `ImageData`; `dither` reads it as no protect mask.
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
- 07205dd: A stroke whose width is 0 draws nothing, whatever its per-vertex widths and marker sizes, on every path.
  
  - The renderer draws no marker head for a stroke with no width. Before, a head given its own `size` was drawn on a line that drew nothing, where SVG and PDF export drew neither.
  - A node's stroke with no width is no longer hit by a click or hover within its per-vertex widths or its heads (`inkReach`), where nothing is drawn.
  - `strokeEdgeNear` answers `null` for a stroke with no width, so the Girth tool no longer finds or drags edges of a stroke that draws nothing.
  - `inkWidth`, the tessellator's test of whether a width puts down ink, is exported from `@weasel-js/stroke`.
  - `resolveStroke`'s docs no longer say a stroke with no width can draw through its per-vertex widths.
- Updated dependencies [fc38c90]
- Updated dependencies [30dd2dc]
- Updated dependencies [b188aea]
- Updated dependencies [07205dd]
  - @weasel-js/text@1.18.2
  - @weasel-js/paint@1.18.2
  - @weasel-js/registry@1.18.2
  - @weasel-js/stroke@1.18.2
  - @weasel-js/font@1.18.2
  - @weasel-js/geom@1.18.2

## 1.18.1

### Patch Changes

- Updated dependencies [c9fb4d6]
  - @weasel-js/font@1.18.1
  - @weasel-js/text@1.18.1
  - @weasel-js/geom@1.18.1
  - @weasel-js/paint@1.18.1
  - @weasel-js/registry@1.18.1
  - @weasel-js/stroke@1.18.1

## 1.18.0

### Patch Changes

- fe6a382: Stroke, paint and alignment fixes:
  
  - A closed zero-length subpath (`M5 5Z`, `M5 5L5 5Z`) draws its round or square cap as a dot, as SVG strokes it.
  - A closed subpath's last vertex takes a mid marker.
  - An inner stroke at least as wide as a rect's narrower side fills the rect, as it does the same polygon, instead of turning the rect inside out and drawing outside it. `ribbonAligns` (stroke) and `alignedStrokeRectHolds` (paint) say when a rect's aligned ribbon is built in place.
  - An upright selection outline and the selection handles' outlines are aligned once; they were shifted for `align` and then shifted again by the renderer.
  - SVG export writes gradient stops in offset order, and a stop past 0..1 as the color the ramp has there, so the file reads back as the gradient the kit paints.
  - Interpolating two gradients pairs their stops by offset, not by list position.
- c7e8680: Text fixes from an audit:
  
  - An outline face registered again while its first file was still loading no longer builds the DOM face from the old file's bytes.
  - Registering a bidi engine or shaper (`registerBidi`, `registerShaper`) after text was first drawn now lays that text out again in its picking silhouette, in `textClusters` and in retained layers; it used to keep the order and widths from before. New `textEngineGeneration()` counts those registrations.
  - `runsToMarkdown` writes markers only where a flag changes, so two adjacent italic (or bold) runs no longer come back from `markdownToRuns` as bold (or plain).
  - The text edit overlay keeps a run's screen-pixel `fontSize` and `letterSpacing` (`{ px }`): it showed the run at the node's size and dropped the override on commit.
- e405e70: Renderer fixes from an audit:
  
  - A tensor mesh patch's four interior points are read in PDF's order (p11 p12 p22 p21), so the second sits beside corner 1 and the fourth beside corner 3; the two were swapped, which twisted any tensor patch whose interior was not symmetric, and `meshHandles` dragged the wrong interior point with corners 1 and 3. A sixteen-point patch authored against the old reading draws differently: swap its points 13 and 15 to keep its shape.
  - Cached marker heads are placed again when a stroke's `vertexWidths` change how finely its curve is flattened; a head on a curve could keep the position and angle of the previous widths.
  - After a WebGL context restore, a custom program that fails to compile again is dropped rather than drawn with the lost context's program, and a program whose compile failed while the context was being lost is compiled again.
- b93c1dd: Fixes from an audit of ui-logic, editor and the icon packages, and one definition each for decisions several packages answered separately:
  
  - The icons plugin reads the namespace of an `icons.gen` compiled to JavaScript, so its `icon()` calls are rewritten as a TypeScript one's are.
  - Releasing an icon table a second time no longer bumps the registry's version and notifies its subscribers.
  - `envPx` reads a token set to a bare `0` as 0px, as CSS does, instead of using its fallback or throwing.
  - New in geom: `trimNumber(n, places = 6)`, which pathToD, svg and the renderer's mesh writer now share. The mesh writer kept four decimal places where its comment said it matched svg's six; it now writes six.
  - New in geom: `rectBetween(ax, ay, bx, by)`, the rect two corners span, used by core's drag rect, marquee, area select, anchor marquee, insert extent, measurement and parallax, and by diagram's segment boxes.
  - New in registry: `freshId(base, taken, opts)`, the first free numbered id, used by core's `nextPageId`, diagram's stage, wire, group and sequence ids, and labkit's snapshot names.
  - paint exports `byteHex` and `lerpHueDeg`. core's `withAlpha01` and p-touch's lbx colors write hex through the first. theme's ramps blend hues through the second, so two anchors exactly opposite now blend the positive way round, as CSS's `shorter` does, where before they went the negative way.
  - gestures' `matchKey` takes a readonly key list, and routing's key bindings match through it.
  - ui-logic's `clampTo` is now geom's `clamp` under another name, and is deprecated.
- d025e1b: Renderer fixes from an audit:
  
  - A WebGPU renderer now compiles a WGSL program that declares a struct no uniform could hold, such as a helper struct with a `bool` member, a fragment input with `@builtin(front_facing)`, or a struct ending in a runtime-sized array. Laying the struct out used to throw, and the program drew nothing. A uniform that binds such a struct is still refused, and the error names the type.
  - WGSL array sizes and `const`s written with an `i` suffix (`array<vec4f, 2i>`, `const N = 3i;`) are now read. They used to throw `unknown array size`.
  - A WebGPU program now takes a write to one slot of an array uniform by its slot name (`u_ripples[2]`), as a WebGL program does. Such a write used to be dropped with a "uniform not found" warning.
- Updated dependencies [fe6a382]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [206b78d]
- Updated dependencies [a78c393]
- Updated dependencies [cfe8a8a]
- Updated dependencies [082fa2f]
- Updated dependencies [b93c1dd]
- Updated dependencies [5f9b5d0]
- Updated dependencies [d83476e]
- Updated dependencies [89b2c65]
- Updated dependencies [c675905]
- Updated dependencies [1e0adbb]
- Updated dependencies [2455bb4]
  - @weasel-js/stroke@1.18.0
  - @weasel-js/paint@1.18.0
  - @weasel-js/geom@1.18.0
  - @weasel-js/font@1.18.0
  - @weasel-js/text@1.18.0
  - @weasel-js/registry@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [13c6f66]
  - @weasel-js/geom@1.17.3
  - @weasel-js/stroke@1.17.3
  - @weasel-js/text@1.17.3
  - @weasel-js/font@1.17.3
  - @weasel-js/paint@1.17.3
  - @weasel-js/registry@1.17.3

## 1.17.2

### Patch Changes

- d12d868: The canvas draws an inner- or outer-aligned stroke on outline-tier text on its own side of each glyph's edge, as `writePdf` already did. It used to draw the stroke centered on the edge whatever its `align`.
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
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
- Updated dependencies [f6e234a]
- Updated dependencies [d3654a1]
  - @weasel-js/paint@1.17.2
  - @weasel-js/stroke@1.17.2
  - @weasel-js/geom@1.17.2
  - @weasel-js/text@1.17.2
  - @weasel-js/font@1.17.2
  - @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/font@1.17.1
  - @weasel-js/geom@1.17.1
  - @weasel-js/paint@1.17.1
  - @weasel-js/registry@1.17.1
  - @weasel-js/stroke@1.17.1
  - @weasel-js/text@1.17.1

## 1.17.0

### Patch Changes

- 13ca1ea: `blur()` with an infinite or NaN radius draws the group unblurred. Its taps were spaced at NaN, so the group came out blank, and its reach was unbounded, so every frame ran the passes over the whole drawing buffer.
- d3820c9: A `chunks` tile draws a chunk crossing its edge again past the opposite edge, in the raster tile and in the shapes `tileGeometry` gives an SVG export. Such a chunk was cut off where the tile ended and nothing continued it in the next, so a chunks fill showed flat-sided chunks along a grid at the tile size.
- 7e3d359: Rotate by Measurement turns a stroked selection about the center of its drawn boxes, as a rotate drag does, rather than its pose boxes'.
  
  Inside `<SceneCanvas>`, snapping measures with the `drawnBoxes` and `boundsIncludeStroke` deps, so a host that overrides them snaps to the same boxes its move, align, resize and rotate measure. `createSnapSession2d` takes a `drawnBoxes` source for a host without a canvas.
  
  `Effect` gains `screenAnchored`, for a pass whose result depends on where in the drawing buffer a pixel lies. A retained layer running one is drawn again through a pan instead of being moved, and `dither()` sets it for a Bayer pass or an output grid, whose pattern used to slide with the content and snap back.
- d5cc782: The renderer draws through a backend-neutral GPU layer, with WebGL2 its only backend so far. What it paints is unchanged. Breaking for code written against the renderer's GL surface:
  
  - A registered paint kind's `bind` no longer touches GL. It returns `{ program, uniforms }`: the id of a registered program and its uniform values by name, which the renderer binds, sending `u_proj`, `u_model` and `u_origin` itself. `PaintBindContext` loses `gl`, `program` and `setProjAndModel`; `bindRamp(stops, unit, space)` becomes `ramp(stops, space)`, returning the atlas texture and its row's `v`; and it gains `createTexture` and `deleteTexture` for a kind that bakes its own texture. `PaintProgram` is gone; `PaintBinding`, `PaintTexture` and `PaintUniform` are new.
  - `ShaderProgram` is the layer's program handle. It exposes no `WebGLProgram` and no uniform locations: uniforms and textures are set by name (`set1f`, `set`, `setTexture`, …), and `has(name)` replaces `uniform(name) !== undefined`.
  - `UniformArray` drops `location`.
- e3a95da: `imagePending(src)` says whether a load of `src`, or a re-raster of a vector source at another size, is in flight: whether `subscribeImageReady` will hear of a new bitmap for it.
- ee9bc7f: An image node's `data.image` takes `previous`: a `src` the `kit:image` painter draws in place of `src` while `src` decodes, so swapping a node's picture no longer flashes the loading placeholder. It is drawn only once it has decoded and never loaded on its own account, and the failure mark still shows once `src` fails.
- 3517855: Outlined text keys its glyph stroke ribbons on the stroke's `nib`, `trim`, `vertexWidths` and `varyingWidthJoinThreshold`. They were left out, so two runs stroking the same glyph at the same width shared whichever ribbon was built first: a calligraphic outline could draw with a round pen, or a trimmed one whole.
- 8e888a9: Pick by what a canvas painted. `<SceneCanvas geometry={{ picking: 'pixels' }}>` takes its presses, hover and the
  `nodeAtPoint` dep from the canvas's id frames, so a custom shader, an effect, or a texture's transparent parts pick
  as they look rather than as their outline. Each pick reads the few pixels around the point, leaving out the nodes it
  has already found, so a node covered by another is still found and an `exclude` sees what is beneath the nodes it
  names. It falls back to `'shape'` before the first paint, without WebGL2, and for a pick asked for another view.
  
  The canvas handle gains `readIds(rect, options)`, the ids the canvas last painted over a rect; `pickAt` reads through
  it, and both take `exclude`, the `pickId`s to leave out. `WeaselRenderer.renderIds` takes `exclude` as well.
  
  In an id frame, paint that no group gives a `pickId` now leaves the ids beneath it as they were, instead of claiming
  its pixels for 0, so selection chrome or any other untagged overlay drawn over a node no longer hides it from a pick.
  A group with `pickId: 0` still claims its pixels for nothing.
  
  An id read for a point off the drawing now reads nothing, where it used to read the nearest edge pixel when the point
  was left of or above the drawing, and `renderIds` restores the context's framebuffer when a frame throws.
- ee7d8ce: A vector source whose re-raster at a larger size fails now fires `subscribeImageReady`, as a failed load does. A reader waiting for the sharper raster heard nothing before, and waited on whatever image landed next.
- cb58393: A retained layer that follows a pan now gets its margin when the retain budget is full but holds surfaces of layers that cannot follow the pan. Such a layer (a custom shader, a paint in screen units, or effects that do not say how far they reach) is drawn straight through while it moves and drawn again once it holds, so its kept pixels are dead weight for the pan; the renderer now frees them, largest first, before it refuses a margin or any other surface. Before, the margin went to whichever layer asked first, and the layers past the budget were drawn straight through for the rest of the pan. A layer refused a margin earlier in the pan gets one as soon as freeing those surfaces would make room.
- 5b39acd: `setImageMinification` draws retained groups again. Their surfaces were kept across the change, so an image inside one went on showing the old filtering until something else about the group changed.
- 454e8e1: The selection outline can follow a node's shape instead of its box. Set `outline: { follow: 'shape' }` on the `selectionOverlay` slot, or on `createSelectionOverlayLayer` / `createSelectionOutlineLayer` with `scene`, and each node's silhouette is stroked outward from its drawn edge (past its own stroke, when it has one) at the outline's width in screen pixels. An open path, such as a wire, is outlined around the band its stroke covers. A group, an unstroked open path, or a node with no outline to trace keeps its box, and `pad` applies to boxes only. Additive; the default stays `'box'`. An `outline` given without a `paint` now keeps the default color rather than painting nothing.
  
  `nodeOutline` takes an optional pose and silhouette context, for reading a node's outline somewhere other than its stored pose.
  
  `DiagramView` outlines selected shapes along their outlines, and an item carried over a shape highlights the shape rather than its box; a container keeps its box in both.
  
  `@weasel-js/geom` exports `flatSubpaths`, a path flattened into point runs split by whether each encloses area.
  
  `@weasel-js/renderer` no longer throws `RangeError: offset is out of bounds` cutting an inner or outer stroke against a fill made of sliver triangles.
- e78e03c: `registerProgram` and `registerEffect` take a program's source by shading language, so a program can carry WGSL for the coming WebGPU backend beside its GLSL. This breaks every caller: `registerProgram(id, '', frag)` is now `registerProgram(id, { glsl: { frag } })`, `registerProgram(id, vert, frag)` is `registerProgram(id, { glsl: { vert, frag } })`, and `registerEffect(id, frag)` is `registerEffect(id, { glsl: frag })`. A paint kind's `programs` entries take the same shape. Leaving out `vert` selects the kit's vertex shader; an empty string no longer does. The WebGL renderer draws from `glsl` and draws nothing for a program with only `wgsl`, reporting that once. A program that fails to compile is now reported once per source, not on every frame, and is not compiled again until its source is re-registered. WGSL sources are held but not yet drawn by anything.
- e95d9fc: An `ImageBitmap` made with `premultiplyAlpha: 'none'` now draws right on WebGL, as an image command and as a `registerTexture` pattern, where it used to come out too bright wherever it was translucent. WebGL uploads a bitmap as it holds its pixels, and nothing reports which kind those are, so a bitmap bound for an image texture is drawn once into a scratch 2D canvas, which premultiplies a straight one and leaves a premultiplied one as it is, and the texture is uploaded from that. WebGPU already premultiplied both.
- 9f29268: An animating stroke trim no longer rebuilds a translucent, vertex-colored, gradient- or pattern-painted stroke too large to batch, one built in a stretched view's metric, nor any stroke's marker heads. Such a stroke is clipped from its one cached ribbon in the shader, as an opaque solid one already was, and paints each pixel once through the stencil, so it does not darken where its ribbon turns. An untrimmed stroke too large to batch draws from the same ribbon, so a tween that ends at the full stroke looks as the stroke does with its trim removed; a translucent one no longer darkens at a sharp turn, and a vertex-colored one gives a sharp turn's overlap to the segment before it rather than splitting it at the bisector. Heads are built once and drawn under the transform that places them, so a trim only moves them. A head's own paint (`MarkerEntry.fill` or `outline.paint` other than `'line'`) is now resolved against the head's unplaced box and turns with the head, as a node's box paint turns with the node, where it was resolved against the placed head's axis-aligned box.
  
  `@weasel-js/stroke` adds `markerPlacements`, `markerShape`, `markerPlacementMap` and `markerPolylines`, which say where each head goes without building it.
- d90931a: The renderer can draw with WebGPU. `new WeaselRenderer({ gpu: { device, canvas }, width, height, dpr })` builds one synchronously from a `GPUDevice` the caller holds, and `requestRendererDevice()` returns the page's one shared device, or `null` where WebGPU is unavailable. `gpu.antialias: false` draws the canvas single-sampled, as WebGL's `antialias` context attribute does; the default is 4× multisampled. A lost device is reported once and the renderer draws nothing after it.
  
  `renderIdsAsync` reads ids back as a promise on either backend. `renderIds` stays synchronous on WebGL and throws on WebGPU, naming `renderIdsAsync`.
  
  On WebGPU a program or effect draws from its WGSL. A custom program's WGSL supplies `fn fragment(in: Varyings) -> vec4f`, and optionally `fn vertex(v: KitVertex) -> Varyings`, inside the kit's prelude; its own uniforms are a struct at `@group(1) @binding(0)`, its textures group-1 variables each beside a `<name>_sampler`. An effect's WGSL supplies `fn effect(in: EffectVaryings) -> vec4f`. Coordinates are top-left: `kit.fragOrigin` is the drawing buffer's corner counted from the top. A program or effect without WGSL draws nothing on WebGPU and is reported once. The built-in blur and vignette carry WGSL.
  
  A registered paint kind's WGSL supplies `fn fragment(in: PaintVaryings) -> vec4f`, and optionally `fn vertex(v: PaintVertex) -> PaintVaryings`, inside the kit's paint prelude, which reads the path vertex and declares `kit.proj`, `model`, `worldInv` and `origin`. `renderer.backend` says whether a renderer draws with `'webgl2'` or `'webgpu'`.
  
  Core's canvases take `backend: 'webgl2' | 'webgpu' | 'auto'` (`<Canvas>`, `<SceneCanvas>`, `<DrawCanvas>`, `<SceneViewCanvas>`), default `'webgl2'`, and `CanvasBackendProvider` sets it for every canvas beneath it. `'auto'` takes WebGPU where a device is available and every program registered so far has WGSL. The choice is made at a canvas's first paint, which waits for the device; a tile of a shared canvas always paints with WebGL 2.
  
  Breaking: `CanvasExtensionApi.pickAt` and `readIds` now return promises, so they read ids on WebGPU too. `readIdsSync` answers at once on WebGL and returns `null` on WebGPU; `geometry.picking: 'pixels'` reads it and walks the shapes where it is `null`.
  
  <!-- bump-approved: minor: maintainer — 1.17.0 release requested 2026-11-07 -->
- 84a8be0: `renderer.readPixels(rect)` reads back what the canvas's last frame left inside a rect of device pixels counted from its top-left, as premultiplied RGBA with rows top-down, on either backend. `readPixelsSync` answers at once on WebGL and throws on WebGPU. A WebGPU canvas keeps its last frame for this, as a WebGL canvas's preserved drawing buffer does. Core's `readCanvasPixels(canvas, rect)` reads a weasel canvas through whichever renderer paints it, and `canvasPaintsWith(canvas)` says which backend that is.
  
  The loupe's pixel mode works on WebGPU canvases: it reads its region through `readCanvasPixels`, and answers the color under the aim from that region.
  
  A WGSL program's uniform struct is laid out by WGSL's own rules, so where the browser has `uniform_buffer_standard_layout` an `array<vec2f, N>` or `array<f32, N>` member gets its real 8- or 4-byte stride rather than 16. Where it lacks the feature, a uniform struct that breaks the stricter uniform rules is refused when the program is built, naming the member, rather than drawing from misplaced values.
- df080bc: `<SceneViewCanvas worker>` paints its scene from a worker. The component hands its canvas to the worker with `transferControlToOffscreen`, and on each frame sends it only what changed: the changed nodes in their saved form, the pose overrides, and the view, size, and layer settings. The worker keeps its own copy of the scene and draws it with its own renderer. Hit-testing, input, and overlays stay on the page. The worker's module imports `serveSceneRender` from the new `@weasel-js/core/render-worker` entry and registers whatever paints a node there: node shapes, fonts, paint kinds, shader programs (GLSL, WGSL, or both), and the scene registry. `alphaFor` still applies: the page calls it and sends the alphas that changed, and scroll offsets cross too. `workerRef` gives `snapshot()` in place of `toBlob`, which a transferred canvas no longer allows. A host that is not React drives `startSceneRenderWorker` from its own frame loop.
  
  The worker runs no loop of its own: it paints when the page's frame loop sends a frame, so it paints nothing while the canvas is off screen or the tab is hidden. A worker decodes raster images itself, and asks the page for an SVG source, which needs an `<img>` to rasterize.
  
  The renderer's `canvas` option takes an `OffscreenCanvas`. The image cache's own loader decodes rasters with `fetch` and `createImageBitmap` where there is no `<img>`, and `setImageLoader` replaces it. A worker's `self.fonts` loads invalidate glyphs the way `document.fonts` loads do.
  
  A worker view runs its own animator. The worker module registers animation programs by key (`serveSceneRender({ animations })`), and the page plays them through `workerRef.current.animator.play(key, params)` and steers them by id or key; their vertex-color and trim overrides paint as an `animator` does on the page. The animator moves on the page's frames, so it stops while the canvas is unseen, and given `clock` it follows a page clock: its pause holds the animations, and a seek back plays them backward. `hostAnimator` in `@weasel-js/animator` is that animator for any host that runs its own frames.
  
  An image node can draw a `bitmapSrc` bitmap in a worker view: the worker asks the page for it and is sent a copy. `bitmapSrc` names now carry a token of the realm that minted them, and `adoptBitmapSrc` puts a bitmap minted in another realm into the image cache under its name.
  
  `<SceneCanvas worker>` paints the scene layers from a render worker and the rest of the layer stack on the page: the layers below the scene and above it (grid, ghosts, selection and path-edit chrome, consumer layers) each paint into a page canvas of their own, stacked with the worker's, and the top one takes input. A page layer placed between two scene layers gives each part of the scene its own worker. The handle's `readIds` and `pickAt` read every canvas of the stack, the worker's a round trip away and in the page's `scenePickIds` numbering, and `readIdsSync` answers `null` there, so `geometry.picking: 'pixels'` walks the shapes. A prop worker mode cannot honor is a type error: `animator`, `paintInto`, `inputElement`, `backend`, and a scene slot's functions; the worker's canvas and the page's beside it paint with WebGL 2. The handle's `worker` gives the worker's animator and a snapshot of the whole stack.
  
  This changes `SceneCanvasProps` and `SceneViewCanvasProps` into unions of a page-painted and a worker-painted branch, which breaks a wrapper that writes `Omit<SceneCanvasProps<…>, K>`: an `Omit` of a union merges its branches, and the merged props are assignable to neither. Distribute it instead, `SceneCanvasProps<…> extends infer P ? (P extends unknown ? Omit<P, K> : never) : never`, as `LeanSceneCanvasProps` and labkit's `TrialSceneCanvasProps` now do. `SceneViewCanvas` also takes `dpr`.
- Updated dependencies [6539d70]
- Updated dependencies [b497b07]
- Updated dependencies [75ef6d9]
- Updated dependencies [12e9c39]
- Updated dependencies [9d25103]
- Updated dependencies [3b08834]
- Updated dependencies [ceff0c3]
- Updated dependencies [52fd33e]
- Updated dependencies [c29b1f7]
- Updated dependencies [454e8e1]
- Updated dependencies [8fd23c2]
- Updated dependencies [9f29268]
- Updated dependencies [d90931a]
- Updated dependencies [df080bc]
- Updated dependencies [305c461]
- Updated dependencies [a3ff22a]
- Updated dependencies [15a5e1d]
  - @weasel-js/geom@1.17.0
  - @weasel-js/paint@1.17.0
  - @weasel-js/stroke@1.17.0
  - @weasel-js/font@1.17.0
  - @weasel-js/text@1.17.0
  - @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- 944faa2: New package `@weasel-js/dither`: `ditherPixels` quantizes exported pixels to 1-bit ink by threshold, Bayer, Floyd–Steinberg or Atkinson, keeping protected regions at plain threshold, and `dither` is the same threshold and Bayer as a live renderer effect, on the screen grid or an output target's dot grid (`gridOnScreen`). The renderer gives every effect pass `u_windowOrigin`, where its buffer sits in the drawing buffer; a layer group's effect thunk now receives `LayerDims`, with `dpr`; geom exports `OutputGrid`.
- 8f2e1e1: Export, as types only, the declarations the public `.d.ts` files already named but no entry exported: core's
  `GestureLifecycleOptions`, renderer's `BatchStage`, and `ScopeNode`, `DepNode`, `ToolNode` and `LastOperationKeeper`
  from `@weasel-js/routing/react`. A consumer whose own declaration emit has to name one of them no longer gets TS2742.
- 12d3c17: Id frames, for picking and coverage masks. `WeaselRenderer.renderIds` draws a command list again into a buffer of its own, holding a second color attachment beside the color, and reads back which `GroupDrawCommand.pickId` each device pixel carries, culled to a `rect` when one is given. Every program writes the id output, a consumer's custom shaders and effects included, with no change to their source: the renderer adds it at compile time. A pixel takes the id of the last fragment to paint it at `minAlpha` or more, so a custom shader claims what it paints rather than its bounds, and a group's effects claim what they spread into. `idMask` turns an id buffer into a one-byte-per-pixel mask of chosen ids, the shape `ditherPixels`'s `protect` and `protectTexture` take.
  
  In core, every scene node's paint carries a `pickId` from `scenePickIds(scene)`, which names the node back; a canvas handle's `pickAt(x, y)` reads the id under a point of its last frame; and `RasterSession.renderIds` returns a headless render's ids. The dithering demo's "By mask" protects every dot a mark paints, plus its quiet zone, instead of rects alone.
- Updated dependencies [944faa2]
- Updated dependencies [847875c]
  - @weasel-js/geom@1.16.2
  - @weasel-js/stroke@1.16.2
  - @weasel-js/text@1.16.2
  - @weasel-js/font@1.16.2
  - @weasel-js/paint@1.16.2
  - @weasel-js/registry@1.16.2

## 1.16.1

### Patch Changes

- 3905b08: Redrawing a retained surface larger than one tile no longer costs more than drawing it whole: 4 layers of 1,000 commands with their pan margins at 2560x1600 went from 16.5–18.3 ms a redraw to 4.8–5.4, against 5.0–5.9 untiled (M5 Max, 4–6 fresh contexts each). Each tile now skips the commands that miss it at any depth, where it used to look only at the retained group's own children, so a layer whose commands sit inside one group staged every command in every tile.
  
  Text with a pattern or registered paint in `local` or `world` units now follows a pan in a retained layer, as a path with that paint does, instead of being drawn straight through while the view moves.
  
  `drawLayers` retains a layer that runs effects passes, its own or a group's inside it, from 10 drawing commands rather than 250 (`LayerRetainPolicy.minCommandsWithEffects`, also on `<Canvas retain>`): under a blur of radius 8, compositing such a layer was already cheaper than drawing it at 10 commands.
- Fixes to the stroke trim that shipped in 1.16.0, and a Trim row for the stroke panel.
  
  - Text ignores its stroke's trim everywhere now, not just on canvas. A trimmed text stroke used to cut each glyph's outline in PDF export (whenever a glyph was drawn as an outline), in Outline Stroke, and in Create Outlines. `resolveRuns` (text) now drops the trim, and `ResolvedRun.stroke` is typed without one.
  - SVG export writes a path stroke aligned `inner` or `outer` as its filled outline, the way it writes a variable-width stroke. It used to write it centered with a warning, so the SVG disagreed with the canvas and the PDF, trimmed or not. The path keeps its stroke at `stroke-width="0"` and records the alignment as `wzl:stroke-align`, which import reads back. Text strokes still warn.
  - An `object` pref leaf's dotted field (`'nib.angle'`) now reads and writes a field of a field. It used to read nothing and write a flat key named `nib.angle`, so the stroke panel's nib Angle and Thinnest rows never took effect. `prefObjectField` (prefs) reads one, and `prefObjectWithField` sets one, making the objects on the way and dropping one a cleared field leaves empty.
  - The stroke properties schema (core's default node properties, which draw's sidebar shows) has a Trim row after the markers: Start and End as fractions, and Pace once either is set. An edge held as a length, anchor or subpath disables its slider rather than being rewritten.
- b45f2cc: An animating `Stroke.trim` no longer rebuilds the stroke's ribbon every frame. For an opaque solid stroke too large to batch, the renderer builds the ribbon once, untrimmed, with an arc length on every vertex, and the trim clips it in the shader, so a tween changes a uniform; only the cut ends, a few triangles with their caps, and the marker heads are built per frame. A trim tween on a 1,000-anchor path now makes no ribbon rebuild after its first frame. Other trimmed strokes are still rebuilt trimmed: translucent ones, ones the batch takes, ones built in a stretched view's metric, vertex-colored ones, and any paint but a solid. `@weasel-js/stroke` exports what the clip is built from: `clipRibbon`, which builds the ribbon, and `clipWindow`, which turns a trim into the window of lengths to draw and the geometry for its cut ends.
- Updated dependencies [3afef45]
- Updated dependencies [5a2e82a]
- Updated dependencies [25a1ff7]
- Updated dependencies [6b503a5]
- Updated dependencies
- Updated dependencies [b45f2cc]
  - @weasel-js/geom@1.16.1
  - @weasel-js/registry@1.16.1
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
- f9cfd00: Degree and radian conversions in these packages use geom's `DEG_TO_RAD` and `RAD_TO_DEG` instead of
  writing `Math.PI / 180` out by hand. Results are unchanged up to floating-point rounding.
- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/paint@1.16.0
  - @weasel-js/geom@1.16.0
  - @weasel-js/stroke@1.16.0
  - @weasel-js/text@1.16.0
  - @weasel-js/font@1.16.0
  - @weasel-js/registry@1.16.0

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
  - @weasel-js/registry@1.15.2
  - @weasel-js/text@1.15.2
  - @weasel-js/font@1.15.2

## 1.15.1

### Patch Changes

- Updated dependencies [d2110bc]
- Updated dependencies [2992b55]
- Updated dependencies [937167e]
  - @weasel-js/font@1.15.1
  - @weasel-js/text@1.15.1
  - @weasel-js/geom@1.15.1
  - @weasel-js/stroke@1.15.1
  - @weasel-js/paint@1.15.1
  - @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

- 2bdba7b: An inside- or outside-aligned stroke on a fill that is not convex now stays in the batch: its ribbon
  is cut on the CPU against the fill's triangles, where it used to end the run and draw through a
  stencil pass. A fill that draws through the stencil itself, a fill whose triangles would take too long
  to cut against (a many-pointed star of a few hundred edges, say), and a stroke with per-vertex colors
  still take the stencil.
- 719d457: A convex clip of up to eight straight edges no longer breaks the batched run on a target where the batch shader cannot
  clip it: a multisampled canvas (the browser default), a retained surface, or an effect's target. Staged geometry is cut
  to the clip's half-planes on the CPU instead of the clip going on the stencil, and a turned item across a rect clip
  there is cut too rather than sent to the stencil. A cut point on a slanted edge is not one the rasterizer can hold, so
  a sample within its snapping distance of the clip's edge can land the other way from the stencil's.
  
  An inner or outer stroke on a fill that is one convex ring, curved or straight, is cut to its side of the fill on the
  CPU and joins the run, where it used to flush the run and draw itself through a stencil pass. A stroke with per-vertex
  colors, or on a fill that is not convex, keeps the stencil.
- b7d362d: An even-odd fill whose contours neither cross nor touch now tessellates to an ordinary triangulation (`earcut`, rings
  nested an odd number deep cut as holes) instead of a per-contour fan with `requiresStencil`, so the renderer stages it
  into the batched run like a nonzero fill. Contours that cross, touch, or overlap are first rebuilt as the boundary of
  their even-odd fill, the way crossing nonzero outlines already were, and a contour of no area is dropped; only a fill
  whose crossings would cost more than `MAX_EVENODD_RESOLVE_WORK` (now exported from `@weasel-js/geom/tessellate`) to
  resolve keeps the stencil fan.
  
  The stencil's cover pass now paints each pixel of an even-odd fill once: a translucent fill whose fan overlapped
  itself, such as a concave outline, used to blend once per overlapping triangle and come out too opaque.
- e05ddd3: Small atlas text keeps its weight and position as it moves between pixels. A glyph small enough for area
  coverage now draws on a quad grown by `GLYPH_AREA_MARGIN` (one device pixel, new in `@weasel-js/font`) on
  every side, and the shader reads the margin as empty rather than as the next glyph in the atlas. The quad
  used to be the glyph's atlas cell, whose padding is narrower than the ink area coverage puts down past an
  outline, so on a multisampled canvas the pixels its edges crossed were dimmed by the samples they missed:
  a 7.2px Inter `H` swung 0.37px as it stepped through a pixel, and 0.10px now. `glyphCoverage` in
  `GLYPH_COVERAGE_GLSL` takes a sixth argument, `cell`, which runs 0 to 1 across the grown quad; a program
  pasting it in passes it, or a constant where its quads do not grow.
- a1cb281: Images drawn at half their size or smaller are now smoothed through mipmaps by default: `imageMinification` defaults
  to `'auto'` on `WeaselRenderer` and `<Canvas>`, which builds an image's mipmaps the first time a frame draws the whole of
  it that small. This changes the pixels of every image drawn small; pass `imageMinification: 'linear'` for the old
  single-tap look. A draw with `source` and a `sprites` run never sample mipmaps, under any mode, so a sprite-sheet cell
  drawn small no longer takes color from the cells beside it under `'mipmap'` or `'auto'`.
- fbc7ebf: A pattern fill (`kind: 'texture'`) on a path, a stroke or an outline glyph now joins the renderer's batched run instead
  of drawing for itself: its tile takes a texture slot in the run and each vertex carries its tile coordinate, so a
  pattern no longer flushes the solids, gradients, images and text around it. What it paints is unchanged, opacity and
  group color matrix included.
- d25ad30: A runs array can now be refilled in place. `clearRuns(runs)` in `@weasel-js/text` forgets what the layout and
  paint caches hold for it while leaving it filed, `resolveRunsInto(out, runs, style)` resolves into an array the
  caller owns, rewriting each run object whose optional fields match, and `textCommandFromRunsInto(cmd, …)` in
  `@weasel-js/renderer` refills a text command and its runs. Core re-exports all three.
  
  A HUD text widget now keeps one command and one runs array for its life and refills them when its text, color
  or family changes, so a readout rewritten every frame no longer allocates a command, its runs, or a cache
  entry per label. What its `draw` returned shows the widget's current text rather than a snapshot of the
  text it had then.
- Updated dependencies [3f13a49]
- Updated dependencies [d40f593]
- Updated dependencies [b7d362d]
- Updated dependencies [a95d3a4]
- Updated dependencies [e05ddd3]
- Updated dependencies [30bf607]
- Updated dependencies [48b6c4c]
- Updated dependencies [d25ad30]
- Updated dependencies [fce0494]
- Updated dependencies [51ca29e]
  - @weasel-js/font@1.15.0
  - @weasel-js/text@1.15.0
  - @weasel-js/geom@1.15.0
  - @weasel-js/stroke@1.15.0
  - @weasel-js/paint@1.15.0
  - @weasel-js/registry@1.15.0

## 1.14.2

### Patch Changes

- 012cae5: Shader commands and mesh gradients stay exact far from the origin. A shader command's kit vertex stage now
  takes `u_worldOrigin`, a world point near its bounds, and `u_screenToLocal`, composed in doubles, and exposes
  `v_worldLocal`, the world point measured from that origin, beside `v_world`, which it now computes from them
  rather than by inverting `u_view` in float32. A consumer shader drawing detail far out reads `v_worldLocal`
  (a periodic one, `mod(u_worldOrigin, P) + v_worldLocal`); `u_screenToLocal` and `u_worldOrigin` are kit
  uniforms, so a shader must not set them. `PaintBindContext.spaceInverse` takes an optional point to measure
  paint space from, subtracted in doubles; the mesh gradient measures from its bake's corner and its vertex
  stage takes `u_origin`, so its geometry is rebased like the kit's own paths.
- 56f9771: Small atlas text keeps its ink where it moves. Where a pixel spans more than `GLYPH_AREA_FROM` (0.2) field
  units, about 30px an em on a runtime canvas page and 40 on Inter's baked atlas, `glyphCoverage` blends
  toward the mean of four field taps on a rotated grid, a box filter over the pixel, and takes nothing else
  from `GLYPH_AREA_FULL` (0.3) up. A stem narrower than a pixel no longer inks by where it sits, so a 16px
  `H`'s ink centroid stays within 0.04px of its position at every sub-pixel offset, where it swung by 0.66px.
  
  The taps cost nothing elsewhere: only a run holding glyphs that small draws with a build of the batch program
  that has them, and every other run's fragments cost what they did before (`fill-rate`'s `batch` and
  `batch-glyph-large`, teitou). A fragment taking the taps costs about 2.2 times a plain one.
  `GLYPH_POINT_COVERAGE_GLSL` is the coverage without them, and `glyphNeedsArea` says which a caller staging
  glyphs needs.
  
  This changes `GLYPH_COVERAGE_GLSL`'s contract: a program pasting it in must first define
  `vec4 glyphTap(vec2 uv)`, returning the atlas sample at `uv` through `textureLod` at level 0, because the
  taps run inside a branch where `texture()` would take its level from an undefined derivative.
- dedcb92: Nested rect clips stay in the batch. Clipping in the batch shader now merges planes that face the same way, so any depth of nested axis-aligned clips keeps four planes, and a slanted item across them no longer falls back to the stencil. 512 such items across three nested clips went from 3,584 draws to 32.
- c5cba19: Building a text command allocates less. `resolveRuns` sizes its result up front and builds each run with its fields in one literal, `textCommandFromRuns` resolves the style into a reused object through the new `resolveTextStyleInto`, and a HUD text widget keeps its fill and style objects while its color and font hold. Additive: `resolveTextStyleInto(out, style, paint, scale)` from `@weasel-js/text` writes what `resolveTextStyle` returns into `out`, clearing `script`, `lang` and `stroke` when the new resolution has none.
- 64b59af: A fill or a centered stroke with `vertexColors` joins the batch with the solids, images, gradients, and text
  around it, rather than ending the run and drawing alone with a color buffer created and deleted every frame.
  The colors are interpolated and mapped by a group's color matrix as before. An even-odd fill, an inside- or outside-aligned
  stroke on a polygon, and a mesh past the batch's vertex cap still draw for themselves.
- Updated dependencies [56f9771]
- Updated dependencies [3c3e00b]
- Updated dependencies [9b0c6ee]
- Updated dependencies [4bba14d]
- Updated dependencies [c5cba19]
- Updated dependencies [dec74a9]
  - @weasel-js/font@1.14.2
  - @weasel-js/text@1.14.2
  - @weasel-js/registry@1.14.2
  - @weasel-js/stroke@1.14.2
  - @weasel-js/geom@1.14.2
  - @weasel-js/paint@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/font@1.14.1
  - @weasel-js/geom@1.14.1
  - @weasel-js/paint@1.14.1
  - @weasel-js/registry@1.14.1
  - @weasel-js/stroke@1.14.1
  - @weasel-js/text@1.14.1

## 1.14.0

### Patch Changes

- d6221a7: A convex clip that is not an axis-aligned rect (a rect turned off the axes, a convex polygon of up to eight edges) no longer breaks the batch on a single-sampled canvas: the batch shader tests each fragment against the clip's edges, snapped to a sixteenth of a device pixel, and keeps exactly the pixels the stencil would. On a multisampled canvas, which is the browser default, such a clip still goes on the stencil: WebGL2 gives a fragment shader no way to keep some of a pixel's samples and drop the rest.
  
  `DrawContext.batchFillMatrices` is replaced by `DrawContext.batchVariants`, which also carries the hull-clipping builds; code that builds its own `DrawContext` and set the old field needs to set the new one.
- 7b048f4: A group's effects now run in a buffer covering what the group paints, grown by how far its effects reach, rather than one the size of the drawing buffer. Content just past the edge of the canvas is drawn into it, so a blur or shadow of a shape lying off the canvas now reaches in across the edge, where before it was missing. A small blurred group runs its passes over its own rect, not the whole canvas. Effects that do not set `reach`, and composites that change pixels outside their group (`destination-in`, `copy` and the like), still run over the whole canvas. A retained layer holding a group whose effects set `reach`, an isolated group or a composite group now follows a pan like any other retained layer. Effect buffers are pooled by size, and a size no group used in a frame is freed at the start of the next.
- aba8563: Inside a group's effects buffer, a retained group's surface and the offscreen paint behind text filled with a registered paint kind now cover the buffer's whole window rather than stopping at the drawing buffer. Content of either lying just past the edge of the canvas now feeds a blur or shadow around it, as a direct draw already did.
- 2f3d924: Text runs can turn their glyphs. A `StyledRun`'s new `rotate` turns each of its glyphs that many degrees, clockwise, each about its own pen on the baseline, as SVG's `rotate` does; the glyphs keep their places along the line. Layout carries it on each `PlacedGlyph` as `rotate`, and the renderer draws it on every tier: atlas and canvas quads, color glyphs and outline glyphs, with painted bounds grown to hold the turned glyph. `textToPath`, `textClusters` and PDF export turn the glyphs the same way.
  
  SVG import reads `rotate` on a `<text>` or `<tspan>` instead of warning: each value turns one glyph, a glyph past the end of a list takes its last value, and a `<tspan>`'s own list wins over the text's. A list naming different angles over white space SVG collapses is reported and not read. Export writes a run's turn as `rotate` on its `<tspan>`.
  
  This adds API: `StyledRun.rotate`, `ResolvedRun.rotate`, `PlacedGlyph.rotate`, `LaidOutOutlineGlyph.rotate`, `glyphTurn`, and `penX` and `rotate` on `LaidOutQuad`. `QUAD_STRIDE` is now 11: each packed quad in `LaidOutGroup.quadData` gains its pen and its turn after `baselineY`, so code reading `quadData` by a hard-coded stride of 9 breaks.
- 8763fc3: An `{ kind: 'image' }` paint with no `width`/`height` tiles an SVG at the picture's natural size, so an image node with the same `src` re-rasterizing it larger no longer makes the tile jump. `TextureEntry` gains an optional `size`, the extent a texture stands for when its pixels are a resampling, which a texture paint with no extent tiles at.
- b0a55a6: A fill or stroke can now tile a picture: `{ kind: 'image', src, width, height }`, a new pattern paint kind beside the built-in tiles. `src` is anything an `<img>` loads, and a `data:` URI makes the paint carry the picture itself, so it saves, copies and exports with nothing stored beside the document. `width` and `height` are the tile's size in paint units; left out, the picture's pixel size is used. The fill draws nothing until the picture has decoded, then repaints.
  
  This adds API. `@weasel-js/paint` exports `ImagePatternPaint`, `TileExtent`, `ResolvablePatternKind` and `isImagePatternPaint`, and `isPatternPaint` now answers true for an image paint. `TexturePaint` takes an optional `width` and `height`, which set its tile size in place of the texture's pixel size. `resolveFillPattern` resolves an image paint to a `texture` paint. Code that switches over every `Paint` kind meets a new member.
  
  `@weasel-js/svg` writes an image paint as a `<pattern>` holding one `<image>` that fills the tile, and reads that structure back from any editor's SVG, `xlink:href` included. An image paint with no `width` and `height` cannot be sized as an SVG pattern and is left out with a warning.
  
  `PatternPicker` gains an image swatch after the tiles that opens a file picker. The picked file is stored as a `data:` URI, re-encoded down to 1024 px on its longest side if larger (an SVG is kept as it is), and the size switch then sets the tile's longest side to 32, 64, 128 or 256 units. A new `readImage` prop replaces that step for an app that stores images elsewhere. `readImageFile`, `seedImagePattern` and `MAX_STORED_IMAGE_SIDE` are exported.
- 8e6ed97: A `PolygonPath` can carry an `origin`, the point its `coords` are measured from, in doubles; a `Mesh` built from one carries it too. This adds API. Far from 0 a float32 coordinate loses its fraction (at x = 262,144 it sits on a 1/32 grid, 2 px at 64x); measured from an origin beside the shape it keeps it. `PathBuilder.setOrigin(x, y)` builds such a path from points given in the path's own space.
  
  The renderer draws one where its origin puts it, batched or by its own draw, filled, stroked, clipped, and culled. `tessellate`, `tessellateStroke`, `markerHeads`, `strokeToPath`, `transformPath` and `boundsOfPath` honor it, and so does a node's stroked bounds.
- 941f382: A slanted item (a turned rect, a mesh, a slanted glyph) crossing an axis-aligned rect clip no longer breaks the batch on a single-sampled canvas: the rect clip goes to the batch shader as four half-planes for that item, while axis-aligned items inside it are still cut on the CPU. To make the two agree pixel for pixel, a rect clip on such a canvas now has its edges snapped to a sixteenth of a device pixel, the grid convex clips already use, so an edge that sat within a thirty-second of a pixel of a pixel center can now keep or drop that column. On a multisampled canvas nothing changes.
  
  `ClipEntry` gains a required `uncutHulls` field; code that builds clip entries itself needs to set it.
- 561472d: Looking up a text command's layout and painting builds no options or result objects per command per frame: the renderer refills one of each. Every text command drawn pays this, unchanged ones included.
- c66c536: Copying a retained surface out of its multisampled buffer now leaves whichever framebuffer was bound before it, rather than the default one. No drawn output changes: the one caller already rebound its target afterward.
- cbb344e: `DEFAULT_RETAIN_BUDGET` is 384 MiB, up from 256. With the smaller scratch buffer a frame peaks lower than before, and 16 canvas-sized world layers at 1280x800 and dpr 2 now get the margins a pan needs: a pan frame costs 0.35 of submitting them, where it cost 0.98.
- 4c0141f: A group carrying `retain` that also has `effects` or `isolate` is now retained: its surface keeps what the group's own buffer composites, effects run, so a still frame runs none of its passes. A retained group inside another group's effects buffer, such as a layer in a `LayerGroup` with effects, now composites into that buffer instead of drawing straight through; it is drawn single-sampled there, as drawing into that buffer is. `drawLayers` now marks a layer with `effects` for retaining under the same rules as any other layer. A retained group inside another retained group is still drawn straight through.
- d3fdba8: A retained group holding a custom shader drawn through the kit's vertex shader now keeps a surface covering only the shader's `bounds`, not the whole drawing buffer. Adds a kit uniform: a fragment shader that declares `uniform vec2 u_fragOrigin;` is given the offset to subtract from `gl_FragCoord.xy` to get its device pixel in the renderer's own drawing buffer, which a tile of a shared canvas, a group's effects and a retained surface each move. A program reading `gl_FragCoord` without declaring it, or supplying its own vertex shader, still makes its retained layer keep a whole-buffer surface.
- f9282f7: A retained world layer now keeps its surface through a pan. `drawLayers` marks an unchanged world layer for retaining while the view only translates, and stops only for a zoom. The renderer composites the kept surface moved when the pan is a whole number of device pixels and what it drew still covers the buffer; past that it draws the surface again with a margin of an eighth of the buffer past each edge, so following pans keep reusing it. A pan by a fraction of a device pixel draws the layer straight through, keeping the surface, until the view holds for a frame. A layer holding a custom shader, a gradient or pattern in screen units (the default), a world-unit paint with no view matrix, a texture paint on text, or a group with effects, isolation or a composite operator is drawn straight through while the view moves instead, since those do not move with it, and drawn again once it holds; so is a layer whose margin the budget has no room for. `RetainedSurfaces.lookup` now returns what to do (`kept`, `redraw` with the window to draw, or `through`) rather than pixels or `null`; `RetainedSurfaces` is internal.
- 0509c29: A retained surface larger than 1024 device pixels on a side is drawn in tiles of that size, each resolved into its place in the surface, so the multisampled scratch buffer a frame that redraws holds is at most 1024x1024 rather than as large as the largest surface: 38 MB at 4x, with the single-sampled copy tiles resolve through, where a surface with pan margins on a 2560x1600 buffer took 205 MB. A child whose bounds miss a tile is not drawn for it. The pixels match drawing the surface whole, except that a sample an edge passes within float rounding of can flip. A frame that redraws costs more: redrawing four layers with pan margins at 1280x800 and dpr 2 took 9.7 to 15.5 ms tiled, against 9 ms whole.
- 3803ba2: A retained layer holding text gets a surface the size of its text rather than the whole drawing buffer. Text is bounded by its laid-out glyphs, each grown by a margin for ink past its advance cell (half an em beside it, an em and a half above its baseline, an em below) and by its run's outline stroke. The same bound now also culls a group with `effects` that holds text, and sizes the raster a PDF export draws such a group into.
- f645651: Text rewritten every frame stops allocating its layout and quad arrays. Adds API: `dropRuns(runs)` tells the text caches a runs array will not be laid out again, and `cachedLayoutRuns` and `cachedPaintRuns` take a last argument, `'keep'` (the default) or `'read'`, for a caller that is done with the result before its next call. A layout that no runs array files, that the structural list has let go, and that every caller only read gives its arrays to the next layout and painting of the same size. The renderer reads; a HUD text widget drops the runs it replaces. Results are unchanged.
- 95eb9d3: Drawing a text command whose runs and options have not changed builds no strings and no style object. `cachedLayoutRuns` compares a runs array's last options field by field before building its variant key, `cachedPaintRuns` answers a runs array asked again at the same outline threshold without building its paint key, and `drawText` reads the four style fields it lays out with instead of resolving the whole style each frame.
- 7507e13: Drawing a glyph group allocates less each frame. `textureCacheKey` and `glyphFieldScale` keep their last answer, which is nearly always the next one asked for, rather than building a new string and pair per group, and the renderer stages a group's text color through one reused array where no color matrix maps it. Every frame of a static label pays these, as well as text that changes.
- Updated dependencies [79357fc]
- Updated dependencies [38bb299]
- Updated dependencies [e1bbdcd]
- Updated dependencies [e974dba]
- Updated dependencies [30582cb]
- Updated dependencies [2999820]
- Updated dependencies [b142892]
- Updated dependencies [ec07e24]
- Updated dependencies [6d5f7c2]
- Updated dependencies [14f8583]
- Updated dependencies [2f3d924]
- Updated dependencies [783756a]
- Updated dependencies [2692828]
- Updated dependencies [b0a55a6]
- Updated dependencies [e7fca17]
- Updated dependencies [64d4e97]
- Updated dependencies [d7d29f9]
- Updated dependencies [a58fb4f]
- Updated dependencies [8e6ed97]
- Updated dependencies [6b1b532]
- Updated dependencies [5af16a6]
- Updated dependencies [966c37f]
- Updated dependencies [9ef7751]
- Updated dependencies [d68c4f8]
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
  - @weasel-js/text@1.14.0
  - @weasel-js/stroke@1.14.0
  - @weasel-js/paint@1.14.0
  - @weasel-js/geom@1.14.0
  - @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- 16464c5: `cullDrawCommands` now culls a group with effects: it drops one whose children's bound, grown by
  how far its effects reach and cut by its clip, misses the cull rect, and keeps it whole otherwise. A
  group whose effects do not say how far they reach is still always kept. Effect reach is in device
  pixels, so `cullDrawCommands` takes the density as a new, required fourth argument, `dpr`.
  
  That density reaches a layer through a new `LayerDims` type, `Dims` plus `dpr`, which is what
  `RenderLayer.draw` and `deps`, `drawLayers`, `drawOneLayer`, `CanvasViewHandle.draw` and hud's
  `HudContentCtx.dims` now take. A layer written against `Dims` still type-checks; code that calls
  `draw` itself must pass `dpr`. `SceneViewCull` gains `dpr` too, which `sceneViewFrame` and
  `renderSceneToCanvas` fill from their `dpr` argument. These are breaking for direct callers.
- 9a76fb5: A text layout holds its code points in columns of numbers, and painting it reads them there, so text re-laid out every frame — a HUD readout — no longer leaves a cell, a placed glyph and a quad object per glyph for the garbage collector. A line's `cells` and `glyphs` and a group's `quads` read as before, built the first time something reads them. A `LaidOutGroup` gains `quadData`, its quads packed `QUAD_STRIDE` (exported) numbers each, which is what the renderer draws from, and a color group gains `colorGlyphs`.
- Updated dependencies [9a76fb5]
- Updated dependencies [7e5f9e3]
- Updated dependencies [c7516cd]
- Updated dependencies [8c39126]
- Updated dependencies [769eef8]
- Updated dependencies [4c113da]
  - @weasel-js/text@1.13.0
  - @weasel-js/geom@1.13.0
  - @weasel-js/stroke@1.13.0
  - @weasel-js/font@1.13.0
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
  - @weasel-js/stroke@1.13.0-rc.0
  - @weasel-js/text@1.13.0-rc.0
  - @weasel-js/font@1.13.0-rc.0
  - @weasel-js/paint@1.13.0-rc.0
  - @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- 929736f: `@weasel-js/pdf` draws a group's Porter-Duff `composite` exactly instead of source-over. With a `rasterize` hook, a group whose composite is anything but `source-over` is handed to the hook together with everything the page drew before it, inside the groups it sits in, so the renderer composites it onto its real backdrop; the raster is placed on white paper over the group's bounds, or over the whole page for an operator that clears what the group leaves empty. An isolated group holding such a composite is rasterized whole. The hook's signature is unchanged; without one, a composite is still drawn source-over and reported in `skipped`.
  
  `@weasel-js/renderer` exports `leavesUncovered(composite)`, whether an operator leaves the destination as it was wherever the source is empty, and `readsBackdrop(commands)`, whether any group in a list has its own composite.
- d9fd036: `@weasel-js/pdf` rasterizes a group with effects over the group's bounds grown by how far its effects reach, rather than over the whole page, so a small blurred badge no longer costs a full-page bitmap. An `Effect` can now say how far it reaches with the new optional `reach`, in device pixels; `blur` sets it, and `effectsReach` (`@weasel-js/renderer`) adds up a stack's. An effect without one, such as `vignette`, still covers the whole page. The renderer's retained surfaces use the same bound, and `commandsBounds` takes the scale the commands will be drawn at.
  
  `screen`-unit paint inside a rasterized group now lands in the PDF where the vector path puts it, in page points rather than raster pixels. `WeaselRenderer.render` takes `screen` in its options, naming what screen space is when it is not the drawing surface, and `renderSceneToPixels` and a raster session's `render` pass it through as `screen`.
- Updated dependencies [dbd6711]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [400b393]
- Updated dependencies [40d87f7]
- Updated dependencies [78f29de]
- Updated dependencies [2c52cc5]
- Updated dependencies [94ebd35]
- Updated dependencies [24f2495]
- Updated dependencies [3bf5edb]
  - @weasel-js/geom@1.12.0
  - @weasel-js/paint@1.12.0
  - @weasel-js/text@1.12.0
  - @weasel-js/stroke@1.12.0
  - @weasel-js/font@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- 1dd65f5: `<Canvas>` and `<SceneCanvas>` take an `imageMinification` prop, forwarded to the renderer: `'auto'` builds an image's mipmaps the first time a frame draws it at half size or smaller, so a large bitmap drawn small stops aliasing. The default stays `'linear'`. `WeaselRenderer.setImageMinification` changes the strategy after construction; a change frees every image texture, and each re-uploads when next drawn.
- c29ac84: New package, `@weasel-js/pdf`: `writePdf` turns draw commands into a PDF document — vector paths, gradient shadings, images, and fonts embedded whole so text can be selected and copied. `@weasel-js/font` adds `fontEmbedding` and the `FaceEmbedding` type, and a custom outline parser can supply one through the new optional `OutlineFace.embedding`; the built-in parser offers none for a WOFF file. `@weasel-js/renderer` exports `markerDrawCommands`, `commandsBounds`, `isOwnComposite`, `applyColorMatrix` and `composeColorMatrix`, and `resolveStrokeLengths` takes `{ quantize: false }`; `@weasel-js/text` exports `syntheticBoldOffset` and `emboldenGlyphD`; `@weasel-js/diagram-formats` adds `exportPagesPdf`, every page of a diagram as one PDF.
- f148f50: Laying out and drawing text that changes every frame makes about 40% less garbage: 6.0 MB a frame against 9.7 for 5,000 glyphs of HUD readout. `paintRuns` no longer builds a group key string for a glyph keyed like the one before it, `lineDecorations` no longer builds a paint key for undecorated text, `measureRuns` makes one entry object a code point instead of two, and the renderer passes each glyph quad to its batch as an object rather than as fifteen numbers V8 had to box.
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
  - @weasel-js/geom@1.11.1
  - @weasel-js/stroke@1.11.1
  - @weasel-js/font@1.11.1
  - @weasel-js/text@1.11.1
  - @weasel-js/paint@1.11.1
  - @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- b0f392c: `<Canvas retain>` sets how a canvas retains its layers: `minCommands` is the
  threshold a layer must reach, `budget` the GPU memory retained layers share,
  and `false` retains no layer on the canvas. `<SceneCanvas>` passes it through.
  `WeaselRenderer.setRetainBudget` changes the budget after construction. New
  API; nothing existing changes.
- 7162a7a: Corner shape: any corner anchor of a path takes a CSS `corner-shape`, and its radius can be changed later. Additive: `PolygonPath` gains `corners`, an optional `CornerSpec` (`{ shape, radius }`) per flat anchor index, where `shape` is one of the six `corner-shape` keywords (`square`, `squircle`, `round`, `bevel`, `scoop`, `notch`) or a finite `superellipse()` parameter, and `radius` is how far along each edge the cut starts. Following CSS Borders 4, every keyword is a point on one parameter, k: `square` is ∞, `squircle` 2, `round` 1, `bevel` 0, `scoop` -1, `notch` -∞. `cornerShapePieces(k, frame)` draws a corner for any k as the quarter superellipse `|u|^n + |v|^n = 1`, `n = 2^|k|`, spanned from the corner's center for k > 0 and from the outer corner for k < 0, fitted with cubics within `CORNER_FIT_TOLERANCE` of the setback and exact at k = 0, ±1, and ±∞. The command stream keeps the bare anchors, and `resolveCorners` expands the specs into plain geometry, each cut clamped so that the two cuts on a segment never overlap; `resolveCornersWithSources` also answers which source anchor each expanded anchor came from, and `remapPerAnchor` carries a per-anchor array across, so the renderer draws `vertexColors` on a cornered path with every point of a cut in its corner's color. Every reader of a path's geometry calls it first: tessellation, `extractPolylines`, the hit tests, `boundsOfPath`, `pathDistanceToPoint`, the booleans, `offsetPath`, the renderer's path draw, and `serializePathD`, which `@weasel-js/svg` now exports. A spec rides on its anchor through `pathToAnchors` / `anchorsToPath` (`PenAnchor.corner`), so anchor inserts and deletes keep it in place, and `transformPath` scales radii with the geometry. Also new: `cornerFrames` and `cornerFrameAt` (where each corner anchor can be cut, and how far), `withCorner`, `cornerAt`, `cornerSpecAt`, `cornerShapeK`, `cornerKeywordOf`, `isCornerShape`, `nextCornerShape`, and `CORNER_KEYWORDS`.
  
  `@weasel-js/path-tools` adds `cornerShapePreset` (and `createCornerShapePreset(style)`), which edits corners in path edit. Each corner anchor shows a widget just inside it, a small tile cut in the corner's shape, drawn and pressed as `corner:N` (matched by routing's new `isCornerWidget`) while chrome-caps shows `path-edit.corners`, which is on by default. A drag on one (`editCornerAction`) sets the corner's radius live and commits one undo step; pressing the widget of a selected anchor sets every selected corner. `cycleCornerShapeAction`, in the `anchors` group, steps the selected corners through the keywords, and `setCornersAction` sets their shape or radius from its `shape` and `radius` params, typed for `<SceneCanvas tune>`. `CORNER_CONTROLS`, `cornerControlsState`, `cornerControlsParams`, and the `useCornerControls` hook are a prefs-form panel over the selected corners: the keywords, a curvature slider from -4 to 4, and the radius, mixed where the corners differ.
  
  A path-edit extension's part (`PathEditPart`) can carry its own `hitRadiusPx` and a `standoff`, a screen-pixel push along a world-space normal, so it keeps its distance from the path at any zoom.
  
  A `PathEditHost` can own the anchor selection too, through optional `selectedAnchors` and `setSelectedAnchors`, so an app seeds which anchors start selected and shows what is selected. Giving a sharp corner a shape, through `setCorners` or `cycleCornerShape`, also gives it a radius: the call's own, or a quarter of the room the corner has.
- eec8a5b: An `EffectRun` can carry a picture per output: `previews: { [port]: ImageBitmap }` on a stage's entry. A look's `showPreviews` option (on `nodeGraph`, `rack` and `lanes`) keeps a slot per output, `previewSize` big (default `PREVIEW_SIZE`, a 48-unit square, or `{ width, height }`), laid out from the first draw so a run filling it never lays the chart out again. Until a run fills a slot it draws as an empty frame, and it fades with its stage. `paintRun` fills it by a data edit, so a run that hands back the same bitmap writes nothing to the scene and uploads nothing; `EffectChart` frees the texture of a bitmap the next run no longer shows, and of every one it shows when it unmounts. `RunRowOptions` is the shared type of `showValues`, `showPreviews` and `previewSize`, and `previewRowId(port)` names a slot.
  
  `bitmapSrc(bitmap)` (renderer, re-exported by core) names an `ImageBitmap` made at runtime as an image `src`, so an image node draws it with no load. The same bitmap always gets the same name; the cache holds it weakly and never drops it to fit its budget, and `releaseImage` frees its textures and retires the name.
  
  A body's `slot` row takes a `width`: the body is at least that wide and the slot's box is that wide, centered. In `diagramScene`, a slot with an `id` becomes a scene node of that name, an empty frame, ready to be filled by a data edit. `DiagramSceneData` gains `image`.
  
  `lanes` widens a source or sink stretched taller than it measured, so its round ends no longer eat into its rows.
- 02cbe1d: More of the kit boxes a stroked node by its stroke as drawn, through `drawnBoundsOf`:
  
  - The selection overlay takes a `scene`. With it, a pose from `getPose` is outlined on the node's stroke, and a container's union takes its members as drawn. `<SceneCanvas>` passes its scene when a `selectionOverlay` slot supplies its own `poseById`, unless `geometry.boundsIncludeStroke` is `false`.
  - `composeSelectionPose` takes a `scene` and a `viewScale`, so a selected container's pose reaches its members' strokes.
  - `useAlign` takes a `scene` and a `viewScale`, and lines up drawn edges when given them.
  - `<Canvas>` takes `nodes`, and its default bounds then box each node as drawn.
  - `kit:text` reports a `drawnBounds`: a stroked line that reaches its layout box's edge grows the box by the stroke's reach.
  
  A `{ px }` stroke is now measured as the renderer draws it. `drawnBoundsOf`'s `scale` accepts a per-axis view scale, and with one it hands painters `NodeInkCtx.screen`, the map from the node's frame to screen pixels. Rects, ellipses, and text outset each side by the stroke as it lands on screen, and paths, polygons, and stars build the ribbon in the same space the renderer does, so the box is exact under a stretched view and under a skewing or stretching `transform` rather than right only at the mean scale. Chrome, resize, rotate, flip, align, and distribute pass the view's per-axis scale.
  
  `@weasel-js/renderer` exports `resolveStrokeLengths`, which resolves a stroke's `{ px }` lengths against a transform and names the spaces each part is built in.
- a988460: `EffectChart` draws a run of its pipeline.
  
  - **`run` prop.** An `EffectRun` sits beside the pipeline, keyed by stage id: each stage's `cost`
    in milliseconds, a decision's `taken` output, and each output's `values` as text. The chart
    fades a stage the run never reached and its wires, fades a decision's wires to outputs it did
    not take, writes each cost above its stage's corner, and fills in value rows. A run edits the
    scene in place: no new layout, no refit, and only the changed fields are written, so it may
    change every frame. `paintRun` and `costText` are exported for a chart of your own.
  - **`showValues`** on `nodeGraph` and `rack` keeps a row per output for a run's value
    (`valueRowId`, `NO_VALUE`).
  - **Breaking:** `stageRows(stage, showParams, withPorts)` is now
    `stageRows(stage, { showParams, withPorts, showValues })`.
  - **Body rows.** A `label` or `field` row may carry an `id`, which names its scene node
    `<body id>/<row id>` so it can be found again; and a `field` may carry `room`, a value it is
    measured at least as wide as.
  - **`EffectLookResult.exits`** maps the edges that stand in for a decision a look does not draw,
    such as `rack`'s skip arcs, to the exit each one is, so a run's `taken` reaches them.
  - **Renderer:** text now honors a solid fill's `opacity`, in its glyphs, its color glyphs (emoji)
    and its decoration rules. It was ignored, so faded text drew at full strength.
- 516914b: Curves on the live canvas now flatten against the zoom. `flattenTolerance` on
  `WeaselRenderer`, `<Canvas>`, and `<SceneCanvas>` accepts `{ px }` in device
  pixels as well as a world length, and defaults to `{ px: 0.5 }`: each path is
  flattened to stay within half a device pixel under the transform it draws
  with, so a curve at 8x no longer shows 4 px facets, and a scene whose world
  unit is not a pixel no longer needs a tolerance of its own. The tolerance is
  snapped down to a power of two and fill meshes are cached per tolerance, so a
  continuous zoom rebuilds a path's mesh once per octave rather than every frame;
  a fixed world tolerance is now cached too instead of tessellated every frame.
  `renderSceneToPixels` resolves its `flattenTolerancePx` the same way.
- 63b310c: Icons are named, not drawn, by the code that uses them. This is breaking.
  
  `@weasel-js/icons` is new. An icon is a qualified name, `namespace:name` (`core:undo`, `ui:close`, `path-tools:reversePath`), held as an `IconRef`. Each package's `icon()` makes one and qualifies its own bare names: in core, `icon('undo')` is `core:undo`. A registry supplies the glyphs: mount `<IconRegistryProvider icons variants>` from `@weasel-js/core` at the app root, or give `<WeaselProvider>` its new `icons` and `iconVariants` props. Core, ui and path-tools each publish their table at `./icons` (`import { icons } from '@weasel-js/ui/icons'`). A name no registered table holds draws a placeholder and warns in development, and draws nothing in production.
  
  `@weasel-js/icons-plugin` is new too. Its build plugin, `weaselIcons`, ships only the glyphs a build names. In an app's vite, rollup or rolldown build, `weaselIcons.vite({ mode: 'app' })` serves `virtual:weasel-icons`, holding the glyphs named by the app and by the weasel packages it imports, and fails the build on a name no table holds. `virtual:weasel-icons/all`, `/<namespace>` and custom variants each load as their own chunk, asked for with `useIconVariant(name)`. Types for the virtual modules are at `@weasel-js/icons-plugin/virtual`. The plugin is its own package so that installing `@weasel-js/icons` does not install a native parser. Core's and ui's `dist` is no longer minified, so the `@icon` annotations the plugin reads survive; a consumer's bundler minifies.
  
  What breaks:
  
  - routing: `Action.icon`, `ActionVariant.icon`, `ActionItem.icon` and `ToolPresentation.icon` take an `IconRef` from `icon()`, not a React node. So does `useCommand`'s `icon` option, which no longer takes a function read each time the command shows.
  - prefs: `PrefBase.icon` and an enum option's `icon` take an `IconRef`, not a free string. A schema saved with bare names, such as `"icon": "close"`, now draws nothing for them and warns in development; write `"ui:close"`.
  - core, ui and path-tools: the `…Icon` components are removed; draw `<Icon name={icon('core:rect')} />` instead. `NudgeAnchorsIcon` and its `dir` prop become four glyphs, `core:nudgeAnchors` (pointing right), `core:nudgeAnchorsUp`, `core:nudgeAnchorsDown` and `core:nudgeAnchorsLeft`. Core's `PaintKindEntry.icon` and `PaintKindFamily.icon` take an `IconRef`. Core's `ACTION_GLYPHS`, `IconProps` and `ActionGlyphProps` are gone, and so are ui's `ICON_PATHS`, `ICON_FILLS`, `ICON_GROUPS`, `MARK_ICONS`, `IconName`, `MarkIconName`, `FillableIconName` and `ActionIconSource`.
  - ui: `<Icon name>` and `mark`, `actionIcon` and `ActionBar`'s `icons` take `IconRef`s, and `isFillable` takes a glyph. `resolveIcon` draws a ref, or a qualified string read from data. `iconFromData(value)` reads a name from data as a ref, warning once in development about a bare one.
  - labkit: `CommandItem`, `ToolItem`, `ViewportControl` and `TrialTool` take an `IconRef` as `icon`, and so does `ConfigOption.icon`. `IconComponent`, the nine ui icon components labkit re-exported, and its `ICON_PATHS` and `IconName` are gone.
  - forge: `GlobalDeclaration.icon` takes an `IconRef`. `FrameSetup.icons` registers an app's own tables in every frame. A story's `control.icons` argTypes option takes qualified names (`'ui:statusSuccess'`); a bare `'statusSuccess'` now draws nothing.
  
  `@weasel-js/registry` exports `isDev()`, which `@weasel-js/react` re-exports. It reads `process.env.NODE_ENV`, which a production bundle folds to `false`, and the development diagnostics in core, routing, ui, labkit, renderer and animator all read it.
- 925dde2: A retained group's surface covers only the device pixels its children can
  paint, clamped to the drawing buffer, and is composited as a quad over just
  that rect; the multisampled buffer it is drawn in is as large as the largest
  surface rather than the canvas. A layer's retained memory now follows its
  content: a small layer on a large canvas holds a small texture. Text, custom
  shaders and `effects` cannot be bounded yet, so a surface holding them still
  covers the whole buffer unless a clip around them bounds it. Content wholly
  off the buffer keeps no texture and composites nothing.
- a322444: `retainBudget` now counts only the surfaces retained groups keep between
  frames. The multisampled buffer they are drawn in is transient: it is freed
  after the first frame that redraws nothing, so a still canvas holds only its
  surfaces. It used to count against the budget and took 131 MB of the 256 MB
  default at 4x on a 2560x1600 canvas, leaving room for about 8 canvas-sized
  surfaces; about 16 now fit. On a frame that redraws a surface, GPU memory can
  reach the budget plus that buffer, at most one canvas-sized multisampled
  buffer.
- 39f86d1: An unchanged layer of a few hundred commands or more is now drawn once into a texture of its own and composited as one quad on later frames, instead of being submitted again every frame.
  
  `GroupDrawCommand.retain` names the surface. The renderer keeps the group's pixels while its `children` array and everything it was drawn under hold: the enclosing transform, alpha and color matrix, the view matrix, the drawing size and dpr, and the fonts, textures, paint kinds and programs it serves. Anything else draws it again. A surface is drawn in a multisampled buffer matching the canvas's own, so its edges come out as they would have on the canvas, and it is freed at the end of the first frame that does not draw its id. `WeaselRendererOptions.retainBudget` caps the memory retained surfaces hold together (default `DEFAULT_RETAIN_BUDGET`, 256 MiB, scratch buffer included); a group past it draws straight through. `RenderStats.retained` reports how many groups were composited, redrawn, or declined, and the bytes held.
  
  `drawLayers` marks a layer for retaining once its `deps` have held for a frame and, for a world-space layer, the view has too, if it holds at least `DEFAULT_LAYER_RETAIN.minCommands` (250) drawing commands. `RenderLayer.retain: false` opts a layer out and `true` retains it whatever its size. A layer with `effects` is not retained. The new trailing `drawLayers` argument takes another `LayerRetainPolicy`, or `false` to retain nothing.
- f3398d4: The `@experimental` designation is retired. Everything that carried it is now ordinary public API: the actions registry and its built-in action descriptors and icons, the ambient pointer and selection contexts, `CanvasView`, the canvas extension API, the view resolver and viewport layer, the affordance helpers, path-tools' commands and icons, and `registerEffect`. No signatures changed.
- e562d4b: An emoji drawn larger than its 48px bake no longer blurs. The renderer asks the dynamic atlas for the cluster baked again at the power of two above its on-screen size, up to 384px, and samples that over the same box once it lands; until then it draws from the sharpest bake it has. These bakes sit on pages of their own (`sharpColorPageTextureId`, `syncSharpColorPageTexture`), which empty alone when they fill, so the base bakes and the field pages are untouched. `sharperColorGlyph` is the lookup, `rasterizeColor` takes the size to draw at, and a color group's `LaidOutQuad` carries its glyph record as `colorGlyph`.
- 7a31f9d: `textToPath` and `textToPathsByPaint` outline synthetic-bold text instead of throwing. A glyph whose weight is faked from a lighter face grows by the distance the renderer's field shift moves its edge (`SYNTH_BOLD_AMOUNT` of the field's span per texel of the atlas, 0.01 em a side on Inter's), with mitered corners and its curves kept. The `'synthetic-bold'` `TextOutlinesFailure` reason is removed, which breaks code that names it.
  
  New in `@weasel-js/geom`: `growRegion(path, distance, { join, miterLimit, tolerance })`, a filled region grown outward without a boolean. Each contour is offset, curves stay curves, and the grown contours overlap where they meet, filling once under `'nonzero'`. New in `@weasel-js/font`: `SYNTH_BOLD_AMOUNT` (moved from the renderer) and `syntheticBoldGrowth(source, family, weight, style)`, the growth in em for the atlas serving a face.
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
- Updated dependencies [66c7bde]
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
- Updated dependencies [e562d4b]
- Updated dependencies [9073669]
- Updated dependencies [f082c83]
- Updated dependencies [db8c16e]
- Updated dependencies [4df0749]
- Updated dependencies
- Updated dependencies [365ab72]
- Updated dependencies [3318cf7]
- Updated dependencies [7a31f9d]
- Updated dependencies [4cec295]
- Updated dependencies [1faab2d]
- Updated dependencies [d705830]
- Updated dependencies [329aa39]
  - @weasel-js/registry@1.11.0
  - @weasel-js/geom@1.11.0
  - @weasel-js/stroke@1.11.0
  - @weasel-js/text@1.11.0
  - @weasel-js/paint@1.11.0
  - @weasel-js/font@1.11.0

## 1.10.1

### Patch Changes

- 906fd19: A gradient or an image under a group's color matrix shares a draw with what is around it. A run of batched draws now holds up to eight color matrices, each with its group alpha, and every vertex names its own, so a matrix that mixes channels, carries a bias, or scales past 1 no longer breaks the batch around the textured things inside it. A gradient under a matrix that only scales channels down is tinted on its vertices, as an image already was.
  
  A solid or a glyph in a run that an image opened under a matrix is now mapped on the CPU like any other, where the shader used to map it; the pixels are the same.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- 0db6d9a: A gradient or a pattern drawn by the path programs keeps its place far from the origin. The matrix that takes a fragment to paint space is rebased on the CPU, in doubles, before it is uploaded: a gradient's is measured from the gradient's own start point or center, and a pattern's drops whole tiles from its translation. At world x = 262,144 and 64x zoom a `units: 'world'` gradient used to move in 2 px steps as the view panned.
- 9253a8b: A run of batched draws holds fifteen textures where it held seven, so a page mixing more than seven images, font atlases, and gradients no longer breaks the batch at the eighth. The batch shader now samples sixteen texture units, the most WebGL2 guarantees, and reaches a unit in four compares where the old chain took up to seven.
- f4100e9: A new renderer costs less to start drawing, which every one-shot `renderSceneToPixels` and every new canvas pays. In headless Chromium on SwiftShader, a one-shot render of one rect took 209 to 225 ms and now takes 129 to 139 ms, back where it was before runs held 15 textures and 8 color matrices; under ANGLE Metal with the shader cache warm, the first render went from 14 to 22 ms to 9.7 to 10.2 ms. Draws and pixels are unchanged.
  
  The batch program samples the gradient ramp atlas from a fixed slot, and a run under one color matrix draws with a program that has no matrix array to index; a run under several builds the full program the first time one is drawn. The path, vertex-color, gradient and pattern programs are built on the first frame that uses them rather than with the renderer.
- 8a9ed26: Text faked bold shares a draw with the text around it. The shift on the distance field's threshold rides each glyph's vertices where it was a uniform, so a bold run in a face with no bold atlas no longer breaks the batch on either side of it.
- Updated dependencies [cbd5b4d]
- Updated dependencies [aaa2b4f]
- Updated dependencies [c7b7ed5]
- Updated dependencies [ee59ccd]
- Updated dependencies [924edc4]
- Updated dependencies [9eefcc7]
- Updated dependencies [886380f]
- Updated dependencies [d8b51a4]
- Updated dependencies [62e766c]
- Updated dependencies [ab9ea7a]
- Updated dependencies [e962494]
- Updated dependencies [f5870a4]
  - @weasel-js/geom@1.10.1
  - @weasel-js/stroke@1.10.1
  - @weasel-js/text@1.10.1
  - @weasel-js/font@1.10.1
  - @weasel-js/paint@1.10.1
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- 2892438: Breaking: `WeaselRenderer` no longer writes `width` and `height` as inline style on a canvas it is given, at construction or in `resize`. It sets the drawing buffer and nothing else, so a caller that hands it a canvas, or calls `renderSceneToCanvas`, sizes the element itself.
  
  Breaking: `<SceneCanvas>`, `<SceneViewCanvas>`, `<DrawCanvas>`, and `<MinimapCanvas>` size their canvas through a class in `@weasel-js/core/style.css`, which a page now has to import for a canvas to be the right size. Without it the element is as large as its drawing buffer: twice too large at a device pixel ratio of 2. The class has no specificity, so a `className` whose rule sets `width` or `height` now resizes the element, where the inline style used to win. A rule that was written that way and never took effect starts to.
- d675fed: Fixes: emoji painted as flat silhouettes in the text's fill color, and an emoji of several code points painted as its parts (`👍🏽` a thumb and a swatch, `🇨🇦` two letters, a joined family three people). A grapheme cluster with emoji presentation is now one glyph, rasterized whole through a 2D canvas, kept in its own colors on RGBA pages of the dynamic atlas, and painted untinted. It takes only the opacity of the text's fill, and shares a draw with the text around it.
  
  Behavior change: this applies to every run, whatever tier serves its text, unless the fallback policy is `'none'` and the run is not on the canvas tier. A cluster's advance is now the platform's for the whole cluster, so text holding emoji measures and wraps differently than before. In `LaidOutLineBox.cells`, an emoji's closing code point holds the whole advance and `drawsInk`; the code points before it have no width and `drawsInk: false`.
  
  Adds API, `@weasel-js/font`: `resolveColorCluster(resolved, family, weight, style, cluster)`, `DynamicFace.requestCluster(text)`, `BmFontChar.color`, `syncColorPageTexture(sink, page)`, and `colorPageTextureId(page)`. `@weasel-js/text`: `LaidOutGroup.source` gains `'color'`.
  
  Breaking for an implementer of `GlyphTextureSink`: the interface gains `uploadRGBA` and `subImageRGBA`. Breaking for a reader of `LaidOutGroup.source` that treated everything but `'outline'` as a distance-field atlas: a `'color'` group's quads sample a color page.
- 67b7639: A group color matrix no longer breaks the batch for solid fills and atlas text. Their color is known before it reaches the GPU, so the renderer applies the matrix and the group's alpha to it on the CPU, with the shader's own clamp, and the shape stays in the run it would have ended. Images and gradients under a color matrix still draw under it as a uniform and still break the run. The picture does not change: in headless Chromium a solid mapped this way and an image of the same color mapped by the shader read back as the same pixel.
- de319ce: Types a public signature names are exported now, so a consumer can write them down and the API reference links to them. All additions; nothing is renamed or removed.
  
  - core: `ViewLike`, `TargetTransform`, `WeightEnv`.
  - diagram: `DiagramRouter`, `DiagramTextStyle`, `DiagramDerivePose`, `Forest`.
  - font: `DynamicFace`.
  - forge: `ArgCondition`, `ComponentHistory`, `StoryGlobals`, `StoryLayout`, `StoryViewport`, `TimelineSpan`; from `/frame`, `Channel`, `ToFrame`, `FromFrame`, `ConfigAnswers`, `FaultPhase`; from `/shell`, `StoryRegistryOptions`, `StoryChanges`, `IndexEntry`, `CssVarReport`, `TrialFrameCalls`, `Libraries`, `SchemaDescription`, `DescribedShape`, `DescribedEntry`, `SectionDescription`.
  - guides: `SnapToGuidesInsertArgs`, `SnapToGuidesMoveArgs`, and `SnapToGuidesResizeArgs`, each from its own subpath.
  - hud: `AttachHudOptions`, `SourceRect`, `LoupeBaseOptions`.
  - labkit: `MarkPose`, `AnnotationStorage`, `PaintedMark`, `ControlPanelProps`, `ControlPack`, `LoupeBindings`; from `/state`, `InstrumentHooks`; from `/config`, `Branching`, `Fields`, `FieldValues`, `Variants`, `VariantValues`.
  - paint: `InCommandUnits`, `WithPatternHandle`.
  - quantity: `FractionOptions`.
  - renderer: `ShaderStage`, `UniformArray`.
  - routing: `ToolScopes`.
  - svg: `SvgDraftPose`.
  - text-dom: `OverlayRunBase`.
  - theme: `DtcgDocument`; from `/engine`, `SemanticCommon`, `DtcgGroup`, `DtcgAxesExtension`, `DtcgLayer`.
  - ui: `ButtonBase`, `ButtonRegular`, `ButtonIconOnly`, `ToggleBarCommonProps`, `ToastFn`, `Fold`, `DistributiveOmit`, `WalkCtx`, `OverlayPoint`, `DocumentCodec`, `OpenedDocument`, `SchemaRoot`, `AnyNode`, `CurveSamplePoint`.
  
  The names for types that had none of their own to export under (`StoryGlobals`, `TimelineSpan`, `CurveSamplePoint`, the `Diagram*` three, `ShaderStage`, `DtcgGroup`, `ToggleBarCommonProps`) were chosen by an agent.
- 3a92afc: Breaking: the paint model's serialized shape changed in three ways, and its type names in two. Nothing reads the old shapes.
  
  **A fill is a record holding a paint, as a stroke is.** Every `fill` slot now takes a `Fill`, `{ paint?: Paint }`, where it took a bare paint: node data, draw commands (`CommandFill`), text styles and runs, and the affordance and overlay paint options. `fill: { color: '#abc' }` becomes `fill: { paint: { color: '#abc' } }`, beside `stroke: { paint: { color: '#000' }, width: 2 }`. `fill: null` still means no fill, and a fill with no `paint` paints nothing. `commandFill(fill, box)` resolves a node's fill for a draw command the way `commandStroke` resolves its stroke; resolving a bare paint is `commandPaint`.
  
  **A paint names its variant under `kind`, not `fill`.** `{ fill: 'linear-gradient', … }` becomes `{ kind: 'linear-gradient', … }`, the word the paint-kind registry already used. A solid still omits it. `asPaint` takes `{ kind: string }`.
  
  **Each built-in tile is its own paint kind.** `{ fill: 'pattern', pattern: { tile: 'hatch', color, lineWidth }, units }` becomes `{ kind: 'hatch', color, lineWidth, units }`, and likewise `crosshatch`, `dots`, and `chunks`. A tile a consumer rasterized itself is `{ kind: 'texture', texture: handle }`. `TilePatternSpec` is now a union keyed on `kind`, so a tile's own fields are checked instead of being optional on every tile. An SVG exported before this change carries its tiles in the old shape and loses them on import, with a warning.
  
  Follows from the fill record: `DEFAULT_SHAPE_FILL` is a `Fill`, `createPathLayer`'s `getFill` returns a `CommandFill`, `setFill` and `setFillOpacity` write the record, and the default node properties describe `data.fill` as an object with one `paint` field, as `data.stroke` is. A node whose `fill` is a string or a bare paint now paints no fill. `SelectionPanel` built from those default properties no longer offers "None" for a fill, since it offers none for a paint nested in a record; clearing one goes through the `setFill` action.
  
  A tile paint has a `color`, so `'color' in paint` no longer means solid. `isSolidPaint(paint)` answers that.
  
  Renames: `FillStyle` is `Paint`, and `GradientUnits` is `PaintUnits`. The paint types named as fills are named as paints: `GradientPaint`, `MeshGradientPaint`, `CommandPaint`, `PosedPaint`, and `SolidPaint`, with `isGradientPaint` and `isMeshGradientPaint`. `isPatternSpec` is gone; `isTilePaint` and `isPatternPaint` replace it.
  
  Adds API: `Fill`, `CommandFill`, `commandFill`, `PatternPaint`, `TilePaint`, `TexturePaint`, `TileKind`, `PatternPlacement`, `TILE_KINDS`, `isTileKind`, `isTilePaint`, `isPatternPaint`, `isSolidPaint`, `tileSpecOf`, `patternPlacementOf`, and `seedTile`. A paint kind can name a `family` (`PaintKindFamily`); kinds sharing one are a single segment in `PaintInput`'s kind bar, and the built-in tiles and `texture` share `patternFamily`.
- 66d5455: A group can join what is under it by any Porter-Duff operator. `GroupDrawCommand.composite` and `LayerGroup.composite` are new API, taking a canvas 2D operator name (`xor`, `destination-out`, `source-in`, `lighter`, `copy`, and the rest of that family) or a `{ source, destination }` pair of blend factors for an operator with no name. The types `CompositeOp`, `BlendFactor`, and `BlendFactors` are exported from `@weasel-js/renderer` and from core's barrel. A group with an operator other than `source-over` is isolated: its children draw into a buffer of their own and the operator applies once, to the finished surface, across the whole target inside the enclosing clip. The culler keeps such a group even when every child is off screen, because an empty source still changes the destination. The operator set and the factor-pair form were chosen on an agent's judgment.
- 605ace8: The image cache holds a byte budget and drops what it can once a load takes it past. It kept every decoded bitmap, keyed by `src`, until `releaseImage` was called, and the kit never called it. It now holds 256MB of decoded RGBA by default: when a bitmap lands and the total is over, the least recently read images are released along with their GL textures. An image a live renderer drew in its latest frame is never dropped, nor one read since the previous bitmap landed, so a scene showing more than the budget stays over it instead of reloading on every paint. A dropped image loads again on its next read, which shows as one frame of placeholder for an image that scrolls back into view. `setImageCacheBudget(bytes)` is new API, exported from `@weasel-js/renderer` and core's barrel; it returns the previous value, and `Infinity` restores the old behavior. The default and the two exemptions were chosen on an agent's judgment.
- 82cc3fa: `WeaselRendererOptions.imageMinification` takes `'auto'`, a new value. The renderer uploads an image with linear filtering, as under `'linear'`, and builds its mipmaps the first time a frame draws it at two or more texels to the device pixel on either axis, counting the group transform, the display's pixel ratio, and a `source` rect. An image never drawn small is never mipmapped. `'linear'` stays the default and the screen canvas still uses it. In headless Chromium an image drawn at an eighth of its size reads the average of the texels under each pixel with `'auto'`, where `'linear'` reads one tap.
- 0db7e81: Fixes: a translucent image was multiplied by its alpha twice. A half-transparent white bitmap on a cleared canvas read back as `(64, 64, 64, 128)` where `(128, 128, 128, 128)` is right, so every PNG with soft edges drew a dark fringe. A pattern tile registered from an `ImageBitmap`, which every built-in tile is, had the same fault, and one registered from an `<img>` painted differently from the same picture registered as an `ImageBitmap`.
  
  Every image texture now holds premultiplied texels: an image command's bitmap, and a texture from `registerTexture`, whatever it was made from. The kit's shaders divide the alpha back out before a color matrix runs. Measured in headless Chromium by reading the framebuffer (`packages/renderer/src/imageAlpha.browser.test.ts`).
  
  Breaking, in two places:
  
  - A custom shader sampling a texture registered from an `HTMLImageElement` used to read straight texels and now reads premultiplied ones, as it always did for an `ImageBitmap`. Write `outColor = texture(u_image, uv)` where it had `vec4(c.rgb * c.a, c.a)`.
  - An `ImageBitmap` handed to an image command or to `registerTexture` must hold premultiplied pixels, which is what `createImageBitmap` makes by default. One made with `premultiplyAlpha: 'none'` used to be the only kind that drew right and now draws too bright wherever it is translucent: the browser uploads a bitmap as it stands, and nothing reports which kind it is.
  
  Opaque images are unchanged.
- 2425281: An image or a run of sprites inside a group whose `colorMatrix` only scales channels, each by 0 to 1 with no bias, no longer ends the batch: the scale rides the quad's vertices, as a solid's mapped color already did. Fading or darkening tints over an atlas now draw in the run with their neighbors. The pixels are the same; a matrix with a bias, a channel mix, or a scale past 1 still draws under the uniform.
- bc15034: A group command can be isolated, and a `LayerGroup` with `alpha` now fades as one surface. `GroupDrawCommand.isolate` is new API: the children draw into a buffer of their own and are composited once, so the group's `alpha` and `colorMatrix` apply to the finished picture and overlapping children no longer show through each other. A `LayerGroup` with an `alpha` under 1 or a `colorMatrix` and no `effects` is drawn that way, which is what its documentation already said; before, each member was faded on its own. This changes the pixels of any such group whose members overlap, and costs it a device-resolution buffer and one full-screen composite.
- 54174b6: Fixes: SVG import and export, the booleans, and the renderer's mesh cache disagreed with a path whose open subpaths no fill closes (`openFill: 'none'`, or `setDefaultOpenFill('none')`).
  
  - `parseSvg` stamps `openFill: 'close'` on a `<polyline>` or `<path>` with an open subpath, since SVG always closes one to fill it. Such a path now carries a field it did not, and keeps painting under a `'none'` default.
  - `serializeSvg` writes open subpaths no fill closes with `fill="none"`. A path mixing closed and open subpaths is written as a `<g>` of two `<path>`s, the group carrying the node's opacity, rotation, and metadata, so it reads back as a group of two.
  - `pathUnion`, `pathIntersect`, `pathSubtract`, `pathExclude`, `pathDivide`, and the slice cuts leave such an open subpath out of the region. This changes their result for a path that says `'none'`.
  - A mesh the renderer cached under one default rule is rebuilt after `setDefaultOpenFill` changes it, so the default no longer has to be set before the first paint.
  
  Adds API: `splitByClosure(path)` and `hasOpenSubpath(path)` in `@weasel-js/geom`, re-exported from `@weasel-js/core`.
- 01d6e4e: renderer: a new package holding the WebGL2 renderer, moved out of core. `WeaselRenderer` draws a `DrawCommand[]`; `cullDrawCommands` drops what cannot reach a rectangle; `registerProgram`, `registerTexture`, and `registerEffect` add shaders, textures, and full-screen passes. It depends on `@weasel-js/geom`, `@weasel-js/paint`, `@weasel-js/registry`, `@weasel-js/stroke`, and `@weasel-js/text`, with `@weasel-js/font` as a peer, and has no scene and no React.
  
  Everything `@weasel-js/core/renderer` exported is exported from `@weasel-js/renderer`. So are `isPaintKindKnown` and `warmPaintKinds`, `fillInPoseFrame` and `fillToBoundsFrame`, `commandFill` and `commandStroke`, `createTilePattern`, `resolvePatternSpec`, `resolveFillPattern`, `isPatternSpec`, the image cache (`getImageBitmap`, `imageStatus`, `releaseImage`, `retryImage`, `subscribeImageReady`, `isVectorImageSrc`), and `textCommand`, `textCommandFromRuns`, and `textCommandFromPose`.
  
  These were not exports of `@weasel-js/core` before and are additions: `getProgramSource`, `strokeReachAt`, `boundsMissRect`, and the draw-kind registry a paint kind's draw slots live in (`registerPaintDrawKind`, `registerPaintDrawKindLoader`, `getPaintDrawKind`, `paintDrawKindRegistry`).
  
  The mesh gradient is at `@weasel-js/renderer/mesh`, the named pattern tiles at `@weasel-js/renderer/patterns-builtin`, the recording WebGL2 stand-in at `@weasel-js/renderer/testing/glRecorder`, and the reset seams at `@weasel-js/renderer/test-seams`.
  
  `@weasel-js/core`, `@weasel-js/core/renderer`, `@weasel-js/core/mesh`, and `@weasel-js/core/patterns-builtin` still export every name they did before.
- bffba0a: `ShaderDrawCommand`, the module-level `registerProgram`, and `WeaselRenderer.registerProgram` are no longer marked `@experimental`, and a shader command's program compiles on the first frame that draws it. Before, a renderer drew a shader command only if the program had been compiled on it first, through `<Canvas shaders>` or `renderer.registerProgram(handle)`, so a custom `RenderLayer` had no way to draw one without reaching the renderer. Now a layer emits the command with the handle `registerProgram()` returned and nothing else: the renderer compiles it through the path effects and paint kinds already use. `shaders` and `renderer.registerProgram` remain, for compiling ahead of the first frame and for catching `ShaderCompileError`. A command whose id was never registered, or whose source does not compile, draws nothing and warns once, where it warned on every frame. Dropping the tag was done on an agent's judgment; `registerEffect` keeps its own.
- bbb538e: A subscriber that throws no longer stops the ones after it, and no longer throws into whatever caused the notify. This holds for a prefs store's `subscribe`, font's `subscribeGlyphReady`, and renderer's `subscribeImageReady`, which now share `@weasel-js/registry`'s emitter: the error goes to `console.error` and the rest of the subscribers run. Before, one throwing prefs subscriber made `store.set` throw, and one throwing image subscriber left the others unaware an image had loaded.
  
  For the font and renderer signals, a subscriber added during a notify now waits for the next one; a prefs store already worked that way.
- 54242f0: Breaking: `layoutRuns` no longer returns `groups` or `decorations`, and no longer takes `outlineMinSize`. It places glyphs and reads no paint; `paintRuns(laid, runs, { outlineMinSize })` derives what to draw for a layout and returns `{ groups, decorations }`.
  
  ```ts
  const laid = layoutRuns(runs, opts);
  const { groups, decorations } = paintRuns(laid, runs, { outlineMinSize });
  ```
  
  `cachedPaintRuns` is the memoized form, beside `cachedLayoutRuns`. A layout's lines each carry `glyphs`, one `PlacedGlyph` per code point in visual order, which is what `paintRuns` and `textToPath` read. The `LaidOutGroup`, `LaidOutQuad`, `LaidOutOutlineGlyph`, and `LaidOutDecoration` shapes are unchanged, and groups still come in the order their first glyph appears.
  
  The layout cache no longer keys on a run's fill, stroke, or decorations, or on the outline threshold, so two runs arrays that differ only there share one layout. It also survives a dynamic glyph bake landing: `faceGeneration()` in `@weasel-js/font` advances when faces change and holds still for a bake, where `glyphGeneration()` advances for both.
  
  Paint identity is structural, and has one definition. `paintKey`, `strokeKey`, `fillHasInk`, and `strokeHasInk` are new in `@weasel-js/paint`. Two equal gradients built separately are one paint, so text runs filled with them share a group where each used to get its own. `textToPathsByPaint` now groups a zero-width or unpainted stroke with no stroke.
  
  `@weasel-js/font` gains `metricsOf(resolved)`, the advances, kerning, and baseline of whichever tier a face resolved to, and `glyphIn` / `resolveGlyph`, which find one code point's glyph in that tier and then in the dynamic tier. Layout's missing-glyph and no-metrics warnings moved there and read `weasel:` where they read `weasel layoutRuns:`; `_resetFontRegistryForTests` and `_resetFallbackForTests` clear them. `@weasel-js/text/test-seams` gains `_resetBidiWarningForTests`.
  
  Fixes:
  
  - A run whose fill holds no paint (`fill: {}`) drew black from an atlas or the canvas tier. It now draws nothing, as `fill: null` does.
  - A run set in a canvas-tier family reported `drawsInk: true`, with no warning, for a code point its face could not rasterize. It now reports `false` and warns once, as an atlas run that escalates to the canvas tier does.
  - A default-ignorable code point (a joiner, a variation selector, a zero-width space) that the canvas tier serves as no advance and no ink is a glyph, not a miss. An atlas run that escalated one warned that it had no glyph and dropped the letter spacing of the cluster it closed; it now does neither.
  - A zero-advance glyph that escalated to the canvas tier was reported as missing until its bake landed.
  - A family the registry had already warned "will not render at all" about got a second, no-metrics warning from layout.
  - Text made only of Arabic-Indic digits or Arabic number signs triggered the "right-to-left characters but no `bidi` engine" warning, though it lays out the same with an engine. So did left-to-right text holding a byte order mark, an Arabic comma, or an ornate parenthesis.
  
  Adds to the `@weasel-js/core` barrel: `paintRuns`, `cachedPaintRuns`, and the types `LaidOutCell`, `PlacedGlyph`, `PaintRunsOpts`, and `PaintedRuns`.
- Updated dependencies [a86d79f]
- Updated dependencies [1837952]
- Updated dependencies [99553f7]
- Updated dependencies [5149cce]
- Updated dependencies [126116b]
- Updated dependencies [b1f7521]
- Updated dependencies [d675fed]
- Updated dependencies [18547a3]
- Updated dependencies [d635e84]
- Updated dependencies [06003a5]
- Updated dependencies [3777548]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [b260415]
- Updated dependencies [54174b6]
- Updated dependencies [4edad85]
- Updated dependencies [a428b54]
- Updated dependencies [335f192]
- Updated dependencies [7b9de2d]
- Updated dependencies [ea54a64]
- Updated dependencies [955defa]
- Updated dependencies [27b827e]
- Updated dependencies [ee08fa5]
- Updated dependencies [bbb538e]
- Updated dependencies [9c19d5e]
- Updated dependencies [bf9a262]
- Updated dependencies [b76089a]
- Updated dependencies [54242f0]
- Updated dependencies [6073365]
- Updated dependencies [46fcc7e]
- Updated dependencies [a297730]
  - @weasel-js/geom@1.10.0
  - @weasel-js/text@1.10.0
  - @weasel-js/font@1.10.0
  - @weasel-js/paint@1.10.0
  - @weasel-js/registry@1.10.0
  - @weasel-js/stroke@1.10.0
