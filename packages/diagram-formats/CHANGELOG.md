# @weasel-js/diagram-formats

## 1.11.1

### Patch Changes

- d5cfa15: New package, `@weasel-js/diagram-formats`: diagram scenes to files. `exportPageSvg(scene, page)`
  writes one page as an SVG document whose `viewBox` is the page, on the page color, with each
  outline drawn as its shape, each connector as one path with its markers, and rows, labels, and
  off-page tags as text; what lies wholly off the page is left out. `exportPagePng(scene, page,
  { scale })` draws the same page through the canvas renderer into a PNG of the page's size times
  `scale`. Both take the page color from the scene's diagram theme unless given a `background`.
  `pageSvgNodes` is the SVG export's node walk, for a caller writing the document itself.
- 455a34f: `@weasel-js/diagram-formats` reads and writes draw-style XML as `DRAW_XML`, listed in
  `DIAGRAM_FORMATS`. It is the format that keeps a chart laid out: one `<diagram>` per page, each a
  graph model of cells with a style string and a geometry. Reading takes pages written out or
  compressed (base64 of raw deflate of the URI-encoded model), and a bare graph model as one page.
  It keeps places and sizes, outlines (rhombus, ellipse, hexagon, parallelogram, trapezoid, and a
  rounded rect of arc size 50 or more as a stadium), fill, stroke, and font colors, font size,
  family, and bold, HTML text with its tags stripped and its breaks kept, containers, swimlane pools
  of lanes, groups, routers, waypoints, exit and entry points as the nearest compass port, edge
  labels and where along the edge they sit, and arrowheads. A shape it does not know becomes a rect,
  with a warning, as do edges with a loose end and merged layers. Writing spells out every color
  under the document's theme, lays out a page whose nodes have no place, writes an avoiding
  connector as orthogonal along its route, and leaves out edges between pages, with a warning.
  
  `@weasel-js/diagram` exports `NODE_STROKE_WIDTH`, `LANE_STROKE_WIDTH`, and `EDGE_STROKE_WIDTH`,
  the outline widths it draws with when a style gives none. `@weasel-js/svg` exports `escapeAttr`
  and `escapeText`, the escaping it writes XML with.
- ef71bf5: `@weasel-js/diagram-formats` gains the interchange document every diagram format reads and writes.
  A `DiagramDocument` is a list of pages, each a sheet size and a `DiagramData` in coordinates from
  the page's corner, plus the edges that run between pages and the theme. `documentFromScene(scene)`
  reads a diagram scene into one, keeping only the colors the scene's theme would not give;
  `documentSpecs(doc, { layer, theme, measure })` turns one back into scene specs and the
  `core:pages` and `diagram:theme` document values, laying out once any page whose nodes are not all
  placed. A `DiagramFormat` has `detect`, and `read` and `write`, each returning its warnings;
  `DIAGRAM_FORMATS` lists them, `detectFormat` picks one by content and then by extension, and
  `readDocument` reads a file with it. `DIAGRAM_JSON` is the first format: the document as JSON.
  
  In `@weasel-js/diagram`, a `DataNode`, `DataEdge`, `DataContainer`, and `DataLane` take `colors`
  of their own, which `diagramScene` draws over the theme and lists in the trait's `ownStyle`, so a
  theme change leaves them. A `DataEdge` takes a theme role in `style`. `diagramScene` takes a
  `layer`. `dataNodeStyle`, `dataEdgeStyle`, and `dataRegionStyle` give the style each data item is
  drawn in.
- c29e13d: `@weasel-js/diagram-formats` reads and writes Mermaid flowcharts (`DIAGRAM_MERMAID`, `.mmd` and
  `.mermaid`) and Graphviz DOT graphs (`DIAGRAM_DOT`, `.dot` and `.gv`), both listed in
  `DIAGRAM_FORMATS`. Each file is one page: shapes, labeled connectors, subgraphs or clusters as
  containers, the page's direction, and colors from Mermaid's `classDef`, `class`, `style`, and
  `linkStyle` or DOT's `fillcolor`, `color`, and `fontcolor`. Neither holds places, except DOT when
  every node has a `pos`, so a read page is laid out once on import. Writing takes the page
  `WriteOptions.page` names. Both read with hand-written parsers that name the line of a syntax
  error, and both warn for what they drop either way: unknown shapes, attributes and statements a
  diagram does not hold, pools and lanes written as nested clusters, connectors to other pages.
- b3aa7cb: `documentFromScene` exports a shape sitting in the gap between pages on the nearest page rather
  than the first, and marks a connector cross-page exactly when the scene's off-page split does. A
  connector from a gap shape to another page stays whole, keeping its waypoints in world
  coordinates. core gains `pageHolding`, the page a box is on, else the nearest one.
  diagram gains `documentBoundsOf`, the box a node has in document space, which off-page splitting and
  export now both read.
- c29ac84: New package, `@weasel-js/pdf`: `writePdf` turns draw commands into a PDF document — vector paths, gradient shadings, images, and fonts embedded whole so text can be selected and copied. `@weasel-js/font` adds `fontEmbedding` and the `FaceEmbedding` type, and a custom outline parser can supply one through the new optional `OutlineFace.embedding`; the built-in parser offers none for a WOFF file. `@weasel-js/renderer` exports `markerDrawCommands`, `commandsBounds`, `isOwnComposite`, `applyColorMatrix` and `composeColorMatrix`, and `resolveStrokeLengths` takes `{ quantize: false }`; `@weasel-js/text` exports `syntheticBoldOffset` and `emboldenGlyphD`; `@weasel-js/diagram-formats` adds `exportPagesPdf`, every page of a diagram as one PDF.
- Updated dependencies [70b12d1]
- Updated dependencies [3b5750f]
- Updated dependencies [768be71]
- Updated dependencies [9390be4]
- Updated dependencies [1dd65f5]
- Updated dependencies [411b629]
- Updated dependencies [267d5e4]
- Updated dependencies [922cddf]
- Updated dependencies [d5a4102]
- Updated dependencies [9cd12f7]
- Updated dependencies [e5ba382]
- Updated dependencies [8e317f5]
- Updated dependencies [abf41a7]
- Updated dependencies [d3787a4]
- Updated dependencies [312eb35]
- Updated dependencies [7ffc196]
- Updated dependencies [25a112b]
- Updated dependencies [4d99526]
- Updated dependencies [11e1ecb]
- Updated dependencies [853ce69]
- Updated dependencies [8c1861a]
- Updated dependencies [6440997]
- Updated dependencies [44cf2c5]
- Updated dependencies [8ff750f]
- Updated dependencies [161c9c4]
- Updated dependencies [33fa471]
- Updated dependencies [2eb0370]
- Updated dependencies [c726003]
- Updated dependencies [10da7a0]
- Updated dependencies [1729b01]
- Updated dependencies [06f7bca]
- Updated dependencies [455a34f]
- Updated dependencies [46224b6]
- Updated dependencies [ef71bf5]
- Updated dependencies [4a74f67]
- Updated dependencies [e30f4df]
- Updated dependencies [e7ba51a]
- Updated dependencies [8c2a9a9]
- Updated dependencies [1156d63]
- Updated dependencies [13fc67f]
- Updated dependencies [adadf5e]
- Updated dependencies [d863c74]
- Updated dependencies [b3aa7cb]
- Updated dependencies [ee2f0fc]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [cf036c2]
- Updated dependencies [0e24110]
- Updated dependencies [4bf5dec]
- Updated dependencies [fe2a8c5]
- Updated dependencies [b7e6edc]
- Updated dependencies [c29ac84]
- Updated dependencies [672d5cd]
- Updated dependencies [87cded1]
- Updated dependencies [24267d3]
- Updated dependencies [af18142]
- Updated dependencies [683dea0]
- Updated dependencies [b85addf]
- Updated dependencies [61e7b0c]
- Updated dependencies [f819e61]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [ac892f8]
- Updated dependencies [3db0ab0]
- Updated dependencies [71d4416]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [433540d]
  - @weasel-js/core@1.11.1
  - @weasel-js/diagram@1.11.1
  - @weasel-js/svg@1.11.1
  - @weasel-js/pdf@1.11.1
