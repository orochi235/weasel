# @weasel-js/paint

## 1.18.1

No changes in this release.

## 1.18.0

### Patch Changes

- fe6a382: Stroke, paint and alignment fixes:
  
  - A closed zero-length subpath (`M5 5Z`, `M5 5L5 5Z`) draws its round or square cap as a dot, as SVG strokes it.
  - A closed subpath's last vertex takes a mid marker.
  - An inner stroke at least as wide as a rect's narrower side fills the rect, as it does the same polygon, instead of turning the rect inside out and drawing outside it. `ribbonAligns` (stroke) and `alignedStrokeRectHolds` (paint) say when a rect's aligned ribbon is built in place.
  - An upright selection outline and the selection handles' outlines are aligned once; they were shifted for `align` and then shifted again by the renderer.
  - SVG export writes gradient stops in offset order, and a stop past 0..1 as the color the ramp has there, so the file reads back as the gradient the kit paints.
  - Interpolating two gradients pairs their stops by offset, not by list position.
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
- d83476e: Fix edge cases in quantity formatting, color parsing and paint keys, and in `.lbx` output.
  
  - A `compact` value that shows as `1.00K` (999.6, say) is now spoken `1 thousand`, not `1.00K`.
  - `nearestFraction` reads a denominator cap under 1 as 1 instead of returning a fraction over 0.
  - `parseColor` throws on an empty or non-decimal channel: `rgb(255, 0, 0,)` used to parse as transparent red, `rgb(1 2 3 / foo)` as opaque, and `rgb(0x10, 0, 0)` as hex.
  - `paintKey` gives two solids one key when their colors are the same color spelled differently (`#fff`, `#FFFFFF`, `white`).
  - `sampleGradientStops` reads a NaN position as the first stop instead of writing `#NaNNaNNaNNaN`, and answers an empty stop list in hex (`#00000000`) like every other answer.
  - `hexToColorLiteral` leaves `alpha` off a fully opaque `#rrggbbaa`, as `cssColorLiteral` does.
  - `writeLbx` frames a rect drawn with a negative width or height where it lies, and writes a cut position given twice only once.
- 1e0adbb: Fix lookups, hue interpolation and bus ramps in quantity, paint and audio.
  
  - A unit, display kind or spoken unit named for an `Object.prototype` member (`toString`, `constructor`) reads as unknown: `unitScale` throws, the display falls back to `decimal`, and the unit is spoken by its name, instead of picking up the inherited function.
  - `snapToStep` and spin keys keep every decimal of a step written in e-notation: a step of `1.5e-7` now snaps to multiples of it rather than of `1e-7`.
  - `lerpHueDeg` keeps the sign of a half turn, as CSS's hue fixup and `lerpOklch` do: 180° to 0° under `shorter` now passes 90°, not 270°. This changes theme ramps between exactly opposite hues.
  - `parseColor('constructor')` and the other `Object.prototype` names throw as unrecognized colors, and `cssColorNotation` answers `null` for such a space instead of throwing a `TypeError`.
  - `paintKey` folds a solid's `opacity` into its color's alpha, so `rgba(255, 0, 0, 0.5)` and `#f00` at opacity 0.5 share a key, as they draw the same.
  - Changing one bus's gain, mute or solo no longer cuts another bus's gain ramp short: only faders whose value changed are written.
- 2455bb4: An eyedropper that samples exactly, as the loupe's complement.
  
  `@weasel-js/loupe`: `createSampler` reads an ordered stack of pixel sources and composites translucent
  layers source-over to the color a viewer sees, answering with a promise when a source does.
  `createEyedropperModel` sits beside `createLoupeModel`: `hover`, `pick` and `color`, and given a loupe,
  `hover` aims it. Breaking: `pixelHex` and `sourcePixel` are gone, folded into the sampler
  (`canvasPixelSource`, and `rgbaHex` in `@weasel-js/paint`), and `CanvasSource.sample` is now `pixel`,
  answering RGBA bytes rather than a hex.
  
  `@weasel-js/core`: a `colorAt` dep (screen point to color), which `<SceneCanvas>` sources by redrawing
  its document layers offscreen around the point — never the selection handles or other chrome over
  them. `sampleLayers` names those layers. `useEyedropperTool` samples pixels through it when given no
  `colorOf`, which is now optional. The canvas readback hud's loupe used (`createCanvasReader`,
  `readGl`, `regionOnCanvas`, `regionAround`) moves to core, beside `createLayerSampler`,
  `planLayerSample` and `RasterSession.renderCommands`.
  
  `@weasel-js/hud`: `createLoupe` in vector mode with a `source` reports the color of those layers, not
  the presented canvas.
  
  `@weasel-js/labkit`: `sampleStack` is replaced by `stackSources` over the engine sampler, which reads
  WebGL layers and composites translucent ones. A trial offers an Eyedropper toggle beside its loupe
  toggle, and one readout of the color picked whose press copies it.

## 1.17.3

No changes in this release.

## 1.17.2

### Patch Changes

- 32e0dd5: An inner or outer stroke on a rect with a negative width or height (a pose flipped by a drag past its opposite edge) stays on its own side of the rect. `alignedStrokeRect` used to shift such an axis the wrong way, so an outer stroke drew inside the rect along it and an inner one outside.
- 019b877: `colorLiteralToCss` writes `hsl`, `hwb`, `lab`, `lch`, `oklab` and `oklch` literals as their own CSS functions (`hsl(210 50% 40%)`), and keeps `color()` for the predefined spaces. Before, it wrote `color(hsl …)` and `color(lab …)`, which CSS rejects. A space CSS has no notation for now gives `null` instead of an invalid `color()`. The writer is exported as `cssColorNotation`, and `loadDTCG` writes DTCG color objects through it.
- 47679f8: `blendTheme` and the prefs color blend mix alpha premultiplied, as CSS `color-mix()` does, so a blend toward `transparent` keeps the other color's hue rather than drifting toward black. Both now go through paint's new `mixRgba` (two colors, in any `ColorInterpolationSpace`) and `mixRgbaWeighted` (any number, by weight). `mixOklab` is `mixRgba` in OKLab and now computes in float precision rather than through 8-bit channels.
- 33c0cbd: `Stroke.dashOffset` sets how far into `dash` each subpath starts, as SVG's `stroke-dashoffset` and Canvas2D's `lineDashOffset` do. A negative offset starts before the pattern's beginning, and a non-finite one reads as 0. The canvas, `writePdf` and `serializeSvg` all draw it. `parseSvg` reads `stroke-dashoffset`, which it used to drop with no warning, and `svgNodesToKitDrafts` and `svgStrokeFromKit` carry it. A `{ px }` stroke resolves the offset with its dash, `lerpStroke` interpolates it, and a stroke-mesh cache entry is keyed on it.
  
  New in `@weasel-js/paint`, and re-exported from `@weasel-js/core`: `dashPhase(pattern, phase)` wraps a phase into one cycle of a pattern, and `scaledDash(stroke, k)` scales a dash and its offset together. A trimmed stroke's PDF dash phase is now written wrapped into one cycle (`[4 2] 4 d` where it used to write `[4 2] 10 d`), which draws the same.

## 1.17.1

No changes in this release.

## 1.17.0

### Patch Changes

- 52fd33e: `lerpPaint` keeps each gradient stop's alpha. Interpolating two gradients dropped it, so a stop that faded to transparent came back opaque, at every `t` including 0 and 1.

## 1.16.2

No changes in this release.

## 1.16.1

No changes in this release.

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

## 1.15.2

### Patch Changes

- 507f539: paint exports `relativeLuminance` and `luminanceContrast`, the WCAG luminance and ratio `contrastRatio` is built on; core re-exports both. theme's `luminance`/`contrast`, its test helpers, ui's painted-contrast helpers and forge's pixel contrast readout now use them.
  
  Color strings that theme's `withAlpha`/`atAlpha`, ui's `TokenPanel` hex conversion and diagram-formats' DOT and Mermaid writers read are parsed by paint's `parseColor`. The `TokenPanel` color input now converts float and percent `rgb()` channels, named colors and `hsl()` without a browser, and diagram-formats writes percent `rgb()` channels as hex instead of passing them through. diagram-formats now depends on `@weasel-js/paint`.
  
  labkit's loupe and ui's `Timeline` ruler and lane graph measure their element with core's `useElementSize`.
- 6544399: `lerpOklch` no longer hangs when a hue is `Infinity` or `-Infinity`: the hue comes back `NaN`, as it already
  did for a `NaN` hue. Finite hues interpolate exactly as before.

## 1.15.1

No changes in this release.

## 1.15.0

No changes in this release.

## 1.14.2

No changes in this release.

## 1.14.1

No changes in this release.

## 1.14.0

### Patch Changes

- e1bbdcd: Diagram outlines are now a registrable table. `registerOutline(name, def)` adds a named outline (or shadows a built-in until disposed), `outlineFromD(d, opts)` builds one from unit-square SVG path data, and `outlineDetail` gives the strokes an outline draws over its fill. `Outline` widens to any registered name; an unregistered one paints as `rect` and warns once. Eleven built-ins join the flowchart seven: `roundRect`, `cylinder`, `document`, `note`, `cloud`, `triangle`, `octagon`, `folder`, `cube`, `actor`, and `doubleEllipse`. Each keeps its content box inside the visible shape, and `diagramShape` strokes a cylinder's rim, a note's fold, a folder's tab, a cube's front edges, and a double ellipse's inner ring.
  
  New stroke markers: the crow's-foot family `crow-one`, `crow-many`, `crow-zero-one`, `crow-one-many`, and `crow-zero-many`, and `triangle-hollow` for UML generalization. `KitMarkerKey` lists them.
  
  DOT, Mermaid, and draw-style XML read and write the new outlines and markers where the format has a counterpart. Mermaid's writer no longer throws on an outline it has no brackets for: it writes a rectangle and warns. draw-style XML reads `rounded=1` below the stadium arc as `roundRect`, a hollow `block` head as `triangle-hollow`, Mermaid reads `(text)` as `roundRect`, and DOT and Mermaid read a double circle as `doubleEllipse`. DOT reads `onormal` as `triangle-hollow`.
- b142892: Add `attachMenuDismiss` to `@weasel-js/menu`: it closes a menu on a press or wheel outside it, on the window losing focus, and on a resize, attaching to any `Window`-like target and returning a detach. `press: false` leaves out the press listener, and `keepOnBlur` keeps the menu open through a blur. ui's `ContextMenuHost` and hud's `attachMenuHost` both dismiss through it.
  
  `normalizeHex` takes an optional form: `'rgb'` drops alpha, `'rgba'` always writes it (`ff` when none was named). `tryNormalizeHex` is the same, returning undefined where `normalizeHex` throws. hud's color row and ui's `ColorField` and `TokenPanel` read hex through them. hud's hex row now accepts `#rgba` shorthand, and `ColorField` shows a malformed `#` value as black rather than passing it to the color input.
  
  core's `toHex8`, `getAlpha01`, `withAlpha01` and `mergeAlphaFromPrev` read hex through `tryNormalizeHex` too. A malformed `#` value (`#xyz`, `#12345`) now comes back unchanged instead of expanded into an invalid 8-digit string, and `getAlpha01` reads 1 from one. `toHex8` now lowercases `#RRGGBB` as it already did every other hex form, and ignores surrounding whitespace.
- b0a55a6: A fill or stroke can now tile a picture: `{ kind: 'image', src, width, height }`, a new pattern paint kind beside the built-in tiles. `src` is anything an `<img>` loads, and a `data:` URI makes the paint carry the picture itself, so it saves, copies and exports with nothing stored beside the document. `width` and `height` are the tile's size in paint units; left out, the picture's pixel size is used. The fill draws nothing until the picture has decoded, then repaints.
  
  This adds API. `@weasel-js/paint` exports `ImagePatternPaint`, `TileExtent`, `ResolvablePatternKind` and `isImagePatternPaint`, and `isPatternPaint` now answers true for an image paint. `TexturePaint` takes an optional `width` and `height`, which set its tile size in place of the texture's pixel size. `resolveFillPattern` resolves an image paint to a `texture` paint. Code that switches over every `Paint` kind meets a new member.
  
  `@weasel-js/svg` writes an image paint as a `<pattern>` holding one `<image>` that fills the tile, and reads that structure back from any editor's SVG, `xlink:href` included. An image paint with no `width` and `height` cannot be sized as an SVG pattern and is left out with a warning.
  
  `PatternPicker` gains an image swatch after the tiles that opens a file picker. The picked file is stored as a `data:` URI, re-encoded down to 1024 px on its longest side if larger (an SVG is kept as it is), and the size switch then sets the tile's longest side to 32, 64, 128 or 256 units. A new `readImage` prop replaces that step for an app that stores images elsewhere. `readImageFile`, `seedImagePattern` and `MAX_STORED_IMAGE_SIDE` are exported.
- 78213f7: Add a built-in `dot` stroke marker, centered on its anchor rather than trailing back from it like every other built-in. It is the one to reach for as `markerMid`: a terminator such as `diamond` puts its tip on the interior vertex and its body behind it, which reads as off-center. `KitMarkerKey` gains `'dot'`, and `Stroke.markerMid`'s docs now say where a head's anchor lands.

## 1.13.0

No changes in this release.

## 1.13.0-rc.0

No changes in this release.

## 1.12.0

### Patch Changes

- b571ad6: A node's `fill: 'inherit'` or `stroke: 'inherit'` now takes its nearest enclosing container's fill or stroke whole. If that container inherits too, the lookup keeps going up, and at the root it is none. A container's fill and stroke are only a source: the built-in `kit:shape` and `kit:path` painters no longer paint a container's own fill or stroke, and its interior is no longer hit for picking.
  
  The scene's draw wrapper passes the resolved paint to painters as `ctx.inherited` on `NodePaintCtx`, and pickers pass it on `NodeInkCtx`. A painter's memo has to key on it: `nodeMemo` takes an extra reference-compared key for this, and the paint stays the same object while its sources are unchanged. **A custom painter that does not read `ctx.inherited` paints an `'inherit'` field as none.** Pass the field and `ctx?.inherited?.fill` to `resolveFill` (or `resolveStroke`) to pick it up. `diagram:shape` reads it. Readers outside a painter can use `inheritedPaintIn(scene, node)` and `withInheritedPaint(data, inherited)`, and `paintAbove(scene, node)` says what inheriting would paint.
  
  SVG import turns a `<g>`'s fill and stroke into its container's, and a child that sets none of them gets `'inherit'`. A gradient, or a child faded further than its group, is still copied onto the child. Export writes a container's paint on its `<g>` and leaves the attribute off a child that inherits a solid one.
  
  `SelectionPanel` adds an Inherit choice beside None for a node's fill and stroke, showing the paint it would take. `PaintField` and `PaintInput` offer it when given `inherit` (`{ paint, onInherit }`); their `value` may be `'inherit'`, and `onChange` is unchanged.
- 400b393: A dash whose entries are all zero, or that has a negative entry, strokes solid instead of hanging stroke tessellation. A dash with a NaN or infinite entry draws no stroke, and `@weasel-js/pdf` drops and reports the command holding it. `dashPattern` (`@weasel-js/paint`) is the one reading of a dash array that the tessellator, `strokeDashStyleOf` and the PDF writer share.
- 40d87f7: A dash pattern too fine for the path it strokes now strokes solid instead of making work without bound: `dashPattern` (`@weasel-js/paint`) takes the path's length and reads a pattern that would cut it into more than `MAX_DASH_RUNS` (100,000) dash and gap runs as `'solid'`. The tessellator decides this once per path, over every subpath, and `@weasel-js/pdf` writes no dash for the same strokes. `@weasel-js/stroke` exports `dashLength`, the length a pattern runs along a path.
- 78f29de: Lenses in weaselforge. Alt+L opens the Loupe keymap, and `l` adds a lens: a bubble showing the patch
  of a story under its reticle, magnified, or rendered with a comparison such as the opposite mode, an
  arg or a DPR, as Swap, Split or Difference. A lens shows a Live second render or, from the dev
  server, Pixels captured in headless Chromium; Playwright is a new optional peer of
  `@weasel-js/forge`, and without it a lens offers Live only. Token, Contrast and pixel-grid readouts
  sit in the lens chrome, and Alt+Slash opens a panel listing every key binding the workshop
  registers.
  
  Everything below is additive.
  
  forge: the shell config takes `capture.allowOrigins`, naming what a capture page may load besides
  the dev server, and `loupe.modeGlobal`, the global an opposite-mode comparison flips. A global
  declaration may give `opposite(value, globals)`, the value that comparison flips it to.
  `<TrialHost>` takes a `copy` prop, which makes the host a second copy of a trial's story, under
  globals of its own. `@weasel-js/forge/shell` exports `followEdits`, and `@weasel-js/forge/frame`
  exports `mountCapture`, which mounts a capture page.
  
  labkit: the loupe entry gains `<LensOverlay>` (whose `renderReadouts` is handed `LensReadoutProps`),
  `<LensActions>`, the lens scene and its ops, the `LensSource` contract, `createLoupeKeymap`,
  `probeUnderLens` and `LENS_REST_MS`. A lab has an `overlay` chrome region, rendered over the trials
  inside the lab surface, and `useLabEntries` reads the ambient entries installed on the lab, its
  keymaps among them. Each lab surface gains a `'top'` canvas layer for one tenant above `'over'`,
  made only while a tenant asks for it; a surface owner offers it by publishing `top` and `claimTop`
  in its `SurfaceCanvases`. `surface.scope()` takes a list of elements as well as one
  (`SurfaceScope`).
  
  Elsewhere: `@weasel-js/core/json` exports `stableStringify` for Node; paint exports `contrastRatio`
  and `wcagLevels`; svg exports `specificity`, `compareSpecificity` and `splitTopLevel`; an action's
  `enabled` may return a reason as text (`ActionUnavailable` in routing, re-exported by core), which
  the command palette shows as written.
- 2c52cc5: `parseColor` reads `color(srgb …)`, `color(srgb-linear …)`, `oklab()` and `oklch()`, clamping the OK spaces into sRGB. A browser computes every `color-mix()` to `color(srgb …)`, so the workshop's Token readout no longer reports such a color as unreadable.
  
  A workshop lens shows the new story after a switch to another one, where it showed "Nothing under the reticle" until something else changed, and a Live lens shows a component's index page. A Pixels lens captures a story whose config holds unset (undefined) args, which it refused as unsendable.
  
  A lens body takes resize handles at its corners only. A round body resized into an ellipse clips its view to that ellipse, inside its rim, where the view covered all but two slivers of the rim.
- 3bf5edb: Add `resolveFill` and `resolveStroke`, the one answer to what a fill or stroke field paints: absent, `null` and a record with no `paint` are none, a paint with alpha 0 is still a paint, and `INHERIT` (`'inherit'`) takes whatever the caller passes as inherited. `fillHasInk` and `strokeHasInk` now go through them, so `fillHasInk({ paint: null })` is `false` where it used to be `true`.

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
