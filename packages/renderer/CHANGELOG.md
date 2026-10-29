# @weasel-js/renderer

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
