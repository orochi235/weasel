# @weasel-js/renderer

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
