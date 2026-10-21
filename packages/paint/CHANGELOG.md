# @weasel-js/paint

## 1.11.1

No changes in this release.

## 1.11.0

### Patch Changes

- 974682d: Three live path effects: a blend between two shapes, a shape bent along a path, and copies of a shape along a path. Each is one scene node whose `dependsOn` names its sources and whose path and pose both derive from them, so editing a source — moving it, or dragging its anchors — updates the effect, and it saves and loads under the registry key `kit:pathEffect`. A scene holds path effects when it registers them — `createScene({ registry: withPathEffectsRegistry() })` — since reading a source's outline needs the painters; without that the actions are disabled. `pathEffectNode(effect, sources, layer, PATH_EFFECT_DERIVATIONS)` makes one; `data.pathEffect` holds its settings. Dragging an effect drags its sources; resizing or turning it resizes or turns them, as `shapeSources` now reaches through any node whose pose derives from named dependencies, not only a container's children.
  
  The actions are in the standard set and the `paths` preset, in the `pathEffects` group (`PATH_EFFECTS_GROUP`): `blend` (Alt+Shift+B) over the first two selected shapes, `bendAlong` (Alt+Shift+W) and `repeatAlong` (Alt+Shift+R) laying the first selected shape along the second, `editPathEffect` changing an effect's settings as one coalescing undo step, and `expandPathEffect` (Alt+Shift+E, "Expand to Paths") replacing an effect with the ordinary paths it shows. `ActionParamSchema` types their params for `<SceneCanvas tune>`.
  
  A blend matches anchors contour to contour, splitting the shape with fewer at its longest segments until the counts agree, and picks the second shape's start point and direction to keep matched anchors closest; `startOffset` and `reverse` override that. Fill and stroke mix through OKLab, and a turned source turns its neighbors rather than squashing them.
  
  A `derivePath` can now paint in several parts, each in its own fill and stroke: return `pathFromParts(parts)`, and the `kit:derived` painter draws each part as itself while picking and bounds see one path.
  
  `@weasel-js/routing` adds `BROWSER_RESERVED_CHORDS` and `browserReservedChord(spec)`: the key chords a major browser or desktop takes before the page does. The new bindings stay clear of them.
  
  `@weasel-js/geom` adds the geometry: `prepareBlend` and `blendPaths`, `bendAlongPath` (refit to a tolerance, corners kept), `stationsAlongPath` and `repeatAlongPath`, `measurePath` (arc length measured once, with an optional smoothed heading, which `pointAlongPath` now uses), and `pathToCubicContours` / `cubicContoursToPath`. `@weasel-js/paint` adds `lerpPaint`, `lerpFill` and `lerpStroke`.
- d705830: A stroke can be drawn with a broad nib. `Stroke.nib` is `{ angle, ratio }`: the nib's edge in radians counterclockwise on screen, and its thinnest width as a fraction of its widest. The stroke is its full width moving across the nib and `ratio` of that moving along it, an elliptical pen's width in between, and it multiplies `vertexWidths` where both are set. Each side of a corner keeps its own width, so a square drawn with a level nib has thin level sides and full upright ones right up to the joins; a round join's arc runs between the two. `strokeToPath`, the renderer's ribbon cache, and SVG export follow it, and since a nib only ever narrows a stroke, bounds and culling are unchanged. `@weasel-js/stroke` adds `nibWidthScale`, the nib as a `WidthScale`, and `widestStrokeWidth`, which culling, picking, and flattening now share; picking used to ignore `vertexWidths`. Draw's stroke properties gain a Nib switch with its angle and thinnest ratio.
  
  A `vertexWidths` entry is a `VertexWidth`: a number, the full width centered on the path as before, or a `{ left, right }` pair giving each edge its own distance from the path, `right` being the side the normal `(−dy, dx)` points to, below a path running in +x on screen. Every reader resolves an entry through `vertexHalfWidths(entry, fallback)` in `@weasel-js/paint`: the tessellator, which carries the difference between the sides as the new `Polyline.offsets` through trimming, dashing, and the nib, and centers caps between the two edges; `strokeToPath`; the inner and outer ribbon; bounds, culling, and picking, through `widestHalfWidth`; and SVG, which writes a pair as `left/right` in `wzl:vertex-widths`. `vertexWidthFromSides` writes equal sides back as a number, and `scaleVertexWidth` scales either form. An entry of zero is now a zero width; it used to take the stroke's `width`.
  
  `useGirthTool` (Shift+W), in `@weasel-js/path-tools`, edits `vertexWidths` by dragging the stroke's edges. Hovering near either edge marks the grab point on it and the width point a press there moves: the anchor at that spot, or one inserted between two with `insertAnchorOnSegment`, so the path keeps its shape. The grabbed edge follows the pointer along the path's normal and the other mirrors it, writing a number; dragging inward pinches the stroke, down to zero. Alt-drag moves the grabbed edge alone and writes a pair. The drag moves the edge as drawn, so under a nib the stored width changes by more. Every drag is previewed live and committed as one undo entry. Alt-click on a width point clears it, so it takes the stroke's `width` again. The stroke last touched shows its anchors, with a line across the stroke at each that has a width. `strokeEdgeNear` in `@weasel-js/stroke` is the hit test behind it: the edge of a stroke nearest a point, measured along the path's normal, with each side's distance as drawn.
  
  A dashed stroke now keeps its per-vertex widths, which it used to drop. The anchor-parameter rule that trimming and dashing share is `anchorParamsBetween` in `@weasel-js/geom/tessellate`.
  
  SVG has no variable width. `serializeSvg` writes a stroke with `vertexWidths` or a `nib` as its outline: the path keeps its stroke attributes at `stroke-width="0"`, which draws nothing, with the real width, the per-vertex widths, the nib, and its markers in the `wzl` namespace, and the outline follows as a filled path in the stroke's paint that draws the marker heads. A node with an opacity wraps both in one group carrying it, so they composite as one layer. Other viewers draw the outline; `parseSvg` drops it and reads the stroke back off the path, and a transform it bakes in scales the per-vertex widths with the width.

## 1.10.1

### Patch Changes

- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.

## 1.10.0

### Patch Changes

- b1f7521: paint: the CSS color parser and the gradient helpers live here now. `parseColor`, `parseColorToRgba255`, `resolveColor`, `normalizeHex`, `hexToRgba`, `rgbaToHex`, `isGradientFill`, `sampleGradientStops`, `withGradientKind`, `gradientGeometry`, and `gradientForBounds` moved from `@weasel-js/core`, which still exports every one of them. New from paint: `resolveGradientStops` and `sampleResolvedStops`, with the `ResolvedGradientStop` type.
- 18547a3: Adds API: `cssColorLiteral(css)` in `@weasel-js/paint` reads any color string `parseColor` reads as an `srgb` `ColorLiteral`, and throws as it does on one it cannot. `colorLiteralToCss(literal)` writes a literal as a CSS color: hex where `colorLiteralToHex` has one, else `color(<space> …)`.
  
  Adds API: `@weasel-js/theme` resolves a paint `ColorSource` under a theme. `colorSourceCss(source, ctx?)` writes one as a CSS color and `colorSourceLiteral(source, ctx?)` resolves one to a literal for a surface with no cascade; `useColorCss()` in `@weasel-js/theme/react` is the first against the provider in force. A `ColorRef` names, in order: an entry of the palette on the context; `tone` (`TONE_REF`) with an index into the tone list, wrapping; a theme token by its name without the `--wzl-` prefix (`{ ref: 'accent' }`); a ramp by name with the index of a step (`{ ref: 'swatch', index: 3 }`); or a custom property spelled out (`{ ref: '--my-color' }`), which need not be the theme's. A ref the theme answers is written to CSS as its custom property, so it follows a mode change without a re-render; a palette entry or a function is written as the literal it resolves to in the provider's selection.
  
  Adds API: `<ThemeProvider palette>` takes a paint `Palette` whose names a `ColorRef` in that subtree resolves before the theme's own, and `ThemeContextValue` carries it as `palette`. These rules for what a ref names were chosen on an agent's judgment.
  
  Breaking: a `tone` is `number | ColorSource`, no longer `number | string`. That is `StanceProps.tone` in `@weasel-js/ui`, so every stanced surface (`Badge`, `Button`, `Callout`, `Code`, `Dialog`, `LayerList` items, `MotifFrame`, `Powerline` segments, `PropertyGroup`, `PropertyPanel`, `Subpanel`), labkit's `ControlPanel`, `ControlMatrix`, and sidebar sections, and forge's `Library.tone`. An index is unchanged. A CSS string no longer typechecks: write a color as `cssColorLiteral('#2b6cb0')`, a theme token as `{ ref: 'accent' }`, and anything only CSS can say as a custom property of your own, `{ ref: '--my-tone' }`. A tone nothing answers now draws as no tone. `@weasel-js/ui` now depends on `@weasel-js/paint`.
  
  Breaking: the other colors `@weasel-js/ui` takes are `ColorSource` too, each written through `useColorCss`: `Plot2D`'s `grid.color` and `axes.color`, `CurveField`'s mark `color`, the `color` of a curve `fill` (`FillSettings`, on `CurveEditor` and `createFunctionLayer`), and the Badge effects' `outline.color`, `sunbeams.color`, `metal.accent`, and `aqua.accent`. Each one's default draws as before.
  
  Breaking: `@weasel-js/hud` names colors the same way. A window's `tone` (`WindowOptions.tone`, `setTone`) is `number | ColorSource`, and the draw contexts (`HudDrawCtx`, `HudContentCtx`) carry `color(source)`, a source resolved to a hex, in place of `toneAt(i)`; a widget that called `ctx.toneAt(2)` calls `ctx.color({ ref: 'tone', index: 2 })`. `AttachHudOptions.tones` is a `ColorSourceContext`, so its tone list is optional and it may carry a palette.
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

## 1.9.4

### Patch Changes

- 9ad839d: A `PathDrawCommand`'s `fill` and `stroke` are now `CommandFill` and `CommandStroke`: a pattern must name a registered texture, and no paint may be in `'bounds'` units, so a tile spec or a box-relative gradient on a hand-built command is a type error where it used to draw blank or in screen space. This is a breaking change to types: code that passes a node's `FillStyle` or `Stroke` straight into a command now calls `commandFill(fill, box)` or `commandStroke(stroke, box)`, which resolve both. Options that feed commands directly (`createPathLayer`'s `getFill` and `getStroke`, affordance paints, selection overlay and guide strokes, overlay role strokes) take the narrowed types. `<Canvas backgroundFill>`, `<DrawCanvas background>`, the rect fallback painter, a marker's own fill, and `diagramShape` now resolve their paint, so a tile spec or `'bounds'` gradient there paints.
- a8d8efb: `hexToOklchDeg` read any hex that was not exactly `#rrggbb` as a different color: `#fff` came back as blue, and `#ff000080` with its channels shifted by a byte. It now reads `#rgb`, `#rgba`, and `#rrggbbaa` as the colors they name, ignoring alpha.
- 5cd52f3: One hex color reader. `@weasel-js/paint` exports `parseHexBytes` (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` to four 0–255 channels, `null` otherwise) and `hexToRgbBytes`, and core re-exports both; core's `parseColor` and `normalizeHex`, paint's `hexToOklchDeg`, `contrastLineColor`, and `hexToColorLiteral`, theme's `hexToRgb` and `withAlpha`, and ui's token panel all read through it. Fixed along the way: theme's `hexToRgb` (and `luminance`, `contrast`, `toLab` on top of it) read `#abc` as `#000abc` and shifted an eight-digit hex's alpha into blue; `contrastLineColor` did not read a four-digit background. Behavior change: `hexToOklchDeg`, `hexToRgb`, and `parseColor` now throw on a malformed hex where they computed from `NaN`.

## 1.9.3

No changes in this release.

## 1.9.2

No changes in this release.

## 1.9.1

No changes in this release.

## 1.9.0

### Patch Changes

- 718769e: `Stroke.dash` documents its units: world units, or screen pixels on a `{ px }` stroke, which is how the renderer now draws them.
- 3088756: `Stroke.vertexWidths` documents that its entries are world units, even on a `{ px }` stroke.

## 1.8.1

No changes in this release.

## 1.8.0

No changes in this release.

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

### Patch Changes

- 365c762: A pattern paint takes a `transform`: the tile's rotation, scale and skew about
  its `origin`, as a `PatternTransform` `[a, b, c, d]` in SVG `matrix()` order.
  `composePatternTransform({ rotation, scaleX, scaleY, skewX })` builds one and
  `decomposePatternTransform` reads one back into those parts; both are exported
  from `@weasel-js/paint` and `@weasel-js/core`. The GL renderer samples the tile
  through it, and a transform with no inverse draws nothing.
  
  `@weasel-js/svg` writes the transform as `patternTransform="matrix(…)"`, with
  the origin as its translation, and reads any `patternTransform` list back into
  `origin` and `transform`.
  
  `PatternPicker` (and so `PaintInput`'s pattern mode) has a Rotation field that
  edits the rotation and leaves scale and skew alone; picking another tile keeps
  the rotation.
  
  Additive: a paint without `transform` paints and serializes as before.

## 1.7.0

### Patch Changes

- fc3de06: A `{ px }` marker size now holds its screen size through a zoom, as a `{ px }` stroke width does, and so does a default-sized marker under a `{ px }` stroke width. The line stops short of the head by the same resolved size, and a node's grab reach resolves it against the view scale.
  
  The renderer now draws a stroke's markers itself, for any path command whose stroke carries one — so a painter only sets `markerStart` / `markerMid` / `markerEnd`. `markerDrawCommands` is no longer exported: a painter that appended its commands would now draw every head twice. labkit's annotation arrows rely on the renderer, and their SVG export keeps the marker reference so the head is drawn there too.
- 6357f14: `MarkerRef`'s docs now say what `size` does: a bare number is the marker unit in world units, replacing the stroke width rather than scaling with it. They previously claimed it scaled with the stroke width, which neither the renderer nor SVG export ever did.

## 1.6.1

No changes in this release.

## 1.6.0

### Patch Changes

- c373af4: Color ramps can interpolate in OKLab, HSL, sRGB and linear sRGB as well as OKLCH. `@weasel-js/ui` adds `colorRamp(from, to, steps, options)` and `rampColor(from, to, t, options)`, whose `space` option picks the space (default `'oklch'`), `hue` picks the shorter or longer arc in the polar spaces, and `chroma` applies a `ChromaCurve` after interpolation in any space. Underneath, `@weasel-js/paint` (re-exported from core) adds `interpolateSrgb` with the `ColorInterpolationSpace` and `HueInterpolation` types, plus float-precision `srgbToLinear`, `linearToSrgb`, `linearSrgbToOklab`, `oklabToLinearSrgb`, `srgbToHsl` and `hslToSrgb`. The forge story `ui/Color/ColorRamp` shows the same endpoints ramped in each space.
- bfe6a4f: `contrastLineColor(background, strength)` derives a line color that reads against an arbitrary background — a grid or a rule drawn over a page whose color the document picks, where theme tokens follow the chrome instead. It moves the background `strength` in OKLab lightness away from its nearer end, darker over light and lighter over dark, keeping its hue, so dark and tinted pages get lines that show. Re-exported from `@weasel-js/core`.
- 6857b4d: `DEFAULT_PALETTE` is now a `Palette` of five named sRGB entries rather than a `string[]`, which breaks any code indexing it as an array. `cycleFill(seq, palette?, fallback?)` gives the `seq`th entry as hex, wrapping, and is what the built-in shape tools and the `insert` dep now call. `@weasel-js/paint` gains `hexToColorLiteral` for `#rrggbb` and `#rrggbbaa`.
- b1c30bc: The hud `window` takes a `stance` and a `tone`, like the kit's DOM panels, with `setStance` / `setTone` to change them. It draws them in WebGL from the resolved theme: the stance's `--wzl-stance-<stance>-<slot>` values restyle its fill, border and title, and the tone mixes into the fill in oklab. A numeric tone indexes the theme's tone list through the new `HudDrawCtx.toneAt`, which `attachHud` builds from its new `tones` option and `useHud` fills from the app's `<ThemeProvider>`. A widget drawn by hand, as in a test, now needs a `toneAt` in its draw context.
  
  `@weasel-js/theme` adds `resolveStanceSlots`, the stance lookup for a surface drawn without the cascade. `@weasel-js/paint` adds `mixOklab`, which matches CSS `color-mix(in oklab, …)`, alpha included.
- 9aa63a1: A `Palette` type: named entries whose colors are literals in any color space (`{ space, coords, alpha? }`), refs to other entries or to an outside lookup (`{ ref, index? }`), or functions computed at resolve time. An entry may instead hold `colors`, a factory such as a `function*` that yields a sequence, possibly endless, read lazily. `resolvePaletteColor` follows refs to a literal, `resolvePaletteColors` iterates one entry, and `colorLiteralToHex` converts `srgb`, `oklab` and `oklch` literals to hex.

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

## 1.5.1

### Patch Changes

- f644eac: The sRGB ↔ OKLab/OKLCH conversions (`srgbU8ToOklab`, `oklabToOklch`, `lerpOklch` and the rest) now live in `@weasel-js/paint`. `@weasel-js/core` still exports every one of them, so no import changes.
- 626bace: A gradient now names the space its stops blend through. `interpolate` on any of
  the three gradient kinds takes `'rgb'` (the default, and what every other vector
  format means by a gradient), `'oklab'`, or `'oklch'` — which travels around the
  hue wheel, so red to blue stays saturated instead of passing through a muddy
  purple. Alpha is linear in every space.
  
  The blend is paid for once, in the 256-texel ramp the shader samples, so a
  perceptual gradient costs a batched frame nothing over an sRGB one. The space is
  part of the ramp atlas key: the same stops under two spaces take two rows.
  
  `sampleGradientStops` and `sampleResolvedStops` take the space as a third
  argument, `bindRamp` as an optional third, and `GradientEditor` grows an
  sRGB / OKLab / OKLCh switch (`spaceSwitch={false}` hides it). `@weasel-js/svg`
  writes `wzl:interpolate` on the gradient's own element and reads it back; a
  renderer that ignores it still paints the gradient, in sRGB.
- b981856: Accept `{ px }` screen-pixel sizes for `fontSize` and `letterSpacing`
  
  `TextStyle.fontSize`, `TextStyle.letterSpacing` and their `StyledRun`
  counterparts now take `number | { px: number }`, the spelling `Stroke.width`
  and `MarkerRef.size` already had. A `{ px }` size holds its on-screen size as
  the view zooms, so a label no longer divides by the view scale at the call
  site.
  
  The unit is one type and one resolver now: `ScreenLength` and
  `resolveScreenLength` live in `@weasel-js/paint`, which both core and text
  already depend on, and `resolveStrokeWidth` delegates to it.
  
  Resolution happens at the entry to layout, not at draw time. A screen-pixel
  size changes the glyph advances and so the wrap points and the measured
  bounds, so `resolveTextStyle`, `resolveRuns`, `textPoseLayoutInput`,
  `layoutTextPose`, `measureTextBounds` and the three command builders
  (`textCommand`, `textCommandFromRuns`, `textCommandFromPose`) each take the
  view scale, defaulting to 1. `ResolvedTextStyle` and `ResolvedRun` keep plain
  world numbers, so everything downstream is unchanged.
  
  `createTextLayer` passes the mean of `view.scale.x` and `view.scale.y`, so
  non-scene text gets this with no consumer change. The `kit:text` node painter
  deliberately does not: it memoizes on `(data, pose)` to keep the renderer's
  layout cache hitting across frames, and keying that on the live camera would
  miss on every zoom frame.
  
  SVG serialization writes a `{ px }` size as that many user units — SVG user
  space has no camera — and the fit clamp on import leaves one alone, since a
  screen-pinned size is not the file's to scale.

## 1.5.0

## 1.4.4

## 1.4.3

### Patch Changes

- fc16cac: `Stroke.paint` is optional, and a stroke without one paints nothing everywhere
  rather than throwing.
  
  Such a stroke is real: a property panel that writes one field onto a node with
  no stroke — a width, a cap — materializes a whole stroke around it, and
  documents written before that was fixed still hold them. The painters already
  read one as no stroke. Every other reader dereferenced `paint` unguarded, so a
  document holding one threw on SVG export, on copy, and out of any consumer
  painter or overlay whose command reached the renderer directly.
  
  The type says so now, which is what stops the next reader from assuming
  otherwise. What each one does with an unpainted stroke:
  
  - The renderer skips the stroke pass and paints the fill.
  - The SVG serializer emits no `stroke` attributes at all, the way it already
    does for an absent or zero-width stroke.
  - Text layout keys it as no stroke, so an unpainted run groups with unstroked
    ones instead of splitting a draw call, and does not get pulled onto the
    outline tier to stroke nothing.
  - `setStrokeOpacity` seeds the default stroke color to have something to set an
    opacity on, keeping the width and joins already there.

## 1.4.2

## 1.4.1

## 1.4.0

## 1.3.0

### Patch Changes

- 94f2446: Add stroke markers — arrowheads and other line terminators as stroke style.
  
  `markerStart` / `markerMid` / `markerEnd` on `Stroke` take a key resolved
  through a new registry (`registerMarker`), shipping eight built-in shapes.
  Unlike SVG, the stroke stops short of a filled head rather than running under
  it to the tip; the distance is declared per marker, so an open V still reaches
  the vertex. Round-trips through `@weasel-js/svg` as `marker-*` attributes plus
  `<marker>` defs.
