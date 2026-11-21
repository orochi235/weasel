# @weasel-js/pdf

## 2.0.0

### Major Changes

- c7db707: Every export reports what it drew without, a PNG's included, to `onDiagnostic`, and `strict: true` writes nothing then.
  
  `onWarn(message)` is gone from `ExportOptions`, `exportRegionSvg` and the diagram page exports. `onDiagnostic` hears each loss once as an `ExportDiagnostic`, `{ kind, subject, message }`: a picture or face that failed to load, a paint kind nothing registered, a shader with no GLSL, or what the format cannot hold. With `strict: true` the export rejects with `ExportIncompleteError`, whose `diagnostics` lists them.
  
  ```ts
  // before
  await exportRegions(scene, regions, 'svg', { onWarn: (m) => said.push(m) });
  // after
  await exportRegions(scene, regions, 'svg', { onDiagnostic: (d) => said.push(d.message) });
  ```
  
  <!-- entry: rank=5 breaking api fix -->
- a3136aa: PNG, PDF and SVG exports draw one revision of the document, pages and bounds included, even when it is edited while fonts or pictures load.
  
  Each export now reads through `captureExport(scene, regions, { warm, read })`: an edit while it loads starts it again, and after `EXPORT_CAPTURE_ATTEMPTS` tries it rejects with `ExportRevisionError`. Regions may be a function of the document, read again each attempt; `exportPages` places its pages so, by id, and fails for a page the document no longer holds. `ExportFormat.export` is handed these `ExportRegions`, so a format of your own reads them through `captureExport` or `exportRegionsOf`:
  
  ```ts
  // before
  export: async (scene, regions, opts) => write(scene, regions[0]!)
  // after
  export: (scene, regions, opts) => captureExport(scene, regions, {
    warm: (doc, [region]) => warmWhatItNeeds(doc, region!),
    read: (doc, [region]) => write(doc, region!),
  })
  ```
  
  <!-- entry: rank=5 breaking api fix -->
- c7db707: `exportRegionsPdf` and `exportPagesPdf` answer the PDF's `Blob`; what they left out goes to `onDiagnostic`.
  
  ```ts
  // before
  const { blob, skipped } = await exportRegionsPdf(scene, regions);
  // after
  const blob = await exportRegionsPdf(scene, regions, { onDiagnostic: (d) => said.push(d.message) });
  ```
  
  <!-- entry: breaking api -->
- 41e356b: `@weasel-js/pdf` no longer exports a `Rect` type of its own; `WritePdfOptions.rasterize` takes `@weasel-js/geom`'s `Rect`, which has the same fields.
  
  ```ts
  // before
  import type { Rect } from '@weasel-js/pdf';
  // after
  import type { Rect } from '@weasel-js/geom';
  ```
  
  <!-- entry: breaking -->
- a3958dc: PNG, PDF and SVG exports and `renderSceneToPixels` draw a parallax layer at its document pose, at any scale.
  
  Parallax is the camera's, and a render with no camera has none. To capture what a view shows, planes and all, pass that view as the new `camera`; `scale` then changes only the resolution. `renderDebugSnapshot` does this itself.
  
  ```ts
  // before: planes followed the output's own view, moving with the region and the scale
  renderSceneToPixels({ scene, sourceRect: viewportWorldRect(view, size), scale });
  // after
  renderSceneToPixels({ scene, sourceRect: viewportWorldRect(view, size), scale, camera: view });
  ```
  
  <!-- entry: rank=5 breaking behavior api fix visual -->

### Minor Changes

- 31c843e: A region export's `background` may be a function of the document drawn, so a color read from it matches the revision of the shapes.
  
  ```ts
  exportRegionSvg(scene, region, { background: (doc) => pageColorOf(doc) });
  ```
  
  <!-- entry: api -->
- 592a789: `exportRegions` warns in development about an option the chosen format does not read, such as `compres` for `'pdf'` or `lang` for `'svg'`.
  
  An `ExportFormat` lists the options it reads beyond the shared ones in `options`; png, svg and pdf do. A format that leaves it out is not checked. `pickExportOptions(format, opts)` picks what a format reads.
  
  <!-- entry: api new -->
- d26152c: svg, pdf and diagram-formats take `@weasel-js/export` as a peer, and the svg and pdf formats register in its registry.
  
  `registerSvgExport()` and `registerPdfExport()` register with `@weasel-js/export`'s registry; the packages' own exports are unchanged. For `@weasel-js/pdf` the peer is optional, as core is: only the `./export` entry reads it.
  
  <!-- entry: api -->
- a3136aa: `exportRegionsPdf` and the `pdf` format take `compress: false` to leave the page and image streams uncompressed and readable.
  
  <!-- entry: api -->
- 5db4fbd: A PDF lists a face its font source threw on, or a malformed TrueType face, in `skipped` with the error.
  
  The entry is a `PdfSkip` of the new kind `'font'`, and the face's text is still drawn as outlines. `exportRegionsPdf` reports these as `font` diagnostics.
  
  <!-- entry: api fix -->
- 6094d45: A PDF page can carry a label, which a viewer shows in place of its number.
  
  `PdfPage` takes `label`. Once any page has one, the pages without one are labeled with their number.
  
  <!-- entry: new api -->
- f640899: `exportRegionsPdf` writes regions of a scene as the pages of one PDF, and `registerPdfExport()` makes it core's `pdf` export format.
  
  Each region is a page at 0.75 points per world unit, labeled with the region's `name`. Both come from the new `@weasel-js/pdf/export` entry, which takes `@weasel-js/core` as an optional peer; the main entry still needs neither core nor React.
  
  ```ts
  import { registerPdfExport } from '@weasel-js/pdf/export';
  
  registerPdfExport();
  const blob = await exportPages(scene, placedPagesOf(scene), 'pdf', { title: 'Drawing' });
  ```
  
  <!-- entry: rank=5 new api -->
- f3a1232: A `text-layer` draw command keeps text on the GPU.
  
  `{ kind: 'text-layer', texts }` draws its `TextDrawCommand`s as drawing each in turn would, but uploads every glyph once, as one instance, and draws it with one call a frame however the view moves.
  
  At 114,400 glyphs, a frame of unchanged text drops from 8 ms of CPU to 0.1 ms, and from 11 ms to 3 ms end to end, still or moving; at 1.28M, from 103 ms to 26 ms (`tests/perf/text-wall.spec.ts`). The layer is kept by the identity of `texts` and freed at the end of a frame that does not draw it. A layer holding an underline, a stroke, a fill that is not a solid color, a color glyph, or a glyph big enough on screen for the outline tier is drawn text by text instead.
  
  ```ts
  const wall: DrawCommand = { kind: 'text-layer', texts: lines.map((l, i) => textCommandFromRuns(0, i * 16, l, style)) };
  renderer.render([wall], view);
  ```
  
  `GpuDevice.draw` takes an instance count, and a vertex buffer layout's `step: 'instance'` advances once an instance. `@weasel-js/core` exports `TextLayerDrawCommand`, and `renderNeeds` reads a layer's fonts and paints. `@weasel-js/pdf` writes a layer's texts. `@weasel-js/font` exports `GLYPH_AREA_FROM`.
  
  <!-- entry: api perf -->

### Patch Changes

- e0f4c91: Registering a `pdf` export format of your own replaces the one `registerPdfExport` added without a development warning.
  
  <!-- entry: behavior -->
- 9fcdf65: `writePdf` writes no stroke for a path with no commands, such as an empty polyline, so strict PDF readers no longer report its page as broken.
  
  <!-- entry: fix -->
- b7ab797: `writePdf` no longer rejects an export holding faked-bold text with no fill and a stroke whose dash is not finite.
  
  <!-- entry: fix -->
- c1d5825: `writePdf` lists a face that failed to embed in `skipped` even when the command that first used it is dropped.
  
  A `strict` export now refuses such a document, as it does any other failed face.
  
  <!-- entry: fix -->
- c61fac2: `writePdf` drops and reports an image, sprites, isolated group or gradient whose opacity is not finite, rather than drawing it opaque.
  
  <!-- entry: fix -->
- 0c512db: Page resource names are typed by the prefixes the writer hands out.
  
  <!-- entry: internal -->
- 75de2c0: A PDF gradient's clipped pieces take their end stop's color exactly.
  
  <!-- entry: fix -->
- 4d05907: `writePdf` draws a glyph as an outline when its face has no code left for another reading of it, rather than misreading it.
  
  <!-- entry: fix -->
- 8d41608: `writePdf` drops and reports only the text of a text layer that holds a non-finite coordinate, and still writes the layer's other texts.
  
  <!-- entry: fix -->
- f26ff16: `writePdf` fills with the image a texture holds when drawn, so a bitmap swapped mid-export no longer draws the old one.
  
  <!-- entry: fix visual -->
- Updated dependencies [5099ca3]
- Updated dependencies [e5f53c6]
- Updated dependencies [74e52e2]
- Updated dependencies [617fd6c]
- Updated dependencies [03c5f2f]
- Updated dependencies [fe3c2df]
- Updated dependencies [8d7296a]
- Updated dependencies [33d9b95]
- Updated dependencies [2a3a075]
- Updated dependencies [5ad99b6]
- Updated dependencies [4204bdb]
- Updated dependencies [e4b8859]
- Updated dependencies [e973dcd]
- Updated dependencies [851a4d3]
- Updated dependencies [9c88969]
- Updated dependencies [d764d06]
- Updated dependencies [f1bc116]
- Updated dependencies [effe879]
- Updated dependencies [db9988a]
- Updated dependencies [a98ad34]
- Updated dependencies [7f25db9]
- Updated dependencies [c3a8dea]
- Updated dependencies [c7e5656]
- Updated dependencies [2c2ab71]
- Updated dependencies [643c699]
- Updated dependencies [0dc7968]
- Updated dependencies [ca5bcb0]
- Updated dependencies [6da5a3b]
- Updated dependencies [4fb8cbf]
- Updated dependencies [a7dab9f]
- Updated dependencies [63fbbdf]
- Updated dependencies [3f23bc8]
- Updated dependencies [3b803d7]
- Updated dependencies [9249b26]
- Updated dependencies [f20931c]
- Updated dependencies [15072f4]
- Updated dependencies [44848fe]
- Updated dependencies [9a3bf41]
- Updated dependencies [edcd3a6]
- Updated dependencies [3bf5d6c]
- Updated dependencies [b5d4882]
- Updated dependencies [315f5ee]
- Updated dependencies [97f1f86]
- Updated dependencies [1566d81]
- Updated dependencies [6bbc0e5]
- Updated dependencies [33c1e37]
- Updated dependencies [62f5560]
- Updated dependencies [6fb8869]
- Updated dependencies [ec44e4c]
- Updated dependencies [063b00c]
- Updated dependencies [bfc8672]
- Updated dependencies [8dd351a]
- Updated dependencies [8a1c306]
- Updated dependencies [c4cb671]
- Updated dependencies [defc1cd]
- Updated dependencies [840a01b]
- Updated dependencies [f172abc]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
- Updated dependencies [7b0562e]
- Updated dependencies [39fd347]
- Updated dependencies [f5058e3]
- Updated dependencies [29d293c]
- Updated dependencies [0c07b8d]
- Updated dependencies [6cef61c]
- Updated dependencies [76a1854]
- Updated dependencies [fcc5602]
- Updated dependencies [aaa6a30]
- Updated dependencies [1857565]
- Updated dependencies [41c0399]
- Updated dependencies [d07c5f1]
- Updated dependencies [26b779a]
- Updated dependencies [c3935f7]
- Updated dependencies [fcc31eb]
- Updated dependencies [8bc6d64]
- Updated dependencies [c3da788]
- Updated dependencies [9621063]
- Updated dependencies [869d865]
- Updated dependencies [42aab0c]
- Updated dependencies [d3d65f1]
- Updated dependencies [3a00602]
- Updated dependencies [ab7f613]
- Updated dependencies [95ddf7a]
- Updated dependencies [daa7a4d]
- Updated dependencies [9f5155f]
- Updated dependencies [86e1580]
- Updated dependencies [06303a3]
- Updated dependencies [8278212]
- Updated dependencies [1b27b2f]
- Updated dependencies [2a0b5f3]
- Updated dependencies [a529c26]
- Updated dependencies [f44131a]
- Updated dependencies [394cc06]
- Updated dependencies [a4e0df7]
- Updated dependencies [bfef616]
- Updated dependencies [d0ec6bd]
- Updated dependencies [3742696]
- Updated dependencies [fd63c16]
- Updated dependencies [8c58288]
- Updated dependencies [964a242]
- Updated dependencies [7cfda30]
- Updated dependencies [93b6009]
- Updated dependencies [37baa8c]
- Updated dependencies [e8e7f2f]
- Updated dependencies [e8e7f2f]
- Updated dependencies [e8e7f2f]
- Updated dependencies [5a8ac8c]
- Updated dependencies [e8e7f2f]
- Updated dependencies [963f8fd]
- Updated dependencies [5c345b8]
- Updated dependencies [b0905a2]
- Updated dependencies [1c9986a]
- Updated dependencies [1c9986a]
- Updated dependencies [83ad38f]
- Updated dependencies [0200213]
- Updated dependencies [e8e7f2f]
- Updated dependencies [b05583a]
- Updated dependencies [77bfacf]
- Updated dependencies [f585154]
- Updated dependencies [15a05d9]
- Updated dependencies [74202d3]
- Updated dependencies [c30911d]
- Updated dependencies [c569caf]
- Updated dependencies [280f9fc]
- Updated dependencies [4844d4d]
- Updated dependencies [43fb985]
- Updated dependencies [59944c1]
- Updated dependencies [6d2bb1e]
- Updated dependencies [106749f]
- Updated dependencies [e9897c7]
- Updated dependencies [075971c]
- Updated dependencies [04cd5f3]
- Updated dependencies [2940a77]
- Updated dependencies [2ab2678]
- Updated dependencies [93a7c62]
- Updated dependencies [b05583a]
- Updated dependencies [6f94fe3]
- Updated dependencies [0a2be4b]
- Updated dependencies [5477214]
- Updated dependencies [5f6ebf3]
- Updated dependencies [b76c25e]
- Updated dependencies [5614b4e]
- Updated dependencies [e21ec2d]
- Updated dependencies [386bbfc]
- Updated dependencies [ac792e8]
- Updated dependencies [3fdbc32]
- Updated dependencies [9430cf9]
- Updated dependencies [5f6ebf3]
- Updated dependencies [95d06c3]
- Updated dependencies [3e32141]
- Updated dependencies [9231556]
- Updated dependencies [63c1844]
- Updated dependencies [fd2cbc8]
- Updated dependencies [fd2cbc8]
- Updated dependencies [b0905a2]
- Updated dependencies [a8d34ac]
- Updated dependencies [66e447b]
- Updated dependencies [e9f7adf]
- Updated dependencies [bfb8442]
- Updated dependencies [4a2b3cc]
- Updated dependencies [1bd148d]
- Updated dependencies [7064286]
- Updated dependencies [e67d322]
- Updated dependencies [6316070]
- Updated dependencies [0d810a1]
- Updated dependencies [ece64a6]
- Updated dependencies [9249b26]
- Updated dependencies [d917fd4]
- Updated dependencies [37c0385]
- Updated dependencies [fcc5602]
- Updated dependencies [a2df698]
- Updated dependencies [794862e]
- Updated dependencies [5cf9f61]
- Updated dependencies [5db5049]
- Updated dependencies [656a653]
- Updated dependencies [42d49af]
- Updated dependencies [94c8e4c]
- Updated dependencies [4a93e4b]
- Updated dependencies [eca2b03]
- Updated dependencies [fcfefd4]
- Updated dependencies [7252e96]
- Updated dependencies [f4ac9bc]
- Updated dependencies [81b7535]
- Updated dependencies [bfc26b4]
- Updated dependencies [2503372]
- Updated dependencies [bde7b24]
- Updated dependencies [03c5f2f]
- Updated dependencies [8764186]
- Updated dependencies [f3c2f12]
- Updated dependencies [81f2080]
- Updated dependencies [84a4212]
- Updated dependencies [7542fc9]
- Updated dependencies [319879e]
- Updated dependencies [8d7296a]
- Updated dependencies [e6ec996]
- Updated dependencies [9a3bf41]
- Updated dependencies [d3d3973]
- Updated dependencies [22c6086]
- Updated dependencies [df9dba4]
- Updated dependencies [2729716]
- Updated dependencies [2f7e04a]
- Updated dependencies [a5bed98]
- Updated dependencies [9b8f83b]
- Updated dependencies [143e763]
- Updated dependencies [746912f]
- Updated dependencies [3a0b3b7]
- Updated dependencies [b667930]
- Updated dependencies [dc92ea4]
- Updated dependencies [15328d8]
- Updated dependencies [ebd0424]
- Updated dependencies [0046729]
- Updated dependencies [6babdc5]
- Updated dependencies [2ee9af5]
- Updated dependencies [cfc0732]
- Updated dependencies [3a8b706]
- Updated dependencies [15d434b]
- Updated dependencies [60ca157]
- Updated dependencies [15a08cc]
- Updated dependencies [5a805e9]
- Updated dependencies [81f2080]
- Updated dependencies [fcc5602]
- Updated dependencies [8c58288]
- Updated dependencies [084198c]
- Updated dependencies [b0d7740]
- Updated dependencies [df9a774]
- Updated dependencies [a639e4d]
- Updated dependencies [64fed84]
- Updated dependencies [964a242]
- Updated dependencies [1566d81]
- Updated dependencies [2755b11]
- Updated dependencies [49aa4d8]
- Updated dependencies [dc881e4]
- Updated dependencies [583bd6d]
- Updated dependencies [d353c85]
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
- Updated dependencies [95ca540]
- Updated dependencies [180ec74]
- Updated dependencies [36dac61]
- Updated dependencies [b85869b]
- Updated dependencies [4674f07]
- Updated dependencies [9787bca]
- Updated dependencies [16a2eed]
- Updated dependencies [3eb3209]
- Updated dependencies [2ac34a7]
- Updated dependencies [7e60049]
- Updated dependencies [31c843e]
- Updated dependencies [c7db707]
- Updated dependencies [e0f4c91]
- Updated dependencies [592a789]
- Updated dependencies [3130e99]
- Updated dependencies [f7d0cda]
- Updated dependencies [d26152c]
- Updated dependencies [d26152c]
- Updated dependencies [6ee98b4]
- Updated dependencies [a3136aa]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [daba59f]
- Updated dependencies [7a053e0]
- Updated dependencies [acb38fe]
- Updated dependencies [644baad]
- Updated dependencies [7f49a0e]
- Updated dependencies [cde17d1]
- Updated dependencies [3b37bd1]
- Updated dependencies [cbd9a26]
- Updated dependencies [824eca6]
- Updated dependencies [6bb95ac]
- Updated dependencies [6619ff1]
- Updated dependencies [3c212ef]
- Updated dependencies [23d94db]
- Updated dependencies [50900c3]
- Updated dependencies [d916cae]
- Updated dependencies [98df398]
- Updated dependencies [77670c1]
- Updated dependencies [c131bff]
- Updated dependencies [c117e62]
- Updated dependencies [89f4197]
- Updated dependencies [95a1a63]
- Updated dependencies [a343f1b]
- Updated dependencies [221fe20]
- Updated dependencies [cc5b0c3]
- Updated dependencies [9455fc1]
- Updated dependencies [6606d90]
- Updated dependencies [5879169]
- Updated dependencies [959af37]
- Updated dependencies [890ce71]
- Updated dependencies [5e44587]
- Updated dependencies [da15963]
- Updated dependencies [e95a396]
- Updated dependencies [8e5f1cf]
- Updated dependencies [57df97b]
- Updated dependencies [4daf896]
- Updated dependencies [dbf591e]
- Updated dependencies [d4a593d]
- Updated dependencies [662f94f]
- Updated dependencies [956a71a]
- Updated dependencies [7001f43]
- Updated dependencies [558f742]
- Updated dependencies [39422f9]
- Updated dependencies [b1cfa76]
- Updated dependencies [bb7be0b]
- Updated dependencies [1cee200]
- Updated dependencies [9339b45]
- Updated dependencies [4be1a3f]
- Updated dependencies [896cfc6]
- Updated dependencies [787c496]
- Updated dependencies [37514fc]
- Updated dependencies [bebd64f]
- Updated dependencies [4baee32]
- Updated dependencies [8745b50]
- Updated dependencies [df2ae04]
- Updated dependencies [7dbeddb]
- Updated dependencies [dbf591e]
- Updated dependencies [839a4b2]
- Updated dependencies [1810479]
- Updated dependencies [d598b83]
- Updated dependencies [8c2d558]
- Updated dependencies [2ddb6a5]
- Updated dependencies [4e54b4e]
- Updated dependencies [1bf22f4]
- Updated dependencies [af85c85]
- Updated dependencies [6a9cd12]
- Updated dependencies [af85c85]
- Updated dependencies [5d79d0e]
- Updated dependencies [43e65cf]
- Updated dependencies [e280844]
- Updated dependencies [f889447]
- Updated dependencies [b9a8c62]
- Updated dependencies [a3caa9d]
- Updated dependencies [1dc92ce]
- Updated dependencies [ced5841]
- Updated dependencies [4949266]
- Updated dependencies [9f6da2d]
- Updated dependencies [15a78d8]
- Updated dependencies [f54c013]
- Updated dependencies [2acda2a]
- Updated dependencies [1cc8fea]
- Updated dependencies [3588b89]
- Updated dependencies [9a45d4a]
- Updated dependencies [4f2ce5c]
- Updated dependencies [4e54b4e]
- Updated dependencies [2b26641]
- Updated dependencies [eec8a23]
- Updated dependencies [353033f]
- Updated dependencies [27f0928]
- Updated dependencies [a3f0833]
- Updated dependencies [0157b15]
- Updated dependencies [4f35254]
- Updated dependencies [0118cd0]
- Updated dependencies [70213a5]
- Updated dependencies [4f9848f]
- Updated dependencies [4c0bb1b]
- Updated dependencies [4dff167]
- Updated dependencies [514f6ad]
- Updated dependencies [d455bd2]
- Updated dependencies [11c9e5f]
- Updated dependencies [241446a]
- Updated dependencies [81cc3f8]
- Updated dependencies [e0a11e4]
- Updated dependencies [e280844]
- Updated dependencies [a7fd87a]
- Updated dependencies [0f0c7e5]
- Updated dependencies [ce89e1f]
- Updated dependencies [c4d419b]
- Updated dependencies [da7dd2e]
- Updated dependencies [8cbcaf4]
- Updated dependencies [2d649c0]
- Updated dependencies [5b84935]
- Updated dependencies [02900a7]
- Updated dependencies [308226e]
- Updated dependencies [b2ecf6d]
- Updated dependencies [8af195e]
- Updated dependencies [7459739]
- Updated dependencies [5d43ec9]
- Updated dependencies [57af464]
- Updated dependencies [79d4797]
- Updated dependencies [cf24657]
- Updated dependencies [1d5a968]
- Updated dependencies [95bd84c]
- Updated dependencies [2338cee]
- Updated dependencies [034f292]
- Updated dependencies [1d207f7]
- Updated dependencies [eeef48a]
- Updated dependencies [736df4e]
- Updated dependencies [6aedb33]
- Updated dependencies [3dc96c8]
- Updated dependencies [972a96c]
- Updated dependencies [94ea28e]
- Updated dependencies [4f7976e]
- Updated dependencies [ed0fff4]
- Updated dependencies [8764186]
- Updated dependencies [a7dab9f]
- Updated dependencies [3a1bfaa]
- Updated dependencies [42f1123]
- Updated dependencies [6943c8d]
- Updated dependencies [9b7e01c]
- Updated dependencies [aedb49f]
- Updated dependencies [e044df2]
- Updated dependencies [4a18e17]
- Updated dependencies [27649f2]
- Updated dependencies [5117a3c]
- Updated dependencies [a0f437e]
- Updated dependencies [19f8e39]
- Updated dependencies [d22292c]
- Updated dependencies [7d89cf6]
- Updated dependencies [8882b53]
- Updated dependencies [c7db707]
- Updated dependencies [452e669]
- Updated dependencies [477eb15]
- Updated dependencies [8649268]
- Updated dependencies [e4f2133]
- Updated dependencies [e4f2133]
- Updated dependencies [4e9c237]
- Updated dependencies [a86bd34]
- Updated dependencies [fd2cbc8]
- Updated dependencies [7165e31]
- Updated dependencies [e5e7aef]
- Updated dependencies [3fe1323]
- Updated dependencies [22a1496]
- Updated dependencies [c3bcbf9]
- Updated dependencies [ea0eef2]
- Updated dependencies [d061e79]
- Updated dependencies [b44408d]
- Updated dependencies [51dc6ab]
- Updated dependencies [f9ab55b]
- Updated dependencies [e70f4da]
- Updated dependencies [174d6ef]
- Updated dependencies [a20fc8c]
- Updated dependencies [a2fbf00]
- Updated dependencies [8c63002]
- Updated dependencies [1026606]
- Updated dependencies [5ddbb1f]
- Updated dependencies [aa1dfd3]
- Updated dependencies [e6871f1]
- Updated dependencies [10e17bb]
- Updated dependencies [8e6f5d2]
- Updated dependencies [9236a1e]
- Updated dependencies [7e5b389]
- Updated dependencies [7e5b389]
- Updated dependencies [fd2cbc8]
- Updated dependencies [1ad4f25]
- Updated dependencies [1eb7552]
- Updated dependencies [01b8a73]
- Updated dependencies [6eefcb6]
- Updated dependencies [7863d23]
- Updated dependencies [5886c61]
- Updated dependencies [a34b3fc]
- Updated dependencies [e7d5f5a]
- Updated dependencies [0b82615]
- Updated dependencies [a0070e8]
- Updated dependencies [b584cc5]
- Updated dependencies [4d469aa]
- Updated dependencies [5886c61]
- Updated dependencies [0b29cea]
- Updated dependencies [c22c9a6]
- Updated dependencies [2dd5e34]
- Updated dependencies [0ac8104]
- Updated dependencies [b1e9d32]
- Updated dependencies [de8f61d]
- Updated dependencies [a5166b0]
- Updated dependencies [8b65c38]
- Updated dependencies [56784d5]
- Updated dependencies [033c46f]
- Updated dependencies [4cc61de]
- Updated dependencies [f219a71]
- Updated dependencies [812c469]
- Updated dependencies [b54ab5f]
- Updated dependencies [8c7d44b]
- Updated dependencies [b2b79f1]
- Updated dependencies [ea36901]
- Updated dependencies [65ac904]
- Updated dependencies [ec23b4e]
- Updated dependencies [d2002e0]
- Updated dependencies [34090f0]
- Updated dependencies [b0905a2]
- Updated dependencies [bfc31d6]
- Updated dependencies [de8f61d]
- Updated dependencies [a23ebea]
- Updated dependencies [b10e05f]
- Updated dependencies [28b5165]
- Updated dependencies [ff70ebe]
- Updated dependencies [0f43324]
- Updated dependencies [f4b9a4a]
- Updated dependencies [1aa0af1]
- Updated dependencies [f88fa83]
- Updated dependencies [9eb084a]
- Updated dependencies [066e590]
- Updated dependencies [7c01199]
- Updated dependencies [5792fce]
- Updated dependencies [b3b9f5e]
- Updated dependencies [1ba9061]
- Updated dependencies [0c1b6a6]
- Updated dependencies [b6ae714]
- Updated dependencies [a64cc29]
- Updated dependencies [e737c0f]
- Updated dependencies [69399bc]
- Updated dependencies [d9c51c0]
- Updated dependencies [d19f8cc]
- Updated dependencies [717a531]
- Updated dependencies [3a50e80]
- Updated dependencies [f522122]
- Updated dependencies [36dc93a]
- Updated dependencies [11b0336]
- Updated dependencies [75ef9fb]
- Updated dependencies [e549ad3]
- Updated dependencies [fd2cbc8]
- Updated dependencies [dc881e4]
- Updated dependencies [fb4710c]
- Updated dependencies [46440b6]
- Updated dependencies [db54baf]
- Updated dependencies [bbf58f0]
- Updated dependencies [65703dc]
- Updated dependencies [42aab0c]
- Updated dependencies [ac18636]
- Updated dependencies [5d3b9b7]
- Updated dependencies [adb1290]
- Updated dependencies [9204311]
- Updated dependencies [a0bb229]
- Updated dependencies [aedb49f]
- Updated dependencies [0bb9ac6]
- Updated dependencies [067cf55]
- Updated dependencies [b750660]
- Updated dependencies [5b5d307]
- Updated dependencies [dc881e4]
- Updated dependencies [9c4c2ff]
- Updated dependencies [7b298cb]
- Updated dependencies [0a05da3]
- Updated dependencies [3e108b4]
- Updated dependencies [f4e98a4]
- Updated dependencies [b323f97]
- Updated dependencies [0bb71da]
- Updated dependencies [4bda721]
- Updated dependencies [b29a94e]
- Updated dependencies [5531792]
- Updated dependencies [c129ce1]
- Updated dependencies [43bf365]
- Updated dependencies [c8f84f3]
- Updated dependencies [c0d43ee]
- Updated dependencies [d73bd9f]
- Updated dependencies [4ee45ab]
- Updated dependencies [b98bad7]
- Updated dependencies [0d377ec]
- Updated dependencies [435c248]
- Updated dependencies [e1e7241]
- Updated dependencies [977164c]
- Updated dependencies [9aed377]
- Updated dependencies [c491f93]
- Updated dependencies [aadb086]
- Updated dependencies [b1bbd39]
- Updated dependencies [8934e48]
- Updated dependencies [e4a8c4f]
- Updated dependencies [aeda396]
- Updated dependencies [c1da54a]
- Updated dependencies [aeda396]
- Updated dependencies [e30b99b]
- Updated dependencies [d8dc6bf]
- Updated dependencies [e4a8c4f]
- Updated dependencies [a791e92]
- Updated dependencies [09f0c86]
- Updated dependencies [d11dc30]
- Updated dependencies [5ad7bc0]
- Updated dependencies [481218b]
- Updated dependencies [f8172cf]
- Updated dependencies [e5395a6]
- Updated dependencies [cd7ffdb]
- Updated dependencies [8ced7e2]
- Updated dependencies [5ed6215]
- Updated dependencies [9cacd4b]
- Updated dependencies [f95e342]
- Updated dependencies [d6ba47e]
- Updated dependencies [fcc5602]
- Updated dependencies [fcc5602]
- Updated dependencies [880cbbf]
- Updated dependencies [2932eb2]
- Updated dependencies [c1a3072]
- Updated dependencies [968362b]
- Updated dependencies [fd2cbc8]
- Updated dependencies [f4bfab5]
- Updated dependencies [e6c888e]
- Updated dependencies [fcc5602]
- Updated dependencies [3cf6a17]
- Updated dependencies [c5e5476]
- Updated dependencies [56089ae]
- Updated dependencies [f544aeb]
- Updated dependencies [c8b8348]
- Updated dependencies [1e1d4c6]
- Updated dependencies [33b9074]
- Updated dependencies [dd3fdb0]
- Updated dependencies [4f2d1e0]
- Updated dependencies [ece64a6]
- Updated dependencies [ccd6f25]
- Updated dependencies [527f214]
- Updated dependencies [42169f9]
- Updated dependencies [6d2bb1e]
- Updated dependencies [c4304d4]
- Updated dependencies [9c507b5]
- Updated dependencies [9c507b5]
- Updated dependencies [edfe71a]
- Updated dependencies [1a03017]
- Updated dependencies [6a9cd12]
- Updated dependencies [be3711c]
- Updated dependencies [4f03b5d]
- Updated dependencies [c0555fb]
- Updated dependencies [094ba4d]
- Updated dependencies [7d598c5]
- Updated dependencies [6d2bb1e]
- Updated dependencies [cff801a]
- Updated dependencies [ff4504e]
- Updated dependencies [cbb78ec]
- Updated dependencies [0ae8b0c]
- Updated dependencies [d897c83]
- Updated dependencies [8078d25]
- Updated dependencies [c428e9e]
- Updated dependencies [bf94421]
- Updated dependencies [58f9d2e]
- Updated dependencies [c67bcfa]
- Updated dependencies [f04bbbc]
- Updated dependencies [0f60e3d]
- Updated dependencies [5124d5a]
- Updated dependencies [7dd8e23]
- Updated dependencies [e265bdc]
- Updated dependencies [0f60e3d]
- Updated dependencies [768acf7]
- Updated dependencies [4bf376e]
- Updated dependencies [3207a40]
- Updated dependencies [e49aa18]
- Updated dependencies [45e100f]
- Updated dependencies [6ab962a]
- Updated dependencies [6ab962a]
- Updated dependencies [0e01d7f]
- Updated dependencies [70076bc]
- Updated dependencies [f8f4954]
- Updated dependencies [b1c09d3]
- Updated dependencies [fa9657c]
- Updated dependencies [f5b75cb]
- Updated dependencies [1e9c740]
- Updated dependencies [586b6c1]
- Updated dependencies [53fb0eb]
- Updated dependencies [47fa777]
- Updated dependencies [47fa777]
- Updated dependencies [fd2cbc8]
- Updated dependencies [9566a40]
- Updated dependencies [9566a40]
- Updated dependencies [68d5da4]
- Updated dependencies [7d67497]
- Updated dependencies [5fa6d0a]
- Updated dependencies [fc665a9]
- Updated dependencies [bb8b8cb]
- Updated dependencies [5fa6d0a]
- Updated dependencies [9566a40]
- Updated dependencies [68d5da4]
- Updated dependencies [914ba92]
- Updated dependencies [6a9a3dc]
- Updated dependencies [4d469aa]
- Updated dependencies [419b1f1]
- Updated dependencies [a3136aa]
- Updated dependencies [5b156c6]
- Updated dependencies [3f553ff]
- Updated dependencies [5d75785]
- Updated dependencies [f976095]
- Updated dependencies [af132bc]
- Updated dependencies [9333b1a]
- Updated dependencies [fc62432]
- Updated dependencies [dd5a540]
- Updated dependencies [85d3d17]
- Updated dependencies [921d4f8]
- Updated dependencies [4a4d7c9]
- Updated dependencies [305f0ce]
- Updated dependencies [73f549e]
- Updated dependencies [73f549e]
- Updated dependencies [a13982c]
- Updated dependencies [52ee422]
- Updated dependencies [73f549e]
- Updated dependencies [4bcea5f]
- Updated dependencies [a3958dc]
- Updated dependencies [75634a6]
- Updated dependencies [6fcc7aa]
- Updated dependencies [59e80c0]
- Updated dependencies [0e80f73]
- Updated dependencies [c873b55]
- Updated dependencies [aedb49f]
- Updated dependencies [31cd706]
- Updated dependencies [eb8fe62]
- Updated dependencies [e9613f8]
- Updated dependencies [f004638]
- Updated dependencies [52d9d64]
- Updated dependencies [e3c67e9]
- Updated dependencies [34090f0]
- Updated dependencies [03b9392]
- Updated dependencies [15e923d]
- Updated dependencies [5962dc2]
- Updated dependencies [5dae54d]
- Updated dependencies [0208a3b]
- Updated dependencies [bb7bb11]
- Updated dependencies [ee1de44]
- Updated dependencies [d58694b]
- Updated dependencies [74e37d7]
- Updated dependencies [8f61f88]
- Updated dependencies [231eec5]
- Updated dependencies [6355d18]
- Updated dependencies [fcfefd4]
- Updated dependencies [eeb7c5a]
- Updated dependencies [44848fe]
- Updated dependencies [c4d5642]
- Updated dependencies [aba9531]
- Updated dependencies [c25237f]
- Updated dependencies [b934739]
- Updated dependencies [f1e9773]
- Updated dependencies [b822d40]
- Updated dependencies [88a19c0]
- Updated dependencies [44848fe]
- Updated dependencies [48e0ecd]
- Updated dependencies [c8ed2ce]
- Updated dependencies [f5e0446]
- Updated dependencies [62aede0]
- Updated dependencies [dc3eb53]
- Updated dependencies [f6c305d]
- Updated dependencies [2a7e9e0]
- Updated dependencies [139f3f0]
- Updated dependencies [e0f4c91]
- Updated dependencies [00a1f20]
- Updated dependencies [9c46d22]
- Updated dependencies [6451f0c]
- Updated dependencies [3dab4ca]
- Updated dependencies [c8ed2ce]
- Updated dependencies [f3a1232]
- Updated dependencies [d55c488]
- Updated dependencies [56fda8d]
- Updated dependencies [5c778a0]
- Updated dependencies [162f816]
- Updated dependencies [f88d616]
- Updated dependencies [3cb3a67]
- Updated dependencies [a97fe65]
- Updated dependencies [c60fc3d]
- Updated dependencies [1c2c1ac]
- Updated dependencies [834d2ca]
- Updated dependencies [457fbc3]
- Updated dependencies [1e80440]
- Updated dependencies [d3b20b9]
- Updated dependencies [86b5903]
- Updated dependencies [647b21c]
- Updated dependencies
- Updated dependencies [1d8e163]
- Updated dependencies [e08d172]
- Updated dependencies [2076b1b]
- Updated dependencies [429e80c]
- Updated dependencies [49b3b13]
- Updated dependencies [17d184b]
- Updated dependencies [cabffe5]
- Updated dependencies [f92300d]
- Updated dependencies [d569abf]
- Updated dependencies [76ca845]
- Updated dependencies [431aa8e]
- Updated dependencies [1ac16c5]
- Updated dependencies [a82e65b]
- Updated dependencies [b835405]
- Updated dependencies [bf1cf7b]
- Updated dependencies [c3e773c]
- Updated dependencies [8558f40]
- Updated dependencies [fa8902c]
- Updated dependencies [96de590]
- Updated dependencies [0ac8104]
- Updated dependencies [9bbe3e4]
- Updated dependencies [0c77c8d]
- Updated dependencies [fd2cbc8]
- Updated dependencies [56f8264]
- Updated dependencies [1c6f913]
- Updated dependencies [f20931c]
- Updated dependencies [2241860]
- Updated dependencies [5d7b7b8]
- Updated dependencies [447f742]
- Updated dependencies [0fe19aa]
- Updated dependencies [5339aec]
- Updated dependencies [3a71a1a]
- Updated dependencies [a979682]
- Updated dependencies [d8c22e6]
- Updated dependencies [f11549d]
- Updated dependencies [ab56471]
- Updated dependencies [86b43d1]
- Updated dependencies [eaefc65]
- Updated dependencies [8cce06e]
- Updated dependencies [16d4fab]
- Updated dependencies [edcc040]
- Updated dependencies [1ceadbf]
- Updated dependencies [a47e5ed]
- Updated dependencies [6829ab9]
- Updated dependencies [865ccae]
- Updated dependencies [a47e5ed]
- Updated dependencies [eb82ac9]
- Updated dependencies [795f517]
- Updated dependencies [a26f70d]
- Updated dependencies [aedb49f]
- Updated dependencies [95da921]
- Updated dependencies [6ac9c99]
- Updated dependencies [f39b469]
- Updated dependencies [e752074]
- Updated dependencies [8b73d9a]
- Updated dependencies [002ff57]
- Updated dependencies [2557ab3]
- Updated dependencies [7a7ea82]
- Updated dependencies [a23923e]
- Updated dependencies [9246f97]
- Updated dependencies [843859b]
- Updated dependencies [4816dc3]
- Updated dependencies [97cce9d]
- Updated dependencies [6bfce5e]
- Updated dependencies [4ae3b06]
- Updated dependencies [fbb5fcd]
- Updated dependencies [24ac265]
- Updated dependencies [9f9a61a]
- Updated dependencies [b646c27]
- Updated dependencies [850db0a]
- Updated dependencies [ef3ebdd]
- Updated dependencies [0828a03]
- Updated dependencies [b92bf56]
- Updated dependencies [0828a03]
- Updated dependencies [f23829c]
- Updated dependencies [7dadcf2]
- Updated dependencies [87e8475]
- Updated dependencies [9521334]
- Updated dependencies [0177219]
- Updated dependencies [670aeb3]
- Updated dependencies [12cfcfc]
- Updated dependencies [f86aaa2]
- Updated dependencies [6222db5]
- Updated dependencies [415e5b8]
- Updated dependencies [033c46f]
- Updated dependencies [e68cb62]
- Updated dependencies [29135cb]
- Updated dependencies [4e54b4e]
- Updated dependencies [4e54b4e]
- Updated dependencies [4e54b4e]
- Updated dependencies [16e4b0b]
- Updated dependencies [7bc2c18]
- Updated dependencies [fb69a95]
- Updated dependencies [a45338c]
- Updated dependencies [fb69a95]
- Updated dependencies [3f575e2]
- Updated dependencies [4f9848f]
- Updated dependencies [0ee2887]
- Updated dependencies [767af8a]
- Updated dependencies [fb702eb]
- Updated dependencies [7cace1d]
- Updated dependencies [a86bd34]
- Updated dependencies [c11f37e]
- Updated dependencies [cb6e47b]
- Updated dependencies [e39dbc5]
- Updated dependencies [1c0046a]
- Updated dependencies [a34f319]
- Updated dependencies [cbcd314]
- Updated dependencies [9e23aea]
- Updated dependencies [dee342f]
- Updated dependencies [98d2f9a]
- Updated dependencies [cf2ad81]
- Updated dependencies [e0f4c91]
- Updated dependencies [d455bd2]
- Updated dependencies [12df18a]
- Updated dependencies [62aede0]
- Updated dependencies [bda75b2]
- Updated dependencies [5bf7f01]
- Updated dependencies [7293e22]
- Updated dependencies [6bdf14d]
- Updated dependencies [bfc26b4]
- Updated dependencies [2f2e3ca]
- Updated dependencies [a9a0abc]
- Updated dependencies [880ed50]
- Updated dependencies [6975d7b]
- Updated dependencies [6bea0c5]
- Updated dependencies [8635c1a]
- Updated dependencies [78dd590]
- Updated dependencies [d3f717d]
- Updated dependencies [27704ec]
- Updated dependencies [60c082d]
- Updated dependencies [46ec294]
- Updated dependencies [ae15ab8]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
- Updated dependencies [de2d442]
- Updated dependencies [4c592ae]
- Updated dependencies [3a28bbb]
- Updated dependencies [a0d5f84]
- Updated dependencies [6153ae7]
- Updated dependencies [3551ece]
- Updated dependencies [fd2cbc8]
- Updated dependencies [959f804]
- Updated dependencies [6b5336b]
- Updated dependencies [dc881e4]
- Updated dependencies [30e2485]
- Updated dependencies [95083bc]
- Updated dependencies [cbaa22a]
- Updated dependencies [bb03b55]
- Updated dependencies [1377fab]
- Updated dependencies [9199cb5]
- Updated dependencies [8ac8a64]
- Updated dependencies [de1e1c0]
- Updated dependencies [4aaefe7]
- Updated dependencies [c356829]
- Updated dependencies [fcc5602]
- Updated dependencies [f3130d5]
- Updated dependencies [95b6eb4]
- Updated dependencies [cbf500e]
- Updated dependencies [c5a7102]
- Updated dependencies [3871e2f]
- Updated dependencies [c3f3d9a]
- Updated dependencies [5548d73]
- Updated dependencies [e824816]
- Updated dependencies [5a94e2b]
- Updated dependencies [3871e2f]
- Updated dependencies [4377fe2]
- Updated dependencies [45559fc]
- Updated dependencies [685bc3d]
- Updated dependencies [6111c56]
- Updated dependencies [accc590]
- Updated dependencies [4b0b9df]
- Updated dependencies [f9ed89f]
- Updated dependencies [a23ebea]
- Updated dependencies [8d3c536]
- Updated dependencies [fd2cbc8]
- Updated dependencies [9d1f28d]
- Updated dependencies [f4115e7]
- Updated dependencies [c62a3d3]
- Updated dependencies [f9427e6]
- Updated dependencies [02f9570]
- Updated dependencies [8fda190]
- Updated dependencies [368fb5f]
- Updated dependencies [dd7e196]
- Updated dependencies [963f8fd]
- Updated dependencies [ba59515]
- Updated dependencies [de71f7d]
- Updated dependencies [87d7436]
- Updated dependencies [ae7d97c]
- Updated dependencies [95ca540]
- Updated dependencies [8d7296a]
- Updated dependencies [d6f8aac]
- Updated dependencies [1f05956]
- Updated dependencies [c4f5447]
- Updated dependencies [c4f5447]
- Updated dependencies [9566a40]
- Updated dependencies [129da4b]
- Updated dependencies [cd410a7]
- Updated dependencies [29f3da2]
- Updated dependencies [b70bc7f]
- Updated dependencies [a8efdf5]
- Updated dependencies [6a423ea]
- Updated dependencies [774e9cc]
- Updated dependencies [9e8b91e]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [4c6e74f]
- Updated dependencies [34b8a3f]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [a5c1865]
- Updated dependencies [0d977b8]
- Updated dependencies [01d3e39]
- Updated dependencies [6494d25]
- Updated dependencies [30bf620]
- Updated dependencies [41f0773]
- Updated dependencies [95cd658]
- Updated dependencies [c4783b4]
- Updated dependencies [ce8655e]
- Updated dependencies [edcb456]
- Updated dependencies [f2b94bc]
- Updated dependencies [4198fea]
- Updated dependencies [0ac8104]
- Updated dependencies [475c725]
- Updated dependencies [adca5ed]
- Updated dependencies [793ac72]
- Updated dependencies [c7db707]
- Updated dependencies [ca65c7b]
- Updated dependencies [987dd51]
- Updated dependencies [d2002e0]
- Updated dependencies [904ff6b]
- Updated dependencies [812c469]
- Updated dependencies [f71667e]
- Updated dependencies [12816b7]
- Updated dependencies [5b8e066]
- Updated dependencies [f62be4d]
- Updated dependencies [f776161]
- Updated dependencies [087e02c]
- Updated dependencies [f873d0e]
- Updated dependencies [5046776]
- Updated dependencies [232d77f]
- Updated dependencies [0f2cc79]
- Updated dependencies [542e4e2]
- Updated dependencies [5b08bd0]
- Updated dependencies [2eb84fc]
- Updated dependencies [413e38c]
- Updated dependencies [55fd480]
- Updated dependencies [aec0cec]
- Updated dependencies [3e39fea]
- Updated dependencies [eb070dc]
- Updated dependencies [42ec713]
- Updated dependencies [a9b8fbb]
- Updated dependencies [73f1cf1]
- Updated dependencies [cbc7e4b]
- Updated dependencies [0d0c238]
- Updated dependencies [5354da3]
- Updated dependencies [787ca7b]
- Updated dependencies [721585e]
- Updated dependencies [5202a9f]
- Updated dependencies [174070d]
  - @weasel-js/core@2.0.0
  - @weasel-js/stroke@2.0.0
  - @weasel-js/geom@2.0.0
  - @weasel-js/text@2.0.0
  - @weasel-js/renderer@2.0.0
  - @weasel-js/font@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/paint@2.0.0
  - @weasel-js/export@2.0.0

## 1.19.1

### Patch Changes

- 425f994: A PDF export whose font source throws for a glyph's outline reports that error in its skipped list, rather than saying the glyph has none.
  
  <!-- entry: fix -->
- Updated dependencies [69b696d]
- Updated dependencies [08dd689]
- Updated dependencies [71c3f85]
- Updated dependencies [16900c1]
- Updated dependencies [55b0f04]
- Updated dependencies [2f6b0e9]
- Updated dependencies [1691dec]
- Updated dependencies [b62d643]
- Updated dependencies [4fb0c17]
- Updated dependencies [20878ef]
- Updated dependencies [04ac694]
- Updated dependencies [92e4fa8]
- Updated dependencies [f3618cb]
- Updated dependencies [bce70ba]
  - @weasel-js/renderer@1.19.1
  - @weasel-js/font@1.19.1
  - @weasel-js/geom@1.19.1
  - @weasel-js/text@1.19.1
  - @weasel-js/paint@1.19.1
  - @weasel-js/stroke@1.19.1

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
