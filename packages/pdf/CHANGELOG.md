# @weasel-js/pdf

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
