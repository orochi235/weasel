# @weasel-js/pdf

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
