## TextShapingDemo reverses every glyph of an RTL line, though the shaper already returns logical cluster order with each cluster's glyphs in drawn order
- where: apps/site/demos/TextShapingDemo.tsx:27 (line)
- scenario: `TextShaper.shape` (packages/text-shaping/src/shaper.ts:188-194) hands RTL glyphs back in logical cluster order but keeps the glyphs *inside* a multi-glyph cluster in visual order. `line()` reverses the whole array whenever any glyph is `rtl`, so a cluster that shapes to more than one glyph (a decomposed character, a base plus a mark HarfBuzz keeps in one cluster) comes out with its glyphs swapped. The pen then advances in the wrong order within that cluster, and the glyphs land at the wrong x. It should reverse cluster by cluster and keep each cluster's glyph order. The same whole-line reverse also flips any LTR piece in mixed text (a digit run inside Arabic), because `some(g => g.rtl)` decides for the whole line rather than per piece.
- evidence: read (the shaper's ordering contract is in shaper.ts:155-194)
- severity: low

## TextShapingDemo feeds an HTTP error page to the shaper as a font and then throws during render
- where: apps/site/demos/TextShapingDemo.tsx:45 (TextShapingDemo effect `bytes`)
- scenario: `fetch(url).then((r) => r.arrayBuffer())` never checks `r.ok`. If a font URL returns 404 or 500 (a broken base path, a dev server missing the asset), the HTML body resolves as the face bytes, `setLoaded` runs, and `loaded.shaper.shape(face, text)` then runs in the render body (lines 53-54) on a non-sfnt buffer. That throws or shapes garbage outside the `.catch`, so the demo crashes or draws nothing instead of showing the `role="alert"` error the component has for exactly this case. It should reject on `!r.ok` so the failure reaches `setError`.
- evidence: read
- severity: low

## SvgDemo exports a scene that still holds the last good parse under the fallback viewBox while the source has a parse error
- where: apps/site/demos/SvgDemo.tsx:125 (SvgRoundTrip export effect)
- scenario: The user types in the textarea and the source briefly fails to parse, for example mid-edit of a custom `viewBox="0 0 800 600"`. `imported` becomes `{ error }`, the load effect returns early and the scene keeps the previous nodes, but the export effect reruns because `imported` changed. It picks `VIEW` (0 0 420 320) instead of the viewBox those nodes were parsed under. The serializeSvg pane then shows the old nodes under a viewBox they never had. It should keep the last good parse's viewBox, the one the scene's nodes came from.
- evidence: read
- severity: low

## StrokeTrimLabDemo's export promises have no rejection handler
- where: apps/site/demos/StrokeTrimLabDemo.tsx:109 (SvgExport), apps/site/demos/StrokeTrimLabDemo.tsx:126-132 (PdfExport write)
- scenario: `void exportRegionSvg(...).then(...)` and `onClick={() => void write()}` both drop the rejection. If an export throws (a paint kind the exporter refuses, a failed lazy import of the pdf writer), the result is an unhandled rejection in the console, and the panel goes on showing the previous SVG (or no PDF link) with nothing to say the export failed. Contrast SvgDemo.tsx:131, which catches and surfaces the error as a warning.
- evidence: read
- severity: low

## StorageDemo reads `localStorage` directly in render, bypassing the adapter's guarding
- where: apps/site/demos/StorageDemo.tsx:61 (StorageDemo row render)
- scenario: Where storage access is blocked (cookies disabled, some embedded or private contexts), the `localStorage` global access throws a `SecurityError`. The demo routes its writes through `localStorageAdapter` but reads `localStorage.getItem(PREFIX + name)` raw on every render (every 200 ms poll), so the whole demo throws on render rather than showing '—'. (Inferred from the platform behavior; I have not checked how the adapter handles it.)
- evidence: read (code); platform behavior inferred
- severity: low

## SceneScrollerDemo builds a whole fresh game state on every render of the load-test demo
- where: apps/site/demos/SceneScrollerDemo.tsx:63 (SceneScrollerDemoInner, `useRef(freshGame())`)
- scenario: `useRef<GameRefs>(freshGame())` evaluates `freshGame()` on every render and throws the result away after the first. `freshGame` (platformer/world.ts:88) runs `createEnemies(WORLD, WORLD.enemies)` and `createCoins(WORLD.coins)`. The stats poll calls `setStats` every 200 ms, so the demo allocates and discards the level's full enemy and coin arrays five times a second, for as long as it is open. This is the demo whose frame-time and jitter readouts are its point. It should use a lazy initializer (`useState(freshGame)` or a ref with a null check).
- evidence: read
- severity: low

## Files read
apps/site/demos/SceneLabDemo.tsx
apps/site/demos/SceneScrollerDemo.module.css
apps/site/demos/SceneScrollerDemo.tsx
apps/site/demos/ScopedGridDemo.tsx
apps/site/demos/ScoreDemo.module.css
apps/site/demos/ScoreDemo.tsx
apps/site/demos/ScrollingGridDemo.tsx
apps/site/demos/SegmentTypeLabDemo.tsx
apps/site/demos/SelectDemo.module.css
apps/site/demos/SelectDemo.tsx
apps/site/demos/SelectionPanelDemo.tsx
apps/site/demos/SequenceDiagramDemo.tsx
apps/site/demos/ShapeBuilderLabDemo.tsx
apps/site/demos/ShapeToolsDemo.tsx
apps/site/demos/SharedBrushSizeDemo.tsx
apps/site/demos/SkinDemo.tsx
apps/site/demos/SliceDemo.tsx
apps/site/demos/SlideNavigationDemo.tsx
apps/site/demos/SmallCapsDemo.tsx
apps/site/demos/SnipLabDemo.tsx
apps/site/demos/SpacingHintsLabDemo.tsx
apps/site/demos/SpiroLabDemo.tsx
apps/site/demos/StickyNotesDemo.tsx
apps/site/demos/StorageDemo.module.css
apps/site/demos/StorageDemo.tsx
apps/site/demos/StrokeAndFillDemo.tsx
apps/site/demos/StrokeMarkersDemo.tsx
apps/site/demos/StrokeTrimLabDemo.module.css
apps/site/demos/StrokeTrimLabDemo.tsx
apps/site/demos/StrokeWidthLabDemo.tsx
apps/site/demos/SvgDemo.module.css
apps/site/demos/SvgDemo.tsx
apps/site/demos/SwapDemo.tsx
apps/site/demos/SymmetryLabDemo.tsx
apps/site/demos/TextDemo.tsx
apps/site/demos/TextDomDemo.module.css
apps/site/demos/TextDomDemo.tsx
apps/site/demos/TextOutlinesDemo.module.css
apps/site/demos/TextOutlinesDemo.tsx
apps/site/demos/TextScriptDemo.module.css
apps/site/demos/TextScriptDemo.tsx
apps/site/demos/TextShapingDemo.module.css
apps/site/demos/TextShapingDemo.tsx
apps/site/demos/ThemeDemo.module.css
apps/site/demos/ThemeDemo.tsx
apps/site/demos/TiledSurfaceDemo.tsx
apps/site/demos/TimelineDemo.tsx
apps/site/demos/TimelineFramesDemo.tsx

<!-- done: 6 findings, files read: 48 -->
