# @weasel-js/diagram-formats

## 2.0.0

### Major Changes

- 659557e: The draw-style XML format is `DIAGRAM_DRAW_XML`, beside `DIAGRAM_JSON`, `DIAGRAM_MERMAID` and `DIAGRAM_DOT`.
  
  `DRAW_XML` is renamed `DIAGRAM_DRAW_XML`; the format is unchanged.
  
  ```ts
  // before
  const { document } = await DRAW_XML.read!(text);
  // after
  const { document } = await DIAGRAM_DRAW_XML.read!(text);
  ```
  
  <!-- entry: breaking api -->
- 24d556f: The two tests of what a format can write share one verb: `formatFits` for a whole document and `formatFitsKinds` for a set of page kinds.
  
  `formatHolds` is renamed `formatFits` and `formatTakes` is renamed `formatFitsKinds`; their arguments are unchanged.
  
  ```ts
  // before
  can(formatTakes(format, scenePageKinds(scene)));
  // after
  can(formatFitsKinds(format, scenePageKinds(scene)));
  ```
  
  <!-- entry: breaking api -->
- e3f4398: `documentFromScene` and `addDocumentScene` take a scene of `RectPose`, which is what they always read and wrote.
  
  This is breaking for a caller whose scene has any other pose type: such a scene was read as rects regardless, so the type now says so. A rect-posed scene needs no change.
  
  ```ts
  // before: compiled, and read every pose as a rect
  documentFromScene(scene as Scene<Data, Layer, MyPose>);
  // after: a RectPose scene, as before
  documentFromScene(scene as Scene<Data, Layer, RectPose>);
  ```
  
  <!-- entry: breaking api -->
- 8f761db: The helper that narrows a page to a graph page, and throws on any other kind, is `requireGraphPage`, so its name says it can throw.
  
  `graphPageOf` is renamed `requireGraphPage`; its arguments are unchanged.
  
  ```ts
  // before
  const page = graphPageOf(written, 'DOT');
  // after
  const page = requireGraphPage(written, 'DOT');
  ```
  
  <!-- entry: breaking api -->
- 6620935: Diagram JSON writes version 2, which names a graph page's boxes `clusters` and its grid's per-box columns `clusterColumns`.
  
  Version 1 files still read, with `groups` and `groupColumns` taken as the new names. A reader from before this release refuses a version 2 file.
  
  ```json
  // before
  { "format": "weasel-diagram", "version": 1, "pages": [{ "kind": "graph", "data": { "groups": [] } }] }
  // after
  { "format": "weasel-diagram", "version": 2, "pages": [{ "kind": "graph", "data": { "clusters": [] } }] }
  ```
  
  <!-- entry: breaking data -->
- c7db707: Every export reports what it drew without, a PNG's included, to `onDiagnostic`, and `strict: true` writes nothing then.
  
  `onWarn(message)` is gone from `ExportOptions`, `exportRegionSvg` and the diagram page exports. `onDiagnostic` hears each loss once as an `ExportDiagnostic`, `{ kind, subject, message }`: a picture or face that failed to load, a paint kind nothing registered, a shader with no GLSL, or what the format cannot hold. With `strict: true` the export rejects with `ExportIncompleteError`, whose `diagnostics` lists them.
  
  ```ts
  // before
  await exportRegions(scene, regions, 'svg', { onWarn: (m) => said.push(m) });
  // after
  await exportRegions(scene, regions, 'svg', { onDiagnostic: (d) => said.push(d.message) });
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

### Minor Changes

- cad10a3: `plotMeasureOf` is exported: it turns a diagram row measurer into the one a plot measures a line with, as plot pages already did.
  
  <!-- entry: api -->
- d26152c: svg, pdf and diagram-formats take `@weasel-js/export` as a peer, and the svg and pdf formats register in its registry.
  
  `registerSvgExport()` and `registerPdfExport()` register with `@weasel-js/export`'s registry; the packages' own exports are unchanged. For `@weasel-js/pdf` the peer is optional, as core is: only the `./export` entry reads it.
  
  <!-- entry: api -->
- 3fdb47e: A diagram page's SVG export can write its text as glyph outlines or with its faces embedded.
  
  `exportPageSvg` takes `serializeSvg`'s `text` option: `'live'` (the default), `'outline'` or `'embed'`.
  
  <!-- entry: rank=2 new api -->
- 5531792: The diagram page exports take pages read from the document, so a page moved during an export is written where it now is.
  
  Pass `pageRegionSource(page)` or `pageRegionsSource(pages)`, new in core, which find each page by its id in the revision the export draws and fail for one it removed. A fixed rect still works and is drawn where it was given.
  
  ```ts
  await exportPagesPdf(scene, pageRegionsSource(placedPagesOf(scene)));
  ```
  
  <!-- entry: api fix -->
- 77dcbc7: `scenePageKinds(scene, { page })` answers the kind of the one page a one-page writer would write: the page so named, else the first.
  
  So a menu can offer a one-page format such as DOT for the page in view while another page holds a kind it cannot write.
  
  <!-- entry: api -->

### Patch Changes

- 15f6e88: A DOT HTML label or Mermaid label breaks its line at a `<br>` that carries attributes, such as Graphviz's `<BR ALIGN="LEFT"/>`.
  
  <!-- entry: fix data -->
- 2dd1777: A diagram page's SVG export draws a node any registered painter claims with that painter, as the canvas does.
  
  The page exports are now built on core's, svg's and pdf's region exports, with the diagram painters and the diagram theme's page color added, and keep their names, options and defaults. A node no diagram painter claims, which was written by `svgLeafFromKit` whatever painted it on the canvas, is now written from the paths of the painter `registerNodeShape` registered for it, and any node deriving its path is drawn along it.
  
  <!-- entry: behavior -->
- 1466124: DOT and Mermaid write `hsl()`, `oklch()`, `oklab()` and `color()` colors as hex, so Graphviz and Mermaid draw them.
  
  They already wrote `rgb()` that way.
  
  <!-- entry: fix data -->
- d7d8178: `documentFromScene` keeps a container's `reorder` axis, as it already did a cluster's.
  
  <!-- entry: fix data -->
- 8e44cd6: DOT writes a container's dash as its cluster's `dashed` or `dotted` style, and reads a dashed or dotted cluster back as a dashed container.
  
  <!-- entry: fix data -->
- 09a4cfe: DOT writes the theme's stroke widths and dashes in its `node` and `edge` defaults, so Graphviz draws them.
  
  They also read back.
  
  <!-- entry: fix data -->
- 7897b2e: DOT detection no longer claims text whose first word only starts with `graph` or `digraph`, such as `graphite { }`, so another format can read it.
  
  <!-- entry: fix -->
- 499e62f: `readDocument` recognizes a DOT file with an HTML graph id or an indented `#` comment line.
  
  The DOT reader already read both.
  
  <!-- entry: fix -->
- a0a8314: DOT reads an HTML label laid out over several source lines as Graphviz draws it.
  
  Its own line breaks add no blank lines, each table row is a line, and a row's cells are a space apart.
  
  <!-- entry: fix data -->
- cd2b1f5: A DOT node placed by `pos` with no `width` or `height` is drawn at Graphviz's default 0.75 × 0.5 inch size, so it stays centered on its `pos`.
  
  <!-- entry: fix data visual -->
- 2e2c291: DOT writes a node's `width` and `height` on a page whose nodes are not all placed, instead of dropping its size.
  
  <!-- entry: fix data -->
- b4e1b9d: DOT import reads every X11 color name Graphviz draws, such as `red3`, `steelblue1` and `navyblue`, instead of dropping it with a warning.
  
  <!-- entry: fix data visual -->
- f31c5c3: DOT reads and writes color names as Graphviz draws them, in the X11 scheme.
  
  `green` reads as `#00ff00` and `gray50` as a gray; a name under `/svg/` still reads as CSS's. Every color name is written as hex.
  
  <!-- entry: fix data -->
- b1e32c4: DOT, Mermaid and draw-style XML write a shape's header row as its first line of text.
  
  Its aside follows the title. It had been dropped with a warning about port rows.
  
  <!-- entry: fix data -->
- ad59bf9: The Diagram JSON reader refuses a file whose `crossPageEdges` is not a list of edges, or whose page `name` is not a string.
  
  <!-- entry: fix data -->
- c3f5f17: The Diagram JSON reader refuses a page it could not draw, naming it.
  
  That is a page with no id, size or `data`, or a graph page without `nodes` and `edges` lists.
  
  <!-- entry: fix -->
- aefb97a: A page whose layout is named `toString`, `constructor` or another `Object.prototype` key is laid out as one naming an unknown layout is.
  
  <!-- entry: fix -->
- 73a8114: DOT, draw XML and Mermaid files read a shape, arrowhead, icon, entity or statement named `constructor` or `toString` as a name they do not know.
  
  <!-- entry: fix -->
- 909a581: `scenePageKinds` and `documentFromScene` agree on which pages are plot or sequence pages.
  
  Only outermost content makes a page a plot or sequence page, and a page holding both is a plot page. A plot or sequence root inside a group or container no longer turns its page into one on export.
  
  <!-- entry: fix data -->
- 8badda5: A graph page with only some nodes placed keeps every node on the page when layout puts one above or left of the rest.
  
  <!-- entry: fix behavior data -->
- ffb87c5: Imported and exported diagrams treat names like `constructor`, `toString` and `__proto__` as ordinary names.
  
  A Mermaid block named `__proto__` keeps its span and space, as do a flowchart node's `@{ __proto__: … }` metadata and a C4 `$__proto__=` argument. A block or group named for an `Object.prototype` member no longer writes a `columns` line of function source, an outline so named no longer throws, and a class or ER edge end so named writes as an arrow or as exactly one.
  
  <!-- entry: fix -->
- e82b401: Opening and saving a Diagram JSON file keeps a collapsed node collapsed, with the rows it hides.
  
  <!-- entry: fix data -->
- de61bc6: Opening and saving a Diagram JSON file keeps a shape's marks: `documentFromScene` reads them back.
  
  <!-- entry: fix data -->
- d0370c4: `documentFromScene` reads a shape's image and framed slots back as `slot` rows, so a saved diagram redraws them.
  
  Each keeps its place, height, width, id and image. A slot with neither an image nor an id draws nothing the scene keeps, so it is still not read back.
  
  <!-- entry: fix data -->
- 069e1ad: `scenePageKinds` throws for an `opts.page` a scene with no page list has no page for, as the one-page writers do.
  
  <!-- entry: fix -->
- 59b3f81: `addTemplatePage` draws the new page in the theme its scene names when no `theme` is passed, instead of the night theme.
  
  <!-- entry: fix visual -->
- a9aef21: DOT and Mermaid warn, naming the shape, when a shape in both a container and a group, or in two groups, is written inside only the first.
  
  <!-- entry: fix -->
- 7bf09d3: A one-page writer given a `page` the document lacks throws a `RangeError`, as `scenePageKinds` does.
  
  Both had written or answered for the first page instead.
  
  <!-- entry: fix behavior -->
- 6121e6b: Reading a Diagram JSON file whose `theme` is an object that is not a whole theme fails with what is wrong with it, as a bad page does.
  
  <!-- entry: fix -->
- 31c843e: A page export paints the page color of the theme the document is in when it is drawn, not when the export was asked for.
  
  <!-- entry: fix -->
- 4ad74a4: diagram's document bounds and diagram-formats' export read world poses through core's `worldPoses`.
  
  <!-- entry: internal -->
- 5e85e70: A DOT cluster nested in one with its own stroke or font color reads back without them: the writer resets both, the reader takes `""` as unset.
  
  <!-- entry: fix -->
- 39d05e0: A DOT node named as the cluster it sits in stays a member under its own name.
  
  <!-- entry: fix -->
- 49798bb: The DOT writer writes stroke widths, places and sizes in plain digits, never an exponent, so a tiny or huge one reads back.
  
  <!-- entry: fix -->
- a6aea38: A strict DOT graph keeps two edges apart when their end ids run together.
  
  <!-- entry: fix -->
- 7f1523c: A draw-style XML box with `absoluteArcSize=1` reads as a stadium or a rounded rect by its corner size in pixels.
  
  <!-- entry: fix data -->
- 45a6e71: Writing draw-style XML warns that a connector with the `avoid` router is written as a plain orthogonal one, which the format holds instead.
  
  <!-- entry: fix -->
- acf232a: A draw-style XML connector ending in a `bar` marker is written as the draw app's `ERone`, a tick square to the line.
  
  A draw app's `dash` arrowhead, a slash across the line, still reads as a `bar`, now with a warning.
  
  <!-- entry: fix data -->
- 1b291e6: draw.io export writes a BPMN end event as draw.io's end event, and reads one back as an end event rather than a start event.
  
  <!-- entry: fix data -->
- b897139: A draw-style XML `classic` arrowhead reads as `arrow-concave`, the concave arrow it is drawn as.
  
  A connector ending in `arrow-concave` keeps it through a write and a read. An end whose style names no arrowhead reads as the diagram's own marker.
  
  <!-- entry: fix data -->
- 387e8a1: Writing draw-style XML leaves a node two clusters name in the earlier one, as the diagram draws it, rather than nesting the clusters.
  
  <!-- entry: fix data -->
- e117ff0: Draw-style XML keeps a cluster's label: it is written as its group's label and read back.
  
  <!-- entry: fix data -->
- 4dfc5fe: Writing draw-style XML keeps the shapes a container's lanes name, and the connectors to them, rather than leaving them out of the file.
  
  <!-- entry: fix data -->
- 798ad88: Draw-style XML keeps a dash's lengths when written and read. A written dash opens in a draw app at the lengths the diagram draws, and a dash read from a file is scaled by its stroke width, as the draw app drew it.
  
  <!-- entry: fix data visual -->
- d02ad70: Draw-style XML claims the `.drawio` extension ahead of `.xml`: a `.drawio` file can be picked to import, and an export is named one.
  
  <!-- entry: fix -->
- 045a7de: A draw-style XML group or connector the read drops leaves its id free for a later page's cell.
  
  <!-- entry: fix data -->
- 8b9b65a: Reading draw-style XML warns of a group dropped for holding no shape, and of a connector left out for ending on one.
  
  <!-- entry: fix -->
- 476aa25: A draw-style XML group holding no shape is left out of its parent group, and a connector to it is left out with the loose-end warning.
  
  <!-- entry: fix -->
- db3d7eb: A draw-style XML connector with two labels at one end keeps the first, and the read warns that the other was left out.
  
  <!-- entry: fix -->
- b7bb04d: The draw-style XML writer gives a connector's end-label cell an id no other cell has.
  
  <!-- entry: fix -->
- f672861: Draw-style XML writes a container, pool, or lane a cluster names outside the cluster's group, as the diagram draws it.
  
  <!-- entry: fix data -->
- 476aa25: A draw-style XML file with a group inside a swimlane imports, its shapes in the swimlane and the group dropped with a warning.
  
  <!-- entry: fix -->
- 8efc33f: Draw-style XML labels break lines at HTML table rows, lists, and other block elements, as a browser lays them out. A `<br>` with attributes breaks a line too.
  
  <!-- entry: fix data -->
- 1d9eb87: A draw-style XML HTML label folds its whitespace as the draw app shows it.
  
  A newline in the HTML source no longer breaks a line, and a run of spaces reads as one.
  
  <!-- entry: fix data -->
- 3f516fd: A draw-style XML connector label dragged off its line reads where the draw app shows it, rather than back on the line.
  
  <!-- entry: fix data -->
- 24c30dd: Draw-style XML connector, container, pool and lane labels keep their line breaks when read.
  
  <!-- entry: fix data -->
- f108f93: Draw-style XML writes a node a pool's lane holds inside that lane, even when the pool's own `members` name it too. A node only a pool's `members` name is written outside the pool, as the diagram draws it.
  
  <!-- entry: fix data -->
- bf6d34f: A pool or a container written to draw-style XML reads back as what it was, an empty pool and a container of one tall container included.
  
  The writer marks each swimlane with a `weaselRole` style key, which a draw app ignores; a file without one is still read by how its swimlanes stack.
  
  <!-- entry: fix data -->
- 6e2eb38: Draw-style XML writes containers, pools, and lanes with solid outlines, as the diagram draws them. Reading a dashed swimlane warns that it is drawn solid.
  
  <!-- entry: fix data -->
- c854eef: A draw-style XML shape placed relative to another, such as a BPMN boundary event, reads where the draw app draws it.
  
  It sits at fractions of its parent's box, plus its offset.
  
  <!-- entry: fix data -->
- 523e14f: Draw-style XML reads a swimlane weasel marked as a container back as a container when it sits inside a pool, not as a lane.
  
  <!-- entry: fix data -->
- 28d44de: Reading draw-style XML warns of a shape it does not know when its style also rounds it, as it does for one drawn as a plain rect.
  
  <!-- entry: fix -->
- 6f406d5: Writing draw-style XML gives a shape the font of its first text row, a header included, bold by its numeric `weight` where it has one.
  
  A shape whose text rows are styled apart warns, since a cell holds one font for all its lines.
  
  <!-- entry: fix data -->
- 41a8434: Draw-style XML connectors with a segment, side-to-side or top-to-bottom edge style read as orthogonal, as the draw app routes them.
  
  <!-- entry: fix -->
- 315316c: A dragged label on a draw-style XML self-loop with no bends reads where it was dragged, rather than at the loop's middle.
  
  <!-- entry: fix data -->
- a022f43: Containers and pools written as draw-style XML are filled body and header in the draw app, as the diagram fills them.
  
  <!-- entry: fix visual data -->
- 4ec4ab9: A draw-style XML swimlane with no header size is measured with the draw app's default header.
  
  So a small pool of lanes reads as a pool rather than a container of containers.
  
  <!-- entry: fix data -->
- 7dd8031: Reading draw-style XML warns of a triangle, trapezoid or other shape whose `direction` turns it from how the diagram draws it.
  
  <!-- entry: fix -->
- 2788665: A draw-style XML cell with no id is no longer confused with a cell whose id matches the one it is given.
  
  <!-- entry: fix -->
- ceac6cc: A draw-style XML `UserObject` label with `placeholders="1"` reads with each `%name%` filled from the object's own attributes.
  
  <!-- entry: fix data -->
- 57f559b: Writing draw-style XML warns when it leaves out a text row's letter spacing or a weight between regular and bold.
  
  <!-- entry: fix -->
- edf757a: Reading draw-style XML warns when a shape's `rotation`, `flipH`, or `flipV` is left out, as it already did for a `direction`.
  
  <!-- entry: fix -->
- dcc51e5: A draw-style XML page read moves connector waypoints left of or above it onto it, and grows to hold those past its edges.
  
  <!-- entry: fix -->
- 8c2d558: `trackShapeD` and the draw.io writer write a non-finite coordinate as `0`, not `NaN`, as the SVG writer does.
  
  Both now write their four-place numbers through `trimNumber`.
  
  <!-- entry: fix data -->
- 56784d5: Comparisons of two lists entry by entry go through registry's `sameList` rather than hand-written loops.
  
  <!-- entry: internal -->
- 9c32853: The Mermaid architecture writer drops an edge to a group holding only other groups, with a warning, rather than write it to the inner group.
  
  <!-- entry: fix -->
- 4f75420: The Mermaid block writer renames a block named `block`, `space` or `columns`, so it reads back.
  
  <!-- entry: fix -->
- c6d6872: A Mermaid block diagram link naming a group declared further down joins that group, as one naming an earlier group does.
  
  <!-- entry: fix -->
- 486c65b: The Mermaid block writer names a group with a reader-style id (`block-1`) when a link or a style refers to it, so both read back.
  
  <!-- entry: fix -->
- fcacfa1: The Mermaid C4 writer writes no title line for a blank page name, and a name's line breaks as spaces with a warning, so the file reads back.
  
  <!-- entry: fix -->
- c9da7b9: The Mermaid C4 writer writes a `<<person_db>>` or `<<person_queue>>` element as a person, with a warning, so it reads back.
  
  <!-- entry: fix -->
- 84f6cba: The Mermaid C4 reader warns when its `title` statement replaces a different front matter or accessible title.
  
  <!-- entry: fix -->
- 49692b6: Mermaid chart readers warn when a title statement names the page and the `accTitle` is dropped. This covers pie, quadrant, packet, timeline, radar and xychart; a blank front matter title no longer hides an accessible one.
  
  <!-- entry: fix -->
- b1c7c70: Mermaid chart writers warn when a page's name is not its chart's title. Mermaid names a chart by its title alone; this holds for pie, packet, quadrant, radar, xychart, and timeline pages.
  
  <!-- entry: fix -->
- aaaefff: The Mermaid class writer drops a connector or note joined to a namespace, with a warning, rather than write a class of the namespace's name.
  
  <!-- entry: fix -->
- 6451d2e: A Mermaid class-diagram note line holding a backslash followed by `n` keeps it on the round trip, rather than splitting there.
  
  <!-- entry: fix -->
- 49c3043: The Mermaid class writer writes a note's text from its rows where it has no lines, rather than writing the note empty.
  
  <!-- entry: fix -->
- b2e1082: The Mermaid block, class, ER, C4 and architecture writers warn when they drop a connector port their kind cannot hold.
  
  <!-- entry: fix -->
- 64ed51e: The Mermaid readers skip an empty front matter block (`---` then `---`) before the diagram's header.
  
  <!-- entry: fix -->
- 7f3a00d: Mermaid requirement and kanban field names of several words are written as one, with underscores and a warning, so the file reads back.
  
  <!-- entry: fix -->
- 85e73e3: The Mermaid flowchart writer renames a node named `accTitle` or `accDescr`, so its edges read back.
  
  <!-- entry: fix -->
- 08c3b40: The Mermaid flowchart reader names a page by its `accTitle` where there is no front matter title, as the other kinds do.
  
  <!-- entry: fix -->
- 649dec8: A Mermaid flowchart node's `@{ … }` metadata reads a quoted value whole, commas and `}` in it included, as kanban cards already did.
  
  <!-- entry: fix -->
- 15ebe54: The Mermaid readers warn when they drop front matter other than the title, such as a `config:` block.
  
  <!-- entry: fix -->
- 72d4c08: The Mermaid gantt writer no longer writes `after` or an end naming a task id it had to drop.
  
  Such a task follows the task before it, or lasts a day, with a warning.
  
  <!-- entry: fix data -->
- 05fb71a: The Mermaid gantt writer renames a task id that is a tag word such as `done`, with a warning, and the starts and ends naming it.
  
  <!-- entry: fix -->
- fdda32d: The Mermaid git graph writer rounds a branch order that is not a whole number, and drops one below zero or not a number, with a warning.
  
  <!-- entry: fix -->
- 6354f78: A Mermaid gitGraph's `mainBranchName` setting names the main branch on read, and is written for a main branch not named `main`.
  
  <!-- entry: fix data -->
- f1e1d4b: The Mermaid journey writer drops the `{` after a step name opening `accTitle` or `accDescr`, with a warning, so the journey reads back.
  
  <!-- entry: fix -->
- 3fe2b14: A Mermaid kanban card with a generated id keeps it when the page holds nodes the board does not write. This covers ids such as `card-2` and `column-3`.
  
  <!-- entry: fix -->
- 3fe2b14: The Mermaid kanban writer keeps an id holding a `-` or opening with a digit, which a kanban reads, where it renamed `todo-list` to `todo_list`.
  
  <!-- entry: fix data -->
- 86ced3b: The Mermaid kanban writer keeps a card or column id such as `end` or `default` as it is, since a kanban reads it as an id.
  
  <!-- entry: fix -->
- 7f3a00d: The Mermaid kanban writer writes metadata values on one line, and warns when one holding both kinds of quote has its double quotes changed.
  
  <!-- entry: fix -->
- e7d3c77: A Mermaid `linkStyle` list with an empty entry, or one that is not a whole number, is refused with a line error rather than styling link 0.
  
  <!-- entry: fix -->
- 80a750f: The Mermaid flowchart reader reads an apostrophe inside a plain `@{ … }` metadata value (`label: it's done`) as text.
  
  <!-- entry: fix -->
- 7e5c45b: The Mermaid mind map writer writes a cloud shape in a cloud's brackets, `)…(`, so Mermaid draws a cloud rather than a bang.
  
  <!-- entry: fix visual -->
- eba9844: The Mermaid mind map writer warns when it drops a connector that would give a shape a second parent or close a loop.
  
  <!-- entry: fix -->
- eba9844: The Mermaid mind map writer roots a page whose connectors all form a loop at its first shape, where it wrote an empty map.
  
  <!-- entry: fix data -->
- c1abe6c: Mermaid notes, concurrent regions, and anonymous cards, columns and groups read with ids no named item holds.
  
  <!-- entry: fix -->
- e0f7b0a: Mermaid ER entities, architecture services, classes and states keep a name equal to their id when the writer cleans that id.
  
  <!-- entry: fix -->
- ad6f0b7: A Mermaid chart's number field holding a very long run of digits is read in time linear in its length.
  
  <!-- entry: fix perf -->
- b33bd0a: The Mermaid quadrant writer rewrites a point class name Mermaid cannot read, with a warning. A point classed `hot spot` keeps its name, and the file reads back.
  
  <!-- entry: fix -->
- 49dbe93: The Mermaid quadrant writer writes a point color holding commas in hex, and drops a non-numeric radius or stroke width with a warning.
  
  <!-- entry: fix -->
- c0ff74d: The Mermaid radar writer gives axes, and curves, whose ids it rewrites spellings no other axis or curve takes, so they read back apart.
  
  <!-- entry: fix -->
- 49692b6: The Mermaid radar reader names a page by its front matter or accessible title where its `title` statement is empty.
  
  <!-- entry: fix data -->
- f22d327: The Mermaid radar writer drops a `max`, `min` or `ticks` that is not a number, with a warning, so the chart reads back.
  
  <!-- entry: fix -->
- 2c4a421: The Mermaid requirement writer warns when it drops a box's text rows between its name and its divider, or rows that are not text or fields.
  
  <!-- entry: fix -->
- 2c4a421: Two Mermaid requirement boxes whose names differ only in `"` and `'` stay two boxes. The writer writes a name's double quotes as single ones, with a warning.
  
  <!-- entry: fix data -->
- 2e9e461: A Mermaid requirement box with no name row is written under its id, rather than under a field row past its divider.
  
  <!-- entry: fix -->
- f20783f: A Mermaid requirement field value wrapped in double quotes, or opening or closing with a space, keeps them on the round trip.
  
  <!-- entry: fix -->
- 2c4a421: The Mermaid requirement writer warns when it drops the colors of a block whose name is not one word.
  
  <!-- entry: fix -->
- 92fff5b: The Mermaid sankey writer writes a node name holding a line break on one line, with a warning, so the file reads back.
  
  <!-- entry: fix -->
- 5052acf: The Mermaid sequence reader names a page by its `accTitle` where the diagram has no title, as the other kinds do.
  
  <!-- entry: fix data -->
- bfc3db8: The Mermaid sequence writer writes a non-finite `autonumber` start as plain `autonumber`, with a warning.
  
  <!-- entry: fix -->
- 01f619e: A Mermaid sequence box with no fill whose label opens with a color word is written as `box transparent …`, so the word reads back as label.
  
  <!-- entry: fix -->
- bfc3db8: The Mermaid sequence writer declares each box's members together, so a box reads back whole. Members only messages name are declared in it too; a warning says where a participant moved, or where a created one is written outside its box.
  
  <!-- entry: fix data -->
- 2e8c396: The Mermaid sequence writer renames a participant named `links`, `link`, `properties` or `details`, so its messages read back.
  
  <!-- entry: fix -->
- ab98f48: A Mermaid sequence page is named as every other Mermaid kind names one. An empty `title` statement leaves the front matter title to name it, and a front matter title or key it drops is warned of.
  
  <!-- entry: fix -->
- 1990c2a: The Mermaid sequence writer drops a box or region fill Mermaid would not read as a color, with a warning. A box filled `var(--brand)` keeps its label.
  
  <!-- entry: fix -->
- 019d5c4: A Mermaid composite state labelled by a description written before its block reads with that label.
  
  <!-- entry: fix -->
- e8dea10: A Mermaid state described before its `state "…" as` line keeps that description under its name.
  
  <!-- entry: fix -->
- 542acc4: The Mermaid state writer drops a note's blank lines and the spaces around its lines, with a warning. Mermaid reads a note without them.
  
  <!-- entry: fix -->
- 7435a03: Mermaid state notes write back as notes, never as phantom states. A note joined from its state sits beside it; one beside only a start or end, and a note's connectors past its first, are dropped with a warning.
  
  <!-- entry: fix data -->
- 9083753: A Mermaid state note with a line reading `end note` is written so that line does not close the note, and the file reads back.
  
  <!-- entry: fix -->
- 7435a03: The Mermaid state writer writes a note's text from its rows, where it wrote the note empty.
  
  <!-- entry: fix data -->
- 7435a03: No state moves into a composite when a Mermaid state diagram reads back. The writer drops a transition joining a composite's `[*]` to a state outside it, with a warning.
  
  <!-- entry: fix data -->
- 7435a03: The Mermaid state reader colors a start or end given a class in a transition, as in `[*]:::go --> A`.
  
  <!-- entry: fix visual -->
- 7435a03: The Mermaid state writer warns when it drops a start or end state's colors.
  
  <!-- entry: fix -->
- b204db7: The Mermaid state writer warns when a diamond with text is written as a plain state, since a choice holds no text.
  
  <!-- entry: fix -->
- 096eaaa: The Mermaid state writer warns when start and end shapes would read back merged, swapped, or dropped. That is a second start or end in one composite, a start a transition arrives at, an end one leaves, or one no transition names.
  
  <!-- entry: fix -->
- 72b77b9: A Mermaid `stroke-width` or `stroke-dasharray` that is not a number is dropped with a warning, as a color a diagram cannot draw is.
  
  <!-- entry: fix -->
- 96200ff: A Mermaid subgraph sharing its id with a node reads as a container of its own id, as DOT reads a cluster named as a node.
  
  <!-- entry: fix -->
- 9eb2725: A Mermaid file with a `%%{` directive never closed is refused with a line error, as an unclosed `accDescr` block is, rather than read as empty.
  
  <!-- entry: fix -->
- c7f31e3: The Mermaid flowchart, block, architecture and C4 writers warn when they write a connector end they have no head for as an arrow.
  
  <!-- entry: fix -->
- de6aa0d: The Mermaid xychart reader reads `accTitle` and `accDescr` as the other kinds do. `accTitle : Sales` no longer throws, and an accessible title names a page that has no title.
  
  <!-- entry: fix data -->
- de6aa0d: The Mermaid xychart reader reads an axis or series title written as one bare word, as in `y-axis Revenue 4000 --> 11000`.
  
  <!-- entry: fix data -->
- 62a99c5: Reading a Mermaid xychart warns when its title statement replaces a different front matter title, as the other chart kinds do.
  
  <!-- entry: fix -->
- 32513fc: The Mermaid xychart writer drops an axis range with an end that is not a number, with a warning, so the chart reads back.
  
  <!-- entry: fix -->
- de6aa0d: The Mermaid xychart reader throws, naming the line, on a `%%{` directive or `accDescr {` block that is never closed, as the other kinds do.
  
  <!-- entry: fix -->
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
- Updated dependencies [e973dcd]
- Updated dependencies [851a4d3]
- Updated dependencies [9c88969]
- Updated dependencies [d764d06]
- Updated dependencies [f1bc116]
- Updated dependencies [effe879]
- Updated dependencies [db9988a]
- Updated dependencies [85e334d]
- Updated dependencies [85e334d]
- Updated dependencies [a98ad34]
- Updated dependencies [7f25db9]
- Updated dependencies [c3a8dea]
- Updated dependencies [c7e5656]
- Updated dependencies [2c2ab71]
- Updated dependencies [06d4d46]
- Updated dependencies [8bd0c2d]
- Updated dependencies [f4ad599]
- Updated dependencies [e448c6f]
- Updated dependencies [08b07ae]
- Updated dependencies [a4ef1f7]
- Updated dependencies [7e971ee]
- Updated dependencies [8bd0c2d]
- Updated dependencies [e448c6f]
- Updated dependencies [643c699]
- Updated dependencies [ca5bcb0]
- Updated dependencies [6da5a3b]
- Updated dependencies [4fb8cbf]
- Updated dependencies [a7dab9f]
- Updated dependencies [63fbbdf]
- Updated dependencies [3f23bc8]
- Updated dependencies [1b291e6]
- Updated dependencies [7dc55af]
- Updated dependencies [9249b26]
- Updated dependencies [f20931c]
- Updated dependencies [44848fe]
- Updated dependencies [9a3bf41]
- Updated dependencies [3bf5d6c]
- Updated dependencies [315f5ee]
- Updated dependencies [97f1f86]
- Updated dependencies [1566d81]
- Updated dependencies [6bbc0e5]
- Updated dependencies [33c1e37]
- Updated dependencies [62f5560]
- Updated dependencies [ec44e4c]
- Updated dependencies [063b00c]
- Updated dependencies [bfc8672]
- Updated dependencies [8dd351a]
- Updated dependencies [8a1c306]
- Updated dependencies [c4cb671]
- Updated dependencies [72b6d07]
- Updated dependencies [840a01b]
- Updated dependencies [f172abc]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
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
- Updated dependencies [2aae9c7]
- Updated dependencies [de28465]
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
- Updated dependencies [01be5ca]
- Updated dependencies [0698b8a]
- Updated dependencies [09b9ec7]
- Updated dependencies [7808c46]
- Updated dependencies [5f9bea2]
- Updated dependencies [fa33365]
- Updated dependencies [043cdcc]
- Updated dependencies [ab9b2a8]
- Updated dependencies [e0f4c91]
- Updated dependencies [503ed8e]
- Updated dependencies [761c418]
- Updated dependencies [47991e7]
- Updated dependencies [1daf5d8]
- Updated dependencies [7eba566]
- Updated dependencies [68ad237]
- Updated dependencies [1fc30a9]
- Updated dependencies [5cf57a3]
- Updated dependencies [166e04a]
- Updated dependencies [16bcc1f]
- Updated dependencies [a46566f]
- Updated dependencies [761c418]
- Updated dependencies [42aab0c]
- Updated dependencies [e3a1721]
- Updated dependencies [77329ef]
- Updated dependencies [5066ab8]
- Updated dependencies [c526e13]
- Updated dependencies [3f6ce6c]
- Updated dependencies [831a2b2]
- Updated dependencies [adb8862]
- Updated dependencies [44c2bd0]
- Updated dependencies [a4bf5e1]
- Updated dependencies [036700d]
- Updated dependencies [e82b401]
- Updated dependencies [6200d28]
- Updated dependencies [761c418]
- Updated dependencies [761c418]
- Updated dependencies [f9cb915]
- Updated dependencies [5a4c0ad]
- Updated dependencies [34e26b9]
- Updated dependencies [865f78e]
- Updated dependencies [37f3652]
- Updated dependencies [8386869]
- Updated dependencies [7821156]
- Updated dependencies [3ebb282]
- Updated dependencies [8f3e8e5]
- Updated dependencies [596acb7]
- Updated dependencies [d091135]
- Updated dependencies [c153b90]
- Updated dependencies [72e1c0e]
- Updated dependencies [6ac2b44]
- Updated dependencies [1804d61]
- Updated dependencies [72e1c0e]
- Updated dependencies [d747443]
- Updated dependencies [5c81350]
- Updated dependencies [6200d28]
- Updated dependencies [31df350]
- Updated dependencies [7606b26]
- Updated dependencies [ba5c5d5]
- Updated dependencies [bfc26b4]
- Updated dependencies [166946e]
- Updated dependencies [cf82793]
- Updated dependencies [b4772dc]
- Updated dependencies [dcb2e4d]
- Updated dependencies [8fbb4b2]
- Updated dependencies [7ce0db4]
- Updated dependencies [934dc61]
- Updated dependencies [eba59c7]
- Updated dependencies [028398e]
- Updated dependencies [c757e23]
- Updated dependencies [786d7e4]
- Updated dependencies [e458d95]
- Updated dependencies [840a01b]
- Updated dependencies [c9c39dd]
- Updated dependencies [ac3e936]
- Updated dependencies [c119620]
- Updated dependencies [859b0c3]
- Updated dependencies [672e827]
- Updated dependencies [a1a4caf]
- Updated dependencies [bc47b9e]
- Updated dependencies [d3c9045]
- Updated dependencies [5f2eac9]
- Updated dependencies [d689e44]
- Updated dependencies [f40681f]
- Updated dependencies [3a650b6]
- Updated dependencies [cf3e7dd]
- Updated dependencies [9bd1284]
- Updated dependencies [7a21cbd]
- Updated dependencies [554a3c7]
- Updated dependencies [187d21a]
- Updated dependencies [2aef76e]
- Updated dependencies [2b1c344]
- Updated dependencies [bc99ea3]
- Updated dependencies [9b59a03]
- Updated dependencies [963678e]
- Updated dependencies [932b85d]
- Updated dependencies [2dac7b8]
- Updated dependencies [e4dc727]
- Updated dependencies [ab9b2a8]
- Updated dependencies [8daaf5a]
- Updated dependencies [3f6ce6c]
- Updated dependencies [963f8fd]
- Updated dependencies [0a5cd7a]
- Updated dependencies [e4e3b6a]
- Updated dependencies [c39e272]
- Updated dependencies [119b6c5]
- Updated dependencies [6121e6b]
- Updated dependencies [c95ff39]
- Updated dependencies [493f964]
- Updated dependencies [eaa8ff5]
- Updated dependencies [9bd1284]
- Updated dependencies [185a234]
- Updated dependencies [862459a]
- Updated dependencies [67598c9]
- Updated dependencies [cbbafe8]
- Updated dependencies [67f65a0]
- Updated dependencies [dd7e196]
- Updated dependencies [761c418]
- Updated dependencies [d747443]
- Updated dependencies [9709a41]
- Updated dependencies [90d75a5]
- Updated dependencies [9acf4ce]
- Updated dependencies [50c0635]
- Updated dependencies [5eac231]
- Updated dependencies [ee18e9e]
- Updated dependencies [f5bd421]
- Updated dependencies [eba59c7]
- Updated dependencies [4ad74a4]
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
- Updated dependencies [cfc0732]
- Updated dependencies [3a8b706]
- Updated dependencies [15d434b]
- Updated dependencies [60ca157]
- Updated dependencies [15a08cc]
- Updated dependencies [5a805e9]
- Updated dependencies [81f2080]
- Updated dependencies [fcc5602]
- Updated dependencies [b7d8fb2]
- Updated dependencies [8c58288]
- Updated dependencies [084198c]
- Updated dependencies [b0d7740]
- Updated dependencies [df9a774]
- Updated dependencies [a639e4d]
- Updated dependencies [c64e46f]
- Updated dependencies [64fed84]
- Updated dependencies [964a242]
- Updated dependencies [1566d81]
- Updated dependencies [2755b11]
- Updated dependencies [23e50c1]
- Updated dependencies [78aa95d]
- Updated dependencies [47991e7]
- Updated dependencies [51978f9]
- Updated dependencies [6d731a9]
- Updated dependencies [bfd5db9]
- Updated dependencies [15bd121]
- Updated dependencies [47991e7]
- Updated dependencies [47991e7]
- Updated dependencies [ec49e8c]
- Updated dependencies [6d731a9]
- Updated dependencies [47991e7]
- Updated dependencies [6cf8816]
- Updated dependencies [7cbda84]
- Updated dependencies [c6aae22]
- Updated dependencies [4b25e60]
- Updated dependencies [708d9a3]
- Updated dependencies [49aa4d8]
- Updated dependencies [44892a1]
- Updated dependencies [85c4174]
- Updated dependencies [da46a5c]
- Updated dependencies [6debed8]
- Updated dependencies [8da4737]
- Updated dependencies [360ef8d]
- Updated dependencies [08c1713]
- Updated dependencies [6cf8816]
- Updated dependencies [e8957b6]
- Updated dependencies [47991e7]
- Updated dependencies [ef600c0]
- Updated dependencies [23e50c1]
- Updated dependencies [2c2021d]
- Updated dependencies [b74a24f]
- Updated dependencies [8bea5be]
- Updated dependencies [dc881e4]
- Updated dependencies [23e50c1]
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
- Updated dependencies [95ca540]
- Updated dependencies [180ec74]
- Updated dependencies [36dac61]
- Updated dependencies [9787bca]
- Updated dependencies [16a2eed]
- Updated dependencies [3eb3209]
- Updated dependencies [2ac34a7]
- Updated dependencies [7e60049]
- Updated dependencies [3fc3c93]
- Updated dependencies [31c843e]
- Updated dependencies [c7db707]
- Updated dependencies [e0f4c91]
- Updated dependencies [592a789]
- Updated dependencies [d26152c]
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
- Updated dependencies [cbd9a26]
- Updated dependencies [6bb95ac]
- Updated dependencies [6619ff1]
- Updated dependencies [3c212ef]
- Updated dependencies [23d94db]
- Updated dependencies [50900c3]
- Updated dependencies [cc5b0c3]
- Updated dependencies [b1cfa76]
- Updated dependencies [4be1a3f]
- Updated dependencies [899a776]
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
- Updated dependencies [ed0fff4]
- Updated dependencies [8764186]
- Updated dependencies [a7dab9f]
- Updated dependencies [3a1bfaa]
- Updated dependencies [42f1123]
- Updated dependencies [6943c8d]
- Updated dependencies [9b7e01c]
- Updated dependencies [aedb49f]
- Updated dependencies [2b51070]
- Updated dependencies [711846c]
- Updated dependencies [bf0869d]
- Updated dependencies [012eac4]
- Updated dependencies [280f109]
- Updated dependencies [1bc1b5c]
- Updated dependencies [fc2594c]
- Updated dependencies [6a5449e]
- Updated dependencies [e044df2]
- Updated dependencies [4a18e17]
- Updated dependencies [27649f2]
- Updated dependencies [5117a3c]
- Updated dependencies [a0f437e]
- Updated dependencies [19f8e39]
- Updated dependencies [8882b53]
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
- Updated dependencies [cb89cf1]
- Updated dependencies [a20fc8c]
- Updated dependencies [a2fbf00]
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
- Updated dependencies [09d5ade]
- Updated dependencies [601b526]
- Updated dependencies [08979e8]
- Updated dependencies [19f10ce]
- Updated dependencies [2a875e8]
- Updated dependencies [0325a0e]
- Updated dependencies [0b29cea]
- Updated dependencies [c22c9a6]
- Updated dependencies [0ac8104]
- Updated dependencies [b1e9d32]
- Updated dependencies [de8f61d]
- Updated dependencies [a5166b0]
- Updated dependencies [8b65c38]
- Updated dependencies [56784d5]
- Updated dependencies [3a0ae45]
- Updated dependencies [033c46f]
- Updated dependencies [4cc61de]
- Updated dependencies [f219a71]
- Updated dependencies [812c469]
- Updated dependencies [b54ab5f]
- Updated dependencies [8c7d44b]
- Updated dependencies [b2b79f1]
- Updated dependencies [932b85d]
- Updated dependencies [ec23b4e]
- Updated dependencies [d2002e0]
- Updated dependencies [b0905a2]
- Updated dependencies [bfc31d6]
- Updated dependencies [de8f61d]
- Updated dependencies [a23ebea]
- Updated dependencies [b10e05f]
- Updated dependencies [28b5165]
- Updated dependencies [ff70ebe]
- Updated dependencies [0f43324]
- Updated dependencies [f4b9a4a]
- Updated dependencies [5792fce]
- Updated dependencies [bdd33c6]
- Updated dependencies [060c64c]
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
- Updated dependencies [da0d0d0]
- Updated dependencies [a0bb229]
- Updated dependencies [aedb49f]
- Updated dependencies [067cf55]
- Updated dependencies [b750660]
- Updated dependencies [5b5d307]
- Updated dependencies [dc881e4]
- Updated dependencies [46c6d05]
- Updated dependencies [4d0042b]
- Updated dependencies [0a05da3]
- Updated dependencies [3e108b4]
- Updated dependencies [f4e98a4]
- Updated dependencies [b323f97]
- Updated dependencies [0bb71da]
- Updated dependencies [4bda721]
- Updated dependencies [744fbce]
- Updated dependencies [fd2cbc8]
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
- Updated dependencies [e4a8c4f]
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
- Updated dependencies [e0f4c91]
- Updated dependencies [9fcdf65]
- Updated dependencies [c7db707]
- Updated dependencies [a3136aa]
- Updated dependencies [b7ab797]
- Updated dependencies [5db4fbd]
- Updated dependencies [c1d5825]
- Updated dependencies [c61fac2]
- Updated dependencies [6094d45]
- Updated dependencies [41e356b]
- Updated dependencies [f640899]
- Updated dependencies [0c512db]
- Updated dependencies [75de2c0]
- Updated dependencies [4d05907]
- Updated dependencies [8d41608]
- Updated dependencies [f26ff16]
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
- Updated dependencies [92f39f0]
- Updated dependencies [b6ecd37]
- Updated dependencies [43600a8]
- Updated dependencies [92f39f0]
- Updated dependencies [be684c0]
- Updated dependencies [44c2bd0]
- Updated dependencies [e783994]
- Updated dependencies [2e90881]
- Updated dependencies [0424362]
- Updated dependencies [333ec2c]
- Updated dependencies [73eb657]
- Updated dependencies [51f04ea]
- Updated dependencies [e1b3f4a]
- Updated dependencies [52b42c2]
- Updated dependencies [1de58a2]
- Updated dependencies [8274b0a]
- Updated dependencies [2f865f0]
- Updated dependencies [f28150b]
- Updated dependencies [70213a5]
- Updated dependencies [232697b]
- Updated dependencies [1c7b2a8]
- Updated dependencies [1962081]
- Updated dependencies [d2f7077]
- Updated dependencies [1ed4afd]
- Updated dependencies [92f39f0]
- Updated dependencies [ac1e8b1]
- Updated dependencies [c007853]
- Updated dependencies [3d65b6c]
- Updated dependencies [e2a52da]
- Updated dependencies [05c53c9]
- Updated dependencies [3b37142]
- Updated dependencies [bfc26b4]
- Updated dependencies [5f50e9b]
- Updated dependencies [92f39f0]
- Updated dependencies [23f13f4]
- Updated dependencies [92f39f0]
- Updated dependencies [23f13f4]
- Updated dependencies [f3723ee]
- Updated dependencies [18792d3]
- Updated dependencies [2c900fd]
- Updated dependencies [0362193]
- Updated dependencies [768acf7]
- Updated dependencies [4bf376e]
- Updated dependencies [3207a40]
- Updated dependencies [e49aa18]
- Updated dependencies [45e100f]
- Updated dependencies [6ab962a]
- Updated dependencies [6ab962a]
- Updated dependencies [4d0042b]
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
- Updated dependencies [65dfc8b]
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
- Updated dependencies [5c089e8]
- Updated dependencies [6fcc7aa]
- Updated dependencies [0e80f73]
- Updated dependencies [c873b55]
- Updated dependencies [aedb49f]
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
- Updated dependencies [74e37d7]
- Updated dependencies [8f61f88]
- Updated dependencies [231eec5]
- Updated dependencies [85fc2ee]
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
- Updated dependencies [f5e0446]
- Updated dependencies [f6c305d]
- Updated dependencies [00a1f20]
- Updated dependencies [6451f0c]
- Updated dependencies [f3a1232]
- Updated dependencies [d55c488]
- Updated dependencies [7fdffc0]
- Updated dependencies [56fda8d]
- Updated dependencies [47f47ae]
- Updated dependencies [5c778a0]
- Updated dependencies [162f816]
- Updated dependencies [f88d616]
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
- Updated dependencies [b835405]
- Updated dependencies [bf1cf7b]
- Updated dependencies [c3e773c]
- Updated dependencies [dfcae5d]
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
- Updated dependencies [897ac02]
- Updated dependencies [000d836]
- Updated dependencies [f7968a0]
- Updated dependencies [e67a371]
- Updated dependencies [44ea8a6]
- Updated dependencies [cd86873]
- Updated dependencies [894f261]
- Updated dependencies [894f261]
- Updated dependencies [e408338]
- Updated dependencies [55d8e65]
- Updated dependencies [9f9a61a]
- Updated dependencies [b646c27]
- Updated dependencies [850db0a]
- Updated dependencies [ef3ebdd]
- Updated dependencies [0828a03]
- Updated dependencies [b92bf56]
- Updated dependencies [0828a03]
- Updated dependencies [f23829c]
- Updated dependencies [9521334]
- Updated dependencies [0177219]
- Updated dependencies [670aeb3]
- Updated dependencies [12cfcfc]
- Updated dependencies [f86aaa2]
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
- Updated dependencies [b915832]
- Updated dependencies [962563d]
- Updated dependencies [db6b387]
- Updated dependencies [41149dd]
- Updated dependencies [73e93db]
- Updated dependencies [c11f37e]
- Updated dependencies [cb6e47b]
- Updated dependencies [e39dbc5]
- Updated dependencies [1c0046a]
- Updated dependencies [a34f319]
- Updated dependencies [cbcd314]
- Updated dependencies [9e23aea]
- Updated dependencies [dee342f]
- Updated dependencies [3fbc4d6]
- Updated dependencies [0f77df5]
- Updated dependencies [2a7c91b]
- Updated dependencies [98d2f9a]
- Updated dependencies [cf2ad81]
- Updated dependencies [6bdf14d]
- Updated dependencies [6bea0c5]
- Updated dependencies [8635c1a]
- Updated dependencies [e58f9c3]
- Updated dependencies [6b738ad]
- Updated dependencies [cb268d7]
- Updated dependencies [e0f4c91]
- Updated dependencies [86c3dda]
- Updated dependencies [0dbf7f0]
- Updated dependencies [406612a]
- Updated dependencies [9e1a07c]
- Updated dependencies [20053ab]
- Updated dependencies [b261adb]
- Updated dependencies [fc3aeaf]
- Updated dependencies [a50e75e]
- Updated dependencies [482acd3]
- Updated dependencies [8f72646]
- Updated dependencies [bc8577d]
- Updated dependencies [ca0cf36]
- Updated dependencies [23fe5e7]
- Updated dependencies [6606d90]
- Updated dependencies [3b772e0]
- Updated dependencies [b9a8c22]
- Updated dependencies [c201aeb]
- Updated dependencies [d552c5c]
- Updated dependencies [ce87000]
- Updated dependencies [2e9f432]
- Updated dependencies [62ce053]
- Updated dependencies [c6d7970]
- Updated dependencies [bfc26b4]
- Updated dependencies [9eddc4c]
- Updated dependencies [2b30093]
- Updated dependencies [91e0203]
- Updated dependencies [ab421aa]
- Updated dependencies [05571fd]
- Updated dependencies [93da482]
- Updated dependencies [3d4a54b]
- Updated dependencies [0b0d423]
- Updated dependencies [89b9241]
- Updated dependencies [e4dc16a]
- Updated dependencies [f1caee8]
- Updated dependencies [1aa0af1]
- Updated dependencies [acff6d2]
- Updated dependencies [7b062ca]
- Updated dependencies [eb89dc5]
- Updated dependencies [265137c]
- Updated dependencies [2c93ce3]
- Updated dependencies [7124255]
- Updated dependencies [0080be9]
- Updated dependencies [8bd989e]
- Updated dependencies [ba05af9]
- Updated dependencies [5202a9f]
- Updated dependencies [caecf8f]
- Updated dependencies [d97fb3b]
- Updated dependencies [3d6ca96]
- Updated dependencies [bbbadfb]
- Updated dependencies [bbbadfb]
- Updated dependencies [9d24719]
- Updated dependencies [42f9cce]
- Updated dependencies [04d45ec]
- Updated dependencies [b5046e5]
- Updated dependencies [b4e4fa4]
- Updated dependencies [8f2eb10]
- Updated dependencies [1e4dc77]
- Updated dependencies [c8d95f5]
- Updated dependencies [f8b78a3]
- Updated dependencies [5d3b9b7]
- Updated dependencies [cc7b4de]
- Updated dependencies [faa4c8d]
- Updated dependencies [e331441]
- Updated dependencies [f602e56]
- Updated dependencies [6e1cc34]
- Updated dependencies [5a4f81e]
- Updated dependencies [e200728]
- Updated dependencies [9b8fcab]
- Updated dependencies [a82e65b]
- Updated dependencies [1e4dc77]
- Updated dependencies [66824dc]
- Updated dependencies [1e4dc77]
- Updated dependencies [90ba557]
- Updated dependencies [7950ee6]
- Updated dependencies [e6c3bdd]
- Updated dependencies [25b8182]
- Updated dependencies [bbb2875]
- Updated dependencies [80940a2]
- Updated dependencies [c859cb8]
- Updated dependencies [64e4aaf]
- Updated dependencies [3072890]
- Updated dependencies [905e345]
- Updated dependencies [152cc89]
- Updated dependencies [7dd6c75]
- Updated dependencies [78dd590]
- Updated dependencies [d3f717d]
- Updated dependencies [27704ec]
- Updated dependencies [60c082d]
- Updated dependencies [46ec294]
- Updated dependencies [ae15ab8]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
- Updated dependencies [4c592ae]
- Updated dependencies [6153ae7]
- Updated dependencies [3551ece]
- Updated dependencies [fd2cbc8]
- Updated dependencies [959f804]
- Updated dependencies [6b5336b]
- Updated dependencies [dc881e4]
- Updated dependencies [4aaefe7]
- Updated dependencies [3871e2f]
- Updated dependencies [4377fe2]
- Updated dependencies [4b0b9df]
- Updated dependencies [a23ebea]
- Updated dependencies [fd2cbc8]
- Updated dependencies [d9eb095]
- Updated dependencies [c62a3d3]
- Updated dependencies [f9427e6]
- Updated dependencies [02f9570]
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
- Updated dependencies [774e9cc]
- Updated dependencies [a06c164]
- Updated dependencies [9e8b91e]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [4c6e74f]
- Updated dependencies [34b8a3f]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [017fa7a]
- Updated dependencies [5f6c2d7]
- Updated dependencies [a5c1865]
- Updated dependencies [0d977b8]
- Updated dependencies [f652afe]
- Updated dependencies [6494d25]
- Updated dependencies [30bf620]
- Updated dependencies [41f0773]
- Updated dependencies [c4783b4]
- Updated dependencies [edcb456]
- Updated dependencies [f2b94bc]
- Updated dependencies [4198fea]
- Updated dependencies [0ac8104]
- Updated dependencies [475c725]
- Updated dependencies [adca5ed]
- Updated dependencies [c7db707]
- Updated dependencies [ca65c7b]
- Updated dependencies [987dd51]
- Updated dependencies [812c469]
- Updated dependencies [f71667e]
- Updated dependencies [12816b7]
- Updated dependencies [5b8e066]
- Updated dependencies [4254248]
- Updated dependencies [087e02c]
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
  - @weasel-js/geom@2.0.0
  - @weasel-js/diagram@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/paint@2.0.0
  - @weasel-js/svg@2.0.0
  - @weasel-js/plot@2.0.0
  - @weasel-js/export@2.0.0
  - @weasel-js/pdf@2.0.0

## 1.19.1

### Patch Changes

- 2bb0e54: draw.io export sizes a group from geom's `unionRects` and now depends on `@weasel-js/geom`.
  
  <!-- entry: internal -->
- 2e9ee3a: `exportPagePng` encodes its PNG on a page canvas where the browser has no `OffscreenCanvas`, instead of throwing.
  
  <!-- entry: fix -->
- 1eb86fa: `exportPagePng` and `exportPagesPdf` draw the document, as `exportPageSvg` does, rather than a drag or edit in flight.
  
  <!-- entry: fix -->
- 06810d2: Writing a shape that has ports or port labels of its own to DOT, Mermaid or draw.io warns that they were dropped.
  
  <!-- entry: fix -->
- Updated dependencies [c91c39c]
- Updated dependencies [d65a34b]
- Updated dependencies [c93b396]
- Updated dependencies [687501a]
- Updated dependencies [3e8a149]
- Updated dependencies [b1fdbf3]
- Updated dependencies [687501a]
- Updated dependencies [de8f829]
- Updated dependencies [e8de9c3]
- Updated dependencies [e17dbd6]
- Updated dependencies [2bb5cde]
- Updated dependencies [1f42c0c]
- Updated dependencies [34e40b2]
- Updated dependencies [d9a7171]
- Updated dependencies [f0ef9ba]
- Updated dependencies [9b03a7b]
- Updated dependencies [e17dbd6]
- Updated dependencies [a2627b8]
- Updated dependencies [2a32658]
- Updated dependencies [dbbca9f]
- Updated dependencies [3cd42d9]
- Updated dependencies [913a468]
- Updated dependencies [eb6276d]
- Updated dependencies [34dfc04]
- Updated dependencies [ef4ff01]
- Updated dependencies [5e0f965]
- Updated dependencies [c3c9f05]
- Updated dependencies [7f2951f]
- Updated dependencies [a760b7b]
- Updated dependencies [d11f1df]
- Updated dependencies [baa3137]
- Updated dependencies [c12b7a7]
- Updated dependencies [1ba8505]
- Updated dependencies [500c153]
- Updated dependencies [661582d]
- Updated dependencies [5b509a7]
- Updated dependencies [c3c9f05]
- Updated dependencies [73bdfc7]
- Updated dependencies [b39b992]
- Updated dependencies [b39b992]
- Updated dependencies [8ea61a3]
- Updated dependencies [59a1c5f]
- Updated dependencies [5c1d019]
- Updated dependencies [f0946c4]
- Updated dependencies [1f55652]
- Updated dependencies [d3a8b36]
- Updated dependencies [635431c]
- Updated dependencies [60d4ba5]
- Updated dependencies [f6a2555]
- Updated dependencies [9a0d9d1]
- Updated dependencies [e45b7e4]
- Updated dependencies [9bd6635]
- Updated dependencies [2a03672]
- Updated dependencies [7036750]
- Updated dependencies [d74dbb8]
- Updated dependencies [413ee4c]
- Updated dependencies [1ba8505]
- Updated dependencies [3d476d8]
- Updated dependencies [4916272]
- Updated dependencies [4916272]
- Updated dependencies [d66e6e4]
- Updated dependencies [95d4dc0]
- Updated dependencies [9496bb6]
- Updated dependencies [58298fa]
- Updated dependencies [71c3f85]
- Updated dependencies [7e954c5]
- Updated dependencies [8cd600b]
- Updated dependencies [57c0cf0]
- Updated dependencies [f58d2be]
- Updated dependencies [216d193]
- Updated dependencies [1691dec]
- Updated dependencies [e20a471]
- Updated dependencies [b62d643]
- Updated dependencies [36b51a0]
- Updated dependencies [425f994]
- Updated dependencies [ce1f1a7]
- Updated dependencies [e0e1f22]
- Updated dependencies [0cbbb94]
- Updated dependencies [8562ebe]
- Updated dependencies [6d1a52e]
- Updated dependencies [ca3a89a]
- Updated dependencies [5461e84]
- Updated dependencies [5c64825]
- Updated dependencies [8941d77]
- Updated dependencies [f611d11]
- Updated dependencies [e6959cc]
- Updated dependencies [59485d4]
- Updated dependencies [c65c8dd]
- Updated dependencies [141697f]
- Updated dependencies [28404b3]
- Updated dependencies [b4e8f97]
- Updated dependencies [d66e90e]
- Updated dependencies [d66e90e]
- Updated dependencies [fb9e364]
- Updated dependencies [8ea61a3]
- Updated dependencies [3fd5c6f]
- Updated dependencies [16900c1]
- Updated dependencies [98243b2]
- Updated dependencies [184acd6]
  - @weasel-js/core@1.19.1
  - @weasel-js/diagram@1.19.1
  - @weasel-js/geom@1.19.1
  - @weasel-js/paint@1.19.1
  - @weasel-js/pdf@1.19.1
  - @weasel-js/registry@1.19.1
  - @weasel-js/svg@1.19.1
  - @weasel-js/plot@1.19.1

## 1.19.0

### Patch Changes

- 0896b71: `addPage` and `addTemplatePage` place a page whose `index` lies past either end of the page order at that end, as `movePage` does. A negative `index` no longer counts from the end, so `index: -1` puts the page first.
  
  <!-- entry: fix -->
- 65ee9a0: Layouts, bounds, legends and reports over hundreds of thousands of items no longer overflow the call stack. This covers, for example, a grid of a million nodes, a million pages, a polyline of a million points and a store of a million prefs records.
  
  <!-- entry: fix -->
- 7177e12: The Diagram JSON reader refuses a document with a page that is not an object, or whose `kind` it does not know, with an error saying so.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: `detect` recognizes a Graphviz DOT graph whose quoted name holds `//` or `/*`.
  
  <!-- entry: rank=-5 fix -->
- d0312ad: Graphviz DOT keeps a label whose last line is empty.
  
  <!-- entry: fix -->
- b1309b2: The DOT and Mermaid writers write the nodes of containers that hold each other in a loop, with a warning, rather than dropping them.
  
  <!-- entry: fix -->
- 70e7248: The DOT reader refuses subgraphs nested more than 1000 deep with an error naming the line, rather than running out of stack.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: Graphviz DOT quotes an id holding a no-break space or another non-ASCII space, so the file it writes reads back.
  
  <!-- entry: fix -->
- 994f653: Draw-style XML gives every edge its own cell id, numbering a repeat on (`edge:a->b-2`), so an end label reads back on the right edge.
  
  <!-- entry: fix data -->
- 6255268: A draw.io cell with a negative `width` or `height` reads as the box draw.io renders, reaching back from `x` and `y` with a positive size. An edge label cell, placed along its edge by relative geometry, keeps its place as written.
  
  <!-- entry: fix data -->
- b1309b2: A Mermaid architecture diagram's titles are escaped rather than written as markup, so a `<br>` in one no longer breaks the line.
  
  <!-- entry: fix -->
- b1309b2: A Mermaid block's quoted text may hold the other closer of its brackets, as in `[/"/]"\]`, and its shape is taken from the nearest closer.
  
  <!-- entry: rank=-5 fix -->
- 4ea54d9: Mermaid C4 and kanban text reads back as written: quotes, brackets and character references such as `#lt;` survive the round trip.
  
  <!-- entry: fix -->
- b1309b2: A Mermaid composite state's title has its entities read back.
  
  <!-- entry: rank=-5 fix -->
- e4a0526: Mermaid text keeps an `&` written before a character spelled as an entity, such as `&&lt;`, `&#`, or `&(` in a mind map.
  
  <!-- entry: fix -->
- 9275034: A Mermaid gantt reads back as written, `#` and numbered references included. A task named `title …`, `section …` or `%%…` stays a task.
  
  <!-- entry: fix -->
- b1309b2: A Mermaid journey step named `%%…`, `title …`, `section …` or nothing is written as a readable step, with a warning.
  
  A leading `%%` is dropped, a step named for a statement is dropped, and a step with no name is written as `(untitled)`.
  
  <!-- entry: fix -->
- 8e6efee: A Mermaid flowchart keyword line (`subgraph`, `click`, `style`, …) ends at a `;` outside quotes only, so a quoted title holding `#quot;` reads back.
  
  <!-- entry: rank=-5 fix -->
- 9275034: Mermaid writes text holding a line break so that its readers read it back.
  
  A quoted string spells a line break `#10;`, so a class diagram's labels and a chart's quoted names keep it, and a class diagram spells a `#` as `#35;` and reads entities in its edge labels. A title or name a kind holds on one line (quadrant, packet, pie, radar, journey, gitGraph, requirement, ER rows, architecture titles) is written with each break as a space, with a warning. A flowchart's or architecture group's title that opens or ends with a line break reads back without a stray space.
  
  <!-- entry: fix data -->
- 61bc677: Mermaid readers read a line or paragraph separator (U+2028, U+2029) inside a statement as text instead of throwing or cutting a title at it.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: A Mermaid mind map is written so it reads back as the same tree.
  
  Node lines are trimmed as the reader trims them; text that is blank, starts with `%%` or `:::`, or looks like an accessible title is quoted; brackets are spelled as entities; and an id that is not a plain name is renamed, as the flowchart renames one.
  
  <!-- entry: fix -->
- c2900c8: A Mermaid pie, sankey, xychart, radar or quadrant number too large to hold, such as `1e400`, is refused naming its line.
  
  <!-- entry: rank=-5 fix -->
- 3cc5717: A Mermaid quadrant point whose quoted name holds `:[` reads back, as does a radar curve after one whose label holds a brace.
  
  <!-- entry: rank=-5 fix -->
- 3da3293: Mermaid detection and reading no longer throw on text whose first statement starts with `;`. Detection says it is not Mermaid, and reading reports the line.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: A Mermaid sequence diagram keeps an `&` before a `#` or `;` that the writer spells as an entity, and a title opening with `:`.
  
  <!-- entry: rank=-5 fix -->
- 81d5dc0: A Mermaid sequence message, note, `activate`, `deactivate` or `destroy` naming a participant id with a space is refused naming its line.
  
  <!-- entry: rank=-5 fix -->
- e358cf8: A Mermaid sequence participant whose id is not a plain name, or is `title`, is renamed and keeps its text as the label.
  
  A blank participant label is dropped with a warning instead of writing `A as`.
  
  <!-- entry: fix -->
- 2369dd8: A Mermaid sequence line ending in a character reference such as `#quot;` keeps it, so a message ending in `"`, `<`, `>` or `#` reads back as written.
  
  <!-- entry: rank=-5 fix -->
- a74805f: A Mermaid timeline reads back as written, `#` and numbered references included. A period named `title …`, `section …` or `%%…` stays a period.
  
  A period with no label is written as `(untitled)`, with a warning, keeping it and its events.
  
  <!-- entry: fix -->
- 1f49e32: A Mermaid block's `columns` or span, a gitGraph branch's `order`, or a packet field's bits too long to hold is refused naming its line.
  
  <!-- entry: rank=-5 fix -->
- e4a0526: Mermaid's ER, class and state writers drop, with a warning, a row, member or line their readers would refuse.
  
  That is an ER row that is not a type and a name, a class member that is blank or a lone `}`, and a blank line past a state's name.
  
  <!-- entry: fix -->
- Updated dependencies [0896b71]
- Updated dependencies [bbfb059]
- Updated dependencies [65ee9a0]
- Updated dependencies [6ff27f5]
- Updated dependencies [b5303e3]
- Updated dependencies [b1309b2]
- Updated dependencies [b5303e3]
- Updated dependencies [b5303e3]
- Updated dependencies [4977d31]
- Updated dependencies [01eac83]
- Updated dependencies [b1309b2]
- Updated dependencies [b1309b2]
- Updated dependencies [b1309b2]
- Updated dependencies [5e38ac7]
- Updated dependencies [814ff67]
- Updated dependencies [93d0c9d]
- Updated dependencies [b1309b2]
- Updated dependencies [9263a07]
- Updated dependencies [6d1672c]
- Updated dependencies [b123a8b]
- Updated dependencies [7a7c2ef]
- Updated dependencies [f4d1040]
- Updated dependencies [48ef8f7]
- Updated dependencies [8ccd5eb]
- Updated dependencies [69f482f]
- Updated dependencies [2cc9303]
- Updated dependencies [b1309b2]
- Updated dependencies [ca65cf7]
- Updated dependencies [9ec70fe]
- Updated dependencies [056d901]
- Updated dependencies [471752d]
- Updated dependencies [3feac74]
- Updated dependencies [b8ea958]
- Updated dependencies [b8ea958]
- Updated dependencies [a98d4ee]
- Updated dependencies [a74983a]
- Updated dependencies [a43fd34]
- Updated dependencies [14398f2]
- Updated dependencies [39c0d34]
- Updated dependencies [63edf95]
- Updated dependencies [7620d78]
- Updated dependencies [5f06b1f]
- Updated dependencies [b8ea958]
- Updated dependencies [1fc9a81]
- Updated dependencies [e913291]
- Updated dependencies [44999ca]
- Updated dependencies [337b676]
- Updated dependencies [c2465cd]
- Updated dependencies [458e1c2]
- Updated dependencies [dd13518]
- Updated dependencies [b62813d]
- Updated dependencies [f68d93b]
- Updated dependencies [6321d2a]
- Updated dependencies [b1309b2]
- Updated dependencies [faaeb54]
- Updated dependencies [1ba5d83]
- Updated dependencies [048b375]
- Updated dependencies [1ba5d83]
- Updated dependencies [ee3cfe4]
- Updated dependencies [1ba5d83]
- Updated dependencies [54f3c97]
- Updated dependencies [f39af93]
- Updated dependencies [1ba5d83]
- Updated dependencies [b368c65]
- Updated dependencies [0e8df4d]
- Updated dependencies [adc2756]
- Updated dependencies [4be628a]
- Updated dependencies [ca94f2d]
- Updated dependencies [8ac5c6f]
- Updated dependencies [5f0d749]
- Updated dependencies [e6d57fe]
- Updated dependencies [e0a3d33]
- Updated dependencies [7a29e1b]
- Updated dependencies [5ea8837]
- Updated dependencies [a97da18]
- Updated dependencies [b1309b2]
- Updated dependencies [c75559c]
- Updated dependencies [dcbcc5d]
- Updated dependencies [e5cbd2e]
- Updated dependencies [a6fb3c0]
- Updated dependencies [a6ffc20]
- Updated dependencies [3137efc]
- Updated dependencies [b1309b2]
- Updated dependencies [b1309b2]
- Updated dependencies [f77795f]
- Updated dependencies [9723ed2]
- Updated dependencies [cc185ab]
- Updated dependencies [d69b413]
- Updated dependencies [6ead2a8]
- Updated dependencies [46dfb3e]
- Updated dependencies [b1309b2]
- Updated dependencies [3137efc]
- Updated dependencies [dcd3f2c]
- Updated dependencies [cfd1fc7]
- Updated dependencies [b1309b2]
- Updated dependencies [3137efc]
- Updated dependencies [dcf2a76]
- Updated dependencies [36504c7]
- Updated dependencies [fef31b7]
- Updated dependencies [2bde466]
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
- Updated dependencies [f137f48]
- Updated dependencies [f0c159d]
- Updated dependencies [caffe33]
- Updated dependencies [18122f9]
- Updated dependencies [4bbda04]
- Updated dependencies [7b9e651]
- Updated dependencies [efac12a]
- Updated dependencies [ebab03f]
- Updated dependencies [92adc08]
- Updated dependencies [0a82772]
- Updated dependencies [acba0d3]
- Updated dependencies [436e3d2]
- Updated dependencies [caffe33]
- Updated dependencies [025711f]
- Updated dependencies [65ae35d]
- Updated dependencies [741b33c]
- Updated dependencies [5f50ea6]
- Updated dependencies [37e387f]
- Updated dependencies [741b33c]
- Updated dependencies [3a1b492]
- Updated dependencies [4606941]
- Updated dependencies [aa46f79]
- Updated dependencies [43755f1]
- Updated dependencies [cfc03c6]
- Updated dependencies [57e12cb]
- Updated dependencies [741b33c]
- Updated dependencies [12f254e]
- Updated dependencies [0866208]
- Updated dependencies [96bbb4a]
- Updated dependencies [3643214]
- Updated dependencies [b8ea958]
- Updated dependencies [b80eae4]
- Updated dependencies [b1309b2]
- Updated dependencies [73fd11f]
- Updated dependencies [30c0e8e]
- Updated dependencies [038a0da]
- Updated dependencies [38223ed]
- Updated dependencies [0a6a876]
- Updated dependencies [faaeb54]
  - @weasel-js/core@1.19.0
  - @weasel-js/diagram@1.19.0
  - @weasel-js/plot@1.19.0
  - @weasel-js/svg@1.19.0
  - @weasel-js/paint@1.19.0
  - @weasel-js/pdf@1.19.0
  - @weasel-js/registry@1.19.0

## 1.18.2

### Patch Changes

- fc38c90: Fixes to pattern tiles, text bounds, markdown layout and pasted tables, and the image cache closes the bitmaps it drops.
  
  - A `chunks` tile whose `chunkSize` is zero, negative or NaN, or whose `density` is infinite, scatters no chunks. Before, a zero size looped forever building the tile and hung the page, and a negative one threw from the canvas. A `dots` tile with a negative or NaN `radius` draws no dot rather than throwing.
  - A text command's painted bounds reach each glyph's pen step as well as its advance, so a retained group no longer cuts off the end of an underline, strikethrough or overline that letter spacing carries past the last letter.
  - `layoutMarkdown` measures its width without spreading every line into one call, which overflowed the stack on a text of a million lines or so.
  - A pasted table row keeps a tab for each empty cell before a cell with text, so `a`, an empty cell and `b` paste as `a\t\tb` rather than `a\tb`.
  - The image cache owns its bitmaps and closes each one it drops: evicted to fit its budget, released with `releaseImage`, replaced by a sharper SVG raster, or landing for a load already released. Before, it dropped them without closing them, leaving their memory until garbage collection. **A bitmap taken from the cache with `getImageBitmap` is valid only until the cache drops it**, so read it again each frame rather than keep it. A draw command still holding a closed bitmap draws nothing. Work that holds draw commands across an `await` can call the new `holdImageBitmaps()` (from `@weasel-js/renderer` and `@weasel-js/core`), which keeps what the cache drops open until the hold is released; `writePdf`, `exportPagesPdf` and `sceneToLbx` hold one themselves. A `bitmapSrc` bitmap is still its maker's and is never closed.
- 3d522ea: Fixes for hangs and crashes far from the origin, at a zero gap, and on Mermaid ids given twice.
  
  - A gantt task counted in days or weeks from a start past what a `Date` holds (a huge `x` or `X` date) is no longer walked day by day, which never ended.
  - `rulerTicks` lays out no ticks once the view is panned so far that ticks a step apart are one number, where the tick loop never ended.
  - `linesIn` lists no lines of a pitch that far out, where it grew an array until it threw, so a grid layer drawn there draws none.
  - `snapPoint`'s grid pattern counts its points from 0, so a dragged pose too far out for grid indices to count offers points instead of hanging.
  - A tiled parallax layer panned that far draws no copies, where its copy loop never ended.
  - The avoid router checks an item or query so far out that its cell indices stop counting by its box, where the spatial hash's cell walk never ended.
  - The avoid router files an obstacle in its visibility graph only over the search window and its points, in at most 4096 strips. An obstacle running to infinity, or spanning a vast window, ran out of memory, and a box with a NaN side left every other obstacle out of the graph.
  - `layered` with a `nodeGap` of 0 places nodes joined by a long edge at finite positions; every node landed at NaN.
  - A Mermaid architecture diagram naming a service, junction or group twice is refused, naming the line, as Mermaid refuses it. Before, it read into a page that could not be drawn or written.
  - A Mermaid mind map node repeating another's id reads with a unique one (`a_2`), as Mermaid draws both. Before, the page could not be drawn or written.
- Updated dependencies [8048831]
- Updated dependencies [e4b64b6]
- Updated dependencies [895ed9b]
- Updated dependencies [0c77d00]
- Updated dependencies [ea6c53b]
- Updated dependencies [fc38c90]
- Updated dependencies [389a7f9]
- Updated dependencies [7457319]
- Updated dependencies [0e5661d]
- Updated dependencies [3d522ea]
- Updated dependencies [707636a]
- Updated dependencies [30dd2dc]
- Updated dependencies [b188aea]
- Updated dependencies [d16f1ca]
- Updated dependencies [cd61bfa]
- Updated dependencies [d373a31]
- Updated dependencies [07205dd]
- Updated dependencies [5d2451b]
- Updated dependencies [800c96b]
- Updated dependencies [8d97dd3]
  - @weasel-js/core@1.18.2
  - @weasel-js/diagram@1.18.2
  - @weasel-js/plot@1.18.2
  - @weasel-js/pdf@1.18.2
  - @weasel-js/svg@1.18.2
  - @weasel-js/paint@1.18.2
  - @weasel-js/registry@1.18.2

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
- 791ba1c: Fix xychart category bands, bar and radar drag handles, timeline period moves, sankey value edits, quadrant class order, and PlotView's prop handling.
  
  - An xychart with fewer categories than values now draws the extra rows, numbered as the data table shows them, and a category label written twice gets two bands instead of stacking both rows' bars on one.
  - An xychart bar's drag handle sits on its value end when the bar runs down from the baseline: a value below a value axis that starts above zero, or any bar on a reversed axis.
  - `moveTimelinePeriod` keeps sections that had no periods before the move; it used to drop them.
  - A radar with no `max` can have a point dragged past the rim, so its largest value can grow. Before, the drag stopped at the rim. `polarScale`'s `valueAt` and `radarValueAt` take a new optional `open` argument that reads past the rim.
  - `PlotView` no longer calls `onChange` when the chart is redrawn from a new `data` prop, redraws when the `measure` prop changes, and goes back to the default theme when the `theme` prop is removed.
  - Editing a sankey link's value label and leaving it unchanged no longer rewrites the value. Before, the stored value was replaced by the rounded number the label shows (`0.30000000000000004` became `0.3`).
  - A quadrant chart keeps its classes in order when a class name is all digits; before, such a class jumped to the front when classes were moved, renamed, or read from Mermaid. `QuadrantData` gains an optional `classOrder`, set only when the keys of `classes` would lose the order, and `quadrantClassEntries` and `quadrantClassesOf` read and build the pair. Nothing breaks for consumers: `classes` keeps its type, and data without `classOrder` reads as before. Code that walks `classes` directly should use `quadrantClassEntries` to get the order right.
- Updated dependencies [7a33153]
- Updated dependencies [dd5b82a]
- Updated dependencies [791ba1c]
- Updated dependencies [f2a1845]
- Updated dependencies [7537af5]
- Updated dependencies [f4d2261]
- Updated dependencies [112f6bb]
- Updated dependencies [860ab3b]
  - @weasel-js/core@1.18.1
  - @weasel-js/pdf@1.18.1
  - @weasel-js/svg@1.18.1
  - @weasel-js/plot@1.18.1
  - @weasel-js/diagram@1.18.1
  - @weasel-js/paint@1.18.1
  - @weasel-js/registry@1.18.1

## 1.18.0

### Patch Changes

- 7d409c8: Fix chart scales and Mermaid readers on edge cases
  
  - `spacedTicks` returns no ticks, rather than looping until the array overflows, where the step multiples are past counting (a domain like 1e17..1e17+100), as `ticks()` already did.
  - A time scale spanning decades ticks on 1, 2 or 5 times a power of ten years, so a 40-year span asked for 5 ticks gets 4 rather than 41.
  - A gantt date in years 0 to 99 reads as itself rather than as 1900 to 1999, and `%j` counts its day of the year from its own January.
  - A Mermaid `accDescr { … }` block closed on the line it opens on no longer swallows the statements after it.
  - A Mermaid flowchart reads an `accDescr { … }` block running over several lines instead of throwing.
  - A Mermaid xychart or sequence diagram reads past a `%%{…}%%` directive running over several lines instead of throwing.
  - A quoted front matter title reads the same in a Mermaid sequence diagram and xychart as in every other kind: escapes in double quotes read, `''` in single quotes as one quote.
  - A Mermaid packet diagram writes a gap between fields as an unlabeled field, which Mermaid reads, instead of a field Mermaid rejects for not starting where the one before ends; an unlabeled field reads back as a gap.
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
- ef454d2: Fix diagram placement in paged scenes and diagram-formats ids
  
  - A label added by double-clicking an edge goes on the edge's page in a paged scene, as a connect places the edge, instead of at the top of the tree outside the page run.
  - A sequence started by the Participant tool goes on the page under the click in a paged scene, instead of outside the page run.
  - `documentFromScene` sizes the one page of a scene with no pages around its shapes. Connectors, stored as an empty box at the origin, no longer stretch the page back to (0, 0).
  - A DOT cluster whose short name and full name are both node ids gets a container id no node holds.
  - New `edgeLabelIdOf` and an exported `groupLabelIdOf` name the label node of an edge and of a group, which several places spelled out by hand.
- Updated dependencies [4161bcd]
- Updated dependencies [7d409c8]
- Updated dependencies [fe6a382]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [c148384]
- Updated dependencies [d370754]
- Updated dependencies [e405e70]
- Updated dependencies [c02f028]
- Updated dependencies [0f72734]
- Updated dependencies [f148cf9]
- Updated dependencies [082fa2f]
- Updated dependencies [324322e]
- Updated dependencies [b93c1dd]
- Updated dependencies [12c538a]
- Updated dependencies [d83476e]
- Updated dependencies [14aa7a8]
- Updated dependencies [b53a3ef]
- Updated dependencies [67d207f]
- Updated dependencies [bdf1a62]
- Updated dependencies [b616cad]
- Updated dependencies [ef454d2]
- Updated dependencies [27d8adb]
- Updated dependencies [02eb957]
- Updated dependencies [5dbf225]
- Updated dependencies [1e0adbb]
- Updated dependencies [2455bb4]
- Updated dependencies [e3ce292]
- Updated dependencies [a1f2242]
  - @weasel-js/core@1.18.0
  - @weasel-js/diagram@1.18.0
  - @weasel-js/plot@1.18.0
  - @weasel-js/paint@1.18.0
  - @weasel-js/svg@1.18.0
  - @weasel-js/pdf@1.18.0
  - @weasel-js/registry@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [f9e1b14]
- Updated dependencies [49cd9bb]
- Updated dependencies [778f26d]
- Updated dependencies [56446ad]
  - @weasel-js/core@1.17.3
  - @weasel-js/diagram@1.17.3
  - @weasel-js/plot@1.17.3
  - @weasel-js/svg@1.17.3
  - @weasel-js/pdf@1.17.3
  - @weasel-js/paint@1.17.3
  - @weasel-js/registry@1.17.3

## 1.17.2

### Patch Changes

- 3082310: Writing DOT, an unlabeled container nested in a labeled one now sets an empty label, and a lane (or any region without a fill) inside a filled one sets an empty style. Graphviz carries a cluster's attributes into the clusters inside it, so such a container used to draw, and read back with, its parent's label, and a lane its pool's fill.
- 474ffd5: Writing DOT, a node or edge whose dash is the one a `dotted` style reads as is written `dotted` rather than `dashed`, so a dotted DOT graph read and written again stays dotted.
- 1e99c04: Reading a DOT graph whose every node has a `pos` but which gives no `bb`, the page now spans the nodes' own extent. It used to start at DOT's origin, so a node left of or below it was placed off the page. A `pos` or `bb` holding a value that is not a finite number is now treated as missing rather than read as an infinite place.
- ebe7018: Reading DOT, a color from a palette scheme such as Brewer's (`/blues9/3`) is dropped with a warning. The reader used to strip the scheme and keep the bare index, so such a node read back with a color of `3`, which nothing can draw. X11 and SVG scheme colors (`/x11/red`, `/svg/navy`) are read as their names, as before. `dotColor` now returns `undefined` for a color it cannot read.
- 24f7a13: Draw-style XML keeps a graph page's `direction`, the way layout runs when the page is laid out again. It is written as a `weaselDirection` attribute on the page's graph model, which a draw app ignores, and read back from it. A value that is not a direction is dropped with a warning. DOT and Mermaid already carried the direction; draw-style XML used to lose it.
- 66f7dfc: Mermaid flowcharts read and write edge ids (`A e1@--> B`), the syntax Mermaid 11 added. Reading one used to throw. The id becomes the edge's id. A link joining several nodes (`A & B e1@--> C`) gives it to its first edge only. An `e1@{ … }` line naming an edge is dropped with a warning rather than read as a node. Writing, an edge's id is written only where reading the file back would not give the edge that id anyway and where Mermaid can hold the id as it is, so `a --> b` with id `a-b` stays as it was. A graph page's reader now keeps an edge id it was given, if no other item holds it, instead of always minting `from-to`.
- 2521475: Writing a Mermaid flowchart, a dashed edge whose dash is not the one a dotted link draws gets a `stroke-dasharray` in its `linkStyle`, as a node's dash already did, so it reads back with its own dash rather than the dotted link's.
- d698e12: Reading a Mermaid flowchart, a link's quoted inline text may hold an arrow, as in `A -- "a --> b" --> B`. The arrow inside the quotes used to end the text there, and the reader then threw on the closing quote.
- cbe9510: Writing a Mermaid flowchart, block, kanban, or architecture diagram keeps an id in letters of any script, such as `café` or `日本`, as it is: those kinds read such ids, but the writer used to rename them to an ASCII spelling (`caf`, `_`). `mermaidIds` takes a `unicode` option saying the kind reads them; the kinds whose readers take only ASCII ids still rename them.
- d9930cf: Every graph format's reader now makes one check of each color a file names: a color paint's `parseColor` cannot read is dropped, and the reader lists it in one warning, "<format> colors a diagram cannot draw were dropped: …". The DOT, Mermaid (flowchart styles and link styles, every kind's `classDef`s and `style`s, C4 element and relationship styles, sequence boxes and rects) and draw-style XML readers used to keep such a string as the color, which nothing could draw. Effects:
  
  - DOT X11 names CSS has no spelling for, such as `grey50`, are now dropped with that warning. No X11 table exists to map them.
  - DOT `none` reads as `transparent`, as draw-style XML's does.
  - The DOT warning for palette-scheme colors becomes the shared one.
  
  The Mermaid sequence reader's own list of CSS color names is gone. It asks the same check whether a box's first word is a color.
- Updated dependencies [d15e917]
- Updated dependencies [32e0dd5]
- Updated dependencies [86783f4]
- Updated dependencies [3dfa153]
- Updated dependencies [36a16c0]
- Updated dependencies [2e4ad49]
- Updated dependencies [883dfcd]
- Updated dependencies [54dc458]
- Updated dependencies [cda0a20]
- Updated dependencies [d2800fb]
- Updated dependencies [2c9b792]
- Updated dependencies [d162fbb]
- Updated dependencies [f15f881]
- Updated dependencies [35c291a]
- Updated dependencies [019b877]
- Updated dependencies [47679f8]
- Updated dependencies [e13e539]
- Updated dependencies [1a6ad20]
- Updated dependencies [90600b4]
- Updated dependencies [436c47d]
- Updated dependencies [2121adb]
- Updated dependencies [b81f560]
- Updated dependencies [060b0ee]
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [c5325ff]
- Updated dependencies [08a964d]
- Updated dependencies [fb36b4f]
- Updated dependencies [cb57c41]
- Updated dependencies [2e36630]
- Updated dependencies [10f448b]
- Updated dependencies [e0a37af]
- Updated dependencies [03f87f4]
- Updated dependencies [2af51ff]
  - @weasel-js/core@1.17.2
  - @weasel-js/paint@1.17.2
  - @weasel-js/plot@1.17.2
  - @weasel-js/diagram@1.17.2
  - @weasel-js/pdf@1.17.2
  - @weasel-js/svg@1.17.2
  - @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [f45b9b5]
- Updated dependencies [629d02b]
  - @weasel-js/core@1.17.1
  - @weasel-js/diagram@1.17.1
  - @weasel-js/plot@1.17.1
  - @weasel-js/svg@1.17.1
  - @weasel-js/paint@1.17.1
  - @weasel-js/pdf@1.17.1
  - @weasel-js/registry@1.17.1

## 1.17.0

### Patch Changes

- 20aef2e: A body takes a `header` row, `{ kind: 'header', text, style?, id?, pad?, aside? }`, only as its first row. It is a band across the top of the node, flush with its bounds rather than inset by the outline or the padding, as tall as its text's line plus `pad` (default `HEADER_PAD`) above and below, with its text set left at the body's padding; the other rows lay out below it as before. Its text is centered on the face's caps, midway between baseline and cap height, where the measure reports the face's metrics, and on its line box where it does not. The band is filled in the node's stroke and clipped to its outline, so a `roundRect` keeps its rounded corners, and its text is drawn in the node's fill. `NodeStyle` takes `header` and `headerText` to color the two otherwise. A node's minimum width covers the header's text and its padding.
  
  A header's `aside` is a second text in the band, set right at the body's padding from the right edge in the title's face, on the title's line, in the title's color at `HEADER_ASIDE_OPACITY` (0.7). The band's minimum width then covers title, `HEADER_ASIDE_GAP` (8), aside and the padding on both sides, and the title's box stops that gap short of the aside's. Its text node carries `bodyAside: true` beside its title's `bodyRow`. A theme recolors it with the title, and laying the body out again (`relayoutBodies`, a resize) moves it with the band. `diagram-formats` reads a header row back from a scene as a header, with its `aside` and `pad`.
  
  `MeasureRowText` may return `capCenter`, how far below the top of a line box the caps' middle falls. `rendererMeasure` and `diagramScene`'s own estimate read it from the registered face's metrics, and `canvasMeasure` from the context's font and glyph bounds.
  
  `DataNode` takes `collapsed`: a node whose first row is a header is built as that row alone, sized to its band and as wide as it would be open. One with no header is drawn whole.
  
  `DiagramView` takes `onHeaderClick(nodeId)`, called on a click (not a drag) anywhere on a node's header band, its text included, after `onSelect`.
  
  `RowTextStyle` takes `tracking` (extra space after each character, in em) and `weight` (a numeric font weight, over `bold`). Both reach the row's scene text as `letterSpacing` and `fontWeight`, and `canvasMeasure`, `rendererMeasure` and `diagramScene`'s own estimate measure with them.
  
  `roundRectOutline(maxRadius)` makes a rounded-rect outline with its own corner radius, to register under a name of its own: `registerOutline('card', roundRectOutline(5))`. The built-in `roundRect` is `roundRectOutline(10)`.
- 8ba6e02: DOT: an id or page name ending in a backslash, or holding one before a quote, was written so the file no longer parsed; backslashes in quoted names are now written doubled and read back as one. A `width`, `height`, or `penwidth` that is not a number is dropped with a warning instead of reaching the diagram as `NaN`. Edge labels read `\E`, `\T`, and `\H` as the edge, its tail, and its head, and a strict graph's repeated edge statements set their attributes on the one edge it keeps instead of being thrown away.
- b721b11: Reading draw-style XML whose cells name each other as parents in a circle, or a cell naming itself, no longer hangs or overflows the stack: such cells are read as sitting on the page.
- 4af03f6: A numbered character reference past the last code point, such as `&#99999999;`, in a DOT HTML label threw a `RangeError` and failed the whole import; it is now kept as written, as draw-style XML already kept it. Both readers now decode references the one way.
- c802f4f: Writing Mermaid lost text that Mermaid reads as markup: a label holding `&amp;` or `&#65;` came back as `&` or `A`, and one wrapped in backticks came back as a markdown string with the backticks gone. The writer now spells such an `&` as `#38;` and such a leading backtick as `#96;`.
- Updated dependencies [08ebffc]
- Updated dependencies [8e0ac8a]
- Updated dependencies [d28ff77]
- Updated dependencies [217246e]
- Updated dependencies [a161c0b]
- Updated dependencies [34f7531]
- Updated dependencies [bf27898]
- Updated dependencies [533bb6a]
- Updated dependencies [fd16536]
- Updated dependencies [20aef2e]
- Updated dependencies [1d87afe]
- Updated dependencies [1b720a8]
- Updated dependencies [436da9e]
- Updated dependencies [3c517d9]
- Updated dependencies [7e3d359]
- Updated dependencies [c5f7685]
- Updated dependencies [7c26f2b]
- Updated dependencies [ce7e8b5]
- Updated dependencies [d5cc782]
- Updated dependencies [ee9bc7f]
- Updated dependencies [0af766f]
- Updated dependencies [52fd33e]
- Updated dependencies [e989ef7]
- Updated dependencies [e6cf896]
- Updated dependencies [3a4cc62]
- Updated dependencies [2ebc73f]
- Updated dependencies [b606ef9]
- Updated dependencies [8e888a9]
- Updated dependencies [1d6fe9b]
- Updated dependencies [a4b3961]
- Updated dependencies [d29469c]
- Updated dependencies [5f43e16]
- Updated dependencies [71f0ad6]
- Updated dependencies [454e8e1]
- Updated dependencies [e78e03c]
- Updated dependencies [70113d3]
- Updated dependencies [4298e0d]
- Updated dependencies [73b1dc5]
- Updated dependencies [a14eca6]
- Updated dependencies [3ea2786]
- Updated dependencies [953361f]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [59ddef2]
- Updated dependencies [df080bc]
  - @weasel-js/diagram@1.17.0
  - @weasel-js/core@1.17.0
  - @weasel-js/paint@1.17.0
  - @weasel-js/plot@1.17.0
  - @weasel-js/svg@1.17.0
  - @weasel-js/pdf@1.17.0
  - @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- 12caf33: Add `@weasel-js/p-touch`, Brother P-touch labels from a scene. `renderLabel` draws a label at one pixel per
  printer dot over the band the printhead reaches, and `printLabel` dithers it through `@weasel-js/dither` and
  sends it over WebUSB or Web Serial through obwat, split into pages at cut marks. `labelGrid` is the printer's
  dot grid in scene units, for `protectRects`. `sceneToLbx` and `writeLbx` write an `.lbx` file with rects, open
  polylines and plain text boxes as objects P-touch Editor can edit, and the rest drawn and placed as images.
  A `drawOne` can return `lbxObjects([...])` to write a node as an object its paint cannot say, such as a
  barcode.
  
  Core gains `commandRasterizer`, the hook that draws commands a file format cannot express through a
  `RasterSession`. It was `diagram-formats`' private `pageRasterizer`, which `exportPagesPdf` now uses from core.
- Updated dependencies [65d2e7c]
- Updated dependencies [db1eb4e]
- Updated dependencies [944faa2]
- Updated dependencies [6c0b311]
- Updated dependencies [f6f69c8]
- Updated dependencies [8f2e1e1]
- Updated dependencies [12d3c17]
- Updated dependencies [6e3b081]
- Updated dependencies [847875c]
- Updated dependencies [12caf33]
- Updated dependencies [f285e56]
- Updated dependencies [6ecee1a]
  - @weasel-js/core@1.16.2
  - @weasel-js/diagram@1.16.2
  - @weasel-js/svg@1.16.2
  - @weasel-js/plot@1.16.2
  - @weasel-js/pdf@1.16.2
  - @weasel-js/paint@1.16.2
  - @weasel-js/registry@1.16.2

## 1.16.1

### Patch Changes

- 72330bf: Pages are scene nodes. A paged scene has a page run, a root group that lays out its pages in a column or a row, and each page is a group under it that frames and clips what is on it. Content on a page is that page's child, in the page's own coordinates with the origin at its top-left, so a page's content moves with it and dragging onto another page reparents. A scene with a page run is in Pages mode; one without is Continuous. Pages are 2D only.
  
  This is breaking for a consumer that wrote `core:pages` directly, or placed content on pages in world coordinates: the pages are no longer a document value, and a node on a page is positioned relative to it. Stored scenes convert on load: `adoptLegacyPages` turns a `core:pages` value into page nodes and moves each root onto the page holding it, as one untracked batch. `PAGES_DOC_KEY` remains only as the key that conversion reads.
  
  The page edits (`setPages`, `addPage`, `removePage`, `movePage`, `resizePage`, `renamePage`) and readers (`pagesOf`, `placedPagesOf`) keep their names and now work on the nodes. Content placed outside every page goes onto the nearest page unless the page run's `pasteboard` flag is on. A node that follows others (`dependsOn`, such as a connector) goes on the page its ends share, else into the page run. Pages and the run are never selected, deleted, copied or grouped by the scene tools, and the run refuses drops and inserts of anything but followers. A layer lock never locks a page or the run; only its own `locked` flag does. Group and the boolean group made from members on more than one page put the new group on the page the members overlap most. Turning the pasteboard off puts what sits off every page on the pages, in the same undo entry, and `setPages` on a Continuous scene puts what it holds on the new pages.
  
  Page and run nodes hold `data: undefined` whatever the scene's `TData`, so code walking `scene.nodes` and reading `data` must skip page structure (`isPageStructure`). A page's node id is its page id (`Page.id`) unless another node already held that id when the page was made: then the node gets a fresh id and `PageInfo.id` keeps the page id. `pagesOf`, `placedPagesOf`, `pageOfNode` and the page edits all speak page ids; `pageNodeOf` gives the node for one.
  
  - `@weasel-js/core` exports `createPageRun`, `pageRunOf`, `isPaged`, `pageOfNode`, `PAGE_RUN` and `pageRunLayout`, `PAGE_CLIP` and `pageClip`, `adoptLegacyPages`, `placeOnPages` (moves world-space specs onto their pages, measured by `AUTO_POSE_DESCRIPTOR` unless told otherwise), `addOnPages` (adds specs and places them), `pageNodeOf`, `pasteboardOn`, `replaceDoc` (makes a scene's document values a given set, clearing the rest), `followerHome`, `isPageStructure`, `withoutPageStructure`, `contentRoots`, and, from the routing barrel, `insertSite` with `InsertSite` and `InsertSiteOptions`, whose `descriptor` measures the insert against its page. Nodes gain `page` and `pageRun` fields, which save with the scene, and scenes gain `setPage` and `setPageRun`. `LayoutContainer` and `LayoutChild` gain an optional `node`.
  - `@weasel-js/editor`: `usePages` takes `{ paging }` as its last argument, `'continuous'` (the default) or `'single'`, which settles the view fitted to one page through the new `usePageSettle`. `adoptSnapshotPages` converts a snapshot saved with `core:pages`, which `nodeSpecsFromSnapshot` now does; both take a `pages` option, the pages a snapshot with neither page nodes nor `core:pages` gets. `snapshotRebuildsTree` says whether a load rebuilds the tree, so the undo stack saved beside it is stale, and `useSessionPersistence` drops that stack, taking the same `pages` option. `usePageFit`'s `page` may be `null`.
  - `@weasel-js/diagram`: `OffPageEdgeInput` is now `{ id, fromPage, toPage, offPage? }`, each end's page read from its page ancestor, and `OffPageSplitInput` loses `pages`. `OffPageMarkerOptions` loses `geometry` and its type parameter. A stencil drawn on a paged scene lands on the page under it.
  - `@weasel-js/diagram-formats`: `DocumentScene` gains `pages`. `addDocumentScene` replaces a scene's content, pages and document values with a `DocumentScene` in one undo entry, locked content included, keeping the pasteboard setting; a node in it named like a page no longer collides with that page. `addOnPages` is now core's, re-exported here, and takes the scene's own spec type.
- Updated dependencies [25378d9]
- Updated dependencies [071906a]
- Updated dependencies [214d5d5]
- Updated dependencies [9533421]
- Updated dependencies [6b9d157]
- Updated dependencies [603dbc3]
- Updated dependencies [07a8387]
- Updated dependencies [72330bf]
- Updated dependencies [3905b08]
- Updated dependencies [25a1ff7]
- Updated dependencies [6b503a5]
- Updated dependencies
  - @weasel-js/pdf@1.16.1
  - @weasel-js/core@1.16.1
  - @weasel-js/diagram@1.16.1
  - @weasel-js/registry@1.16.1
  - @weasel-js/svg@1.16.1
  - @weasel-js/plot@1.16.1
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
  - @weasel-js/svg@1.16.0
  - @weasel-js/pdf@1.16.0
  - @weasel-js/core@1.16.0
  - @weasel-js/diagram@1.16.0
  - @weasel-js/plot@1.16.0
  - @weasel-js/registry@1.16.0

## 1.15.2

### Patch Changes

- 507f539: paint exports `relativeLuminance` and `luminanceContrast`, the WCAG luminance and ratio `contrastRatio` is built on; core re-exports both. theme's `luminance`/`contrast`, its test helpers, ui's painted-contrast helpers and forge's pixel contrast readout now use them.
  
  Color strings that theme's `withAlpha`/`atAlpha`, ui's `TokenPanel` hex conversion and diagram-formats' DOT and Mermaid writers read are parsed by paint's `parseColor`. The `TokenPanel` color input now converts float and percent `rgb()` channels, named colors and `hsl()` without a browser, and diagram-formats writes percent `rgb()` channels as hex instead of passing them through. diagram-formats now depends on `@weasel-js/paint`.
  
  labkit's loupe and ui's `Timeline` ruler and lane graph measure their element with core's `useElementSize`.
- f1906a8: The rest of the kit's stores notify through registry's `createEmitter`: the entered group, the snap
  outcome, devtools roots and transports, kit settings, the menu host and menu controller, tool
  options, `RunSlots`, the seam preview, the HUD list, the effect runners, the symmetry controller,
  the devtools client, and forge's loupe and CSS-variable stores. A listener that throws is logged
  and no longer stops the others, and a listener unsubscribed mid-notify is no longer called; the
  menu host, `RunSlots` and the HUD list used to walk their live set. diagram, diagram-formats, menu,
  symmetry and devtools now depend on `@weasel-js/registry`.
  
  Structural comparisons that went through `JSON.stringify` use `deepEqual` instead, so key order no
  longer makes two equal values differ (theme baking, diagram export's style diffs, trial marks, path
  constraints, unit rows, toolbar dock drops). PrefSchemaEditor's three-way merge keeps
  `JSON.stringify`, because there a reordered key is an edit.
  
  New: `sameList(a, b, same?)` in `@weasel-js/registry`, whether two lists hold equal elements in
  order. `@weasel-js/react`'s `sameList` is now this function, and ui's `samePath` is an alias of it.
- Updated dependencies [946faff]
- Updated dependencies [507f539]
- Updated dependencies [a4138b6]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [6544399]
- Updated dependencies [2f6b10d]
- Updated dependencies [5f6111b]
  - @weasel-js/core@1.15.2
  - @weasel-js/paint@1.15.2
  - @weasel-js/diagram@1.15.2
  - @weasel-js/registry@1.15.2
  - @weasel-js/plot@1.15.2
  - @weasel-js/svg@1.15.2
  - @weasel-js/pdf@1.15.2

## 1.15.1

### Patch Changes

- 9862244: A `DiagramType` names the `notations` its graph pages are written in: UML class `class`, ERD `er`, mind map
  `mindmap`, flowchart `FLOWCHART_NOTATION`. `diagramNotationOf` gives the one a scene's type writes, and
  `diagramTypeOfNotation` the type a notation opens as. `documentFromScene` gives a graph page with no notation of its
  own the one its scene's type writes, so a chart drawn as a UML class diagram exports as a Mermaid `classDiagram`;
  `documentSpecs` emits `diagram:type` when every graph page's notation names one type, so an imported class diagram
  opens with the UML stencils. A page whose notation is `FLOWCHART_NOTATION` writes as a flowchart in a chart of
  another type. This adds API.
- 8ad43af: A core `Page` can carry `meta`: values other packages keep on the page, each under its owner's key. Every page edit
  (`addPage`, `removePage`, `movePage`, `resizePage`, `renamePage`, `setPages`) and `layoutPages` carry it, and undo
  restores it with the page.
  
  `documentSpecs` writes a graph page's `notation`, `layout`, and `direction` to its page's `meta['diagram:graph']`, and
  `documentFromScene` reads them back, so a Mermaid class, state, C4, block, or other non-flowchart page drawn into a
  scene exports as the same kind, a block diagram keeps its columns, spans, and spaces, and a flowchart keeps its
  direction. `GRAPH_PAGE_META_KEY`, `graphPageSettingsOf`, and `GraphPageSettings` are exported. This adds API.
- f6e0f7a: `DIAGRAM_MERMAID` reads and writes four more graph kinds, each into a page whose `notation` names it:
  
  - `block-beta` (`'block'`): blocks in the flowchart's shapes, nested `block … end` groups as containers, and
    `columns`, spans, and `space`s as the options of the page's new `grid` layout, which the writer reads back.
  - `architecture-beta` (`'architecture'`): services in their built-in icon's outline (`cloud`, `cylinder`, `disk`,
    `globe`, `server`), junctions as dots, groups as containers, sides as compass ports, and `{group}` ends on the
    group's box.
  - `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, and `C4Deployment` (`'c4-context'` and so on): elements as
    boxes in their kind's outline and theme role, a first `<<kind>>` row naming the kind so it writes back, boundaries
    and deployment nodes as containers, and relationships labeled with their technology, their direction as ports.
  - `kanban` (`'kanban'`): one pool of column lanes along `x`, each card a node in its lane, its metadata as `field`
    rows.
  
  A graph page's `layout` can now name `grid`, with its `grid` option.
- 24e218c: `DIAGRAM_MERMAID` reads and writes Mermaid class diagrams, state diagrams (`stateDiagram-v2` and `stateDiagram`), ER
  diagrams, mind maps, and requirement diagrams as well as flowcharts. Reading sets the graph page's `notation` to the
  kind (`'class'`, `'state'`, `'er'`, `'mindmap'`, `'requirement'`); writing picks the kind from it, a flowchart when it
  is unset. Other Mermaid kinds are still refused with an error naming the kind.
  
  A graph page can name the `layout` it is laid out with on import, any of `LAYOUTS` (a mind map reads as `radial`).
  `documentFromScene` reads an edge's `endLabels` and a body's `field` rows back; draw-XML writes and reads end labels as
  label cells at either end and maps the `start`, `end`, and `bar` outlines to draw.io's UML state shapes, and DOT writes
  and reads them as `taillabel` and `headlabel`. This adds API.
- 69f0788: `DIAGRAM_MERMAID` reads and writes `gantt`, `timeline`, `pie`, `quadrantChart`, `journey`, `gitGraph`, `sankey-beta`,
  `packet-beta` and `radar-beta` diagrams, each as one plot page holding that kind of chart; writing a plot page picks
  the Mermaid kind from its chart's kind. Each reader names the line of an error and warns of what it drops. This adds
  API.
- a5e5db3: New diagram types State, Requirement, C4, Block, Architecture, and Kanban, with stencil groups `STATE_GROUP`,
  `REQUIREMENT_GROUP`, `C4_GROUP`, `ARCHITECTURE_GROUP`, and `KANBAN_GROUP` whose shapes write as their Mermaid
  constructs: a state's start, end, choice, fork, note, and composite and concurrent states; requirements and elements;
  C4 people, systems, containers, components, stores, queues, and boundaries; architecture services by Mermaid's built-in
  icons, junctions, and groups; a kanban board and its cards. Block diagrams draw with the flowchart's shapes on a grid.
  A `DiagramStencil` can name a `themeRole`, kept on its trait and resolved by `StencilInsertOptions.theme`; a
  `ContainerStencil` can name its `title` and its first `lanes`; `DiagramTypeEdge` takes a `dash`. A stencil's field
  rows now carry `bodyField`, so they read back as fields. The Mermaid requirement writer names each block by its name
  row rather than its id. This adds API.
- 996e453: Pages in a `DiagramDocument` now carry a required `kind`, today always `'graph'`, so documents can later hold other kinds of page. `DocumentPage` is a union (`GraphPage` is its graph member, with an optional `notation`), every `DiagramFormat` lists the page `kinds` it holds, and `formatHolds`, `graphPageOf`, and `graphPagesOf` help a writer that holds only graphs. Breaking for code that builds pages by hand: add `kind: 'graph'`. The JSON reader reads a page with no `kind` as a graph.
- a236795: `PAGE_TEMPLATES` holds a new page of every kind a document holds: an empty graph page for each diagram type, in its
  notation; a small sequence diagram; and a small chart of each plot kind. `templateSpecs` draws a template as a new
  one-page document, with the diagram type it names, and `addTemplatePage` adds one as another page of a scene, what it
  draws included, as one undo entry. `pageSpecs` draws any one document page placed as a scene's page list would place
  it. This adds API.
- 999fba9: Every plot kind can be authored from nothing, not only adjusted. Each kind has pure edits that insert, remove, and reorder every collection its spec holds (`insertPieSlice`, `insertXyRow`, `insertXySeries`, `removeGanttTask`, `insertTimelineEvent`, `insertQuadrantClass`, `insertGitCommand`, `insertSankeyLink`, `insertPacketField`, `moveRadarAxis`, …) and set the fields no drag reaches: titles, axes and their ends, chart options, a task's id, tags, start and end, a commit's every field. `moveGanttTaskToSection` moves a gantt task into another section, keeping its id and the dependencies on it. A removed or renamed gantt task id leaves every `after` and `until` that named it; a removed or renamed quadrant class leaves every point that used it.
  
  `plotSchemaOf(data)` describes a spec of any kind as fields and tables of rows, a table holding tables of its own under each row (a gantt's sections hold their tasks), each read and write going through those edits, so a host builds a form or a grid knowing no kind. `plotRootContaining(scene, id)` names the plot a node is the root or a mark of. `setXyValue` now pads a series shorter than the chart's rows instead of throwing.
  
  `@weasel-js/ui` adds `PlotDataPanel`, which renders that schema for one chart: a row per field, a grid per table with add (at the end, or after any row), remove and drag-to-reorder, rows opening onto the tables they hold.
  
  `@weasel-js/plot` now exports `formatGanttStart`, `parseGanttStart`, `formatGanttEnd` and `parseGanttEnd`, which the Mermaid gantt reader and writer use.
- ec4d9f7: `scenePageKinds` tells a plot page apart: a page holding a plot root is a `plot` page, where it read as a graph page
  before, so a menu no longer offers a graph-only format for a chart holding one.
- 2f9995e: Add plot pages. `DocumentPage` gains `PlotPage` (`kind: 'plot'`, `data: PlotData` from `@weasel-js/plot`):
  `documentSpecs` draws one as a plot root filling the page, in the theme's colors (`plotThemeOf`), and
  `documentFromScene` reads a page holding a plot root back as a plot page. The JSON format holds plot pages, and the
  Mermaid format reads and writes `xychart-beta` (`readMermaidXychart`, `writeMermaidXychart`). An SVG page export now
  folds a node's pose through any parent whose pose is a frame, as a plot root's is.
- 479ecc6: Sequence pages. `DocumentPage` gains `SequencePage` (`kind: 'sequence'`, `data: SequenceData`): `documentSpecs` draws
  one as a sequence root, `documentFromScene` reads such a root back as one, and the SVG, PNG, and PDF page exports draw
  it. The JSON and Mermaid formats hold sequence pages; Mermaid reads and writes `sequenceDiagram` — participants and
  their types, every arrow, activations, notes, fragments, boxes, `create` and `destroy`, `autonumber`, and the title.
  `scenePageKinds` and `formatTakes` say which formats can hold a scene without building its document. Breaking for a
  caller that reads `page.data` as a `DiagramData` without checking `page.kind`. Page exports also now place a node's
  children through its frame, where they had drawn them at their stored offset from the page's corner.
- Updated dependencies [d2110bc]
- Updated dependencies [424ba52]
- Updated dependencies [9515681]
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
- Updated dependencies [24e218c]
- Updated dependencies [5070176]
- Updated dependencies [9862244]
- Updated dependencies [8ad43af]
- Updated dependencies [a5e5db3]
- Updated dependencies [937167e]
- Updated dependencies [999fba9]
- Updated dependencies [69f0788]
- Updated dependencies [8c13aee]
- Updated dependencies [728db32]
- Updated dependencies [120420a]
- Updated dependencies [e982d8a]
- Updated dependencies [0e5b3d8]
- Updated dependencies [2560c69]
- Updated dependencies [dd4ab9b]
- Updated dependencies [479ecc6]
- Updated dependencies [238a49c]
  - @weasel-js/pdf@1.15.1
  - @weasel-js/core@1.15.1
  - @weasel-js/diagram@1.15.1
  - @weasel-js/plot@1.15.1
  - @weasel-js/svg@1.15.1

## 1.15.0

### Patch Changes

- Updated dependencies [8461e7b]
- Updated dependencies [70a64a3]
- Updated dependencies [f77e789]
- Updated dependencies [0e60598]
- Updated dependencies [48b6c4c]
- Updated dependencies [a1cb281]
- Updated dependencies [c41c917]
- Updated dependencies [8612dd7]
- Updated dependencies [d25ad30]
- Updated dependencies [1de1aab]
- Updated dependencies [fce0494]
- Updated dependencies [746fab0]
  - @weasel-js/core@1.15.0
  - @weasel-js/pdf@1.15.0
  - @weasel-js/diagram@1.15.0
  - @weasel-js/svg@1.15.0

## 1.14.2

### Patch Changes

- 98c5c23: PDF export writes the document's language as the catalog's `/Lang`, and marks text in another language with
  its own `/Lang`, so a screen reader or text extraction no longer guesses it. `writePdf` and `exportPagesPdf`
  take the document's language as a new `lang` option; left out, it is the language every run of text shares,
  and the document has none when they do not share one. A run's language is its `lang`, or its text node's.
- Updated dependencies [012cae5]
- Updated dependencies [301a320]
- Updated dependencies [c06637e]
- Updated dependencies [ae38d2e]
- Updated dependencies [98c5c23]
- Updated dependencies [4bba14d]
- Updated dependencies [d05de93]
  - @weasel-js/core@1.14.2
  - @weasel-js/diagram@1.14.2
  - @weasel-js/pdf@1.14.2
  - @weasel-js/svg@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/core@1.14.1
  - @weasel-js/diagram@1.14.1
  - @weasel-js/pdf@1.14.1
  - @weasel-js/svg@1.14.1

## 1.14.0

### Patch Changes

- e1bbdcd: Diagram outlines are now a registrable table. `registerOutline(name, def)` adds a named outline (or shadows a built-in until disposed), `outlineFromD(d, opts)` builds one from unit-square SVG path data, and `outlineDetail` gives the strokes an outline draws over its fill. `Outline` widens to any registered name; an unregistered one paints as `rect` and warns once. Eleven built-ins join the flowchart seven: `roundRect`, `cylinder`, `document`, `note`, `cloud`, `triangle`, `octagon`, `folder`, `cube`, `actor`, and `doubleEllipse`. Each keeps its content box inside the visible shape, and `diagramShape` strokes a cylinder's rim, a note's fold, a folder's tab, a cube's front edges, and a double ellipse's inner ring.
  
  New stroke markers: the crow's-foot family `crow-one`, `crow-many`, `crow-zero-one`, `crow-one-many`, and `crow-zero-many`, and `triangle-hollow` for UML generalization. `KitMarkerKey` lists them.
  
  DOT, Mermaid, and draw-style XML read and write the new outlines and markers where the format has a counterpart. Mermaid's writer no longer throws on an outline it has no brackets for: it writes a rectangle and warns. draw-style XML reads `rounded=1` below the stadium arc as `roundRect`, a hollow `block` head as `triangle-hollow`, Mermaid reads `(text)` as `roundRect`, and DOT and Mermaid read a double circle as `doubleEllipse`. DOT reads `onormal` as `triangle-hollow`.
- 726d80b: Add UML class and ERD stencils and diagram types to `@weasel-js/diagram`. The `uml` group holds class, interface, abstract class, package, note, actor, use case, and component; the `erd` group holds entity, weak entity, relationship, and attribute. The `umlClass` type routes new connectors orthogonally to an open arrowhead, and `erd` draws them from `crow-one` to `crow-many`.
  
  A body takes a new `divider` row, a rule across its content box that the outline painter draws in the body's own stroke, and a row's text style can now be `italic`. A built body records each row's height, so `bodyFollower`, a new transform follower, lays a resized body's rows out again inside its new box. `DiagramStencil` takes `padding`, `gap`, and `verticalAlign`. Two outlines are added: `component` and `doubleRect`.
  
  `@weasel-js/diagram-formats` reads divider rows back from a scene, leaves them out of DOT, Mermaid, and draw-style XML text without a warning, and writes and reads an italic row in draw-style XML.
- ee615ae: Draw-style XML now writes and reads BPMN's events, gateways and subprocess and the network devices as draw.io's own shapes (`mxgraph.bpmn.event`, `mxgraph.bpmn.gateway2`, `mxgraph.bpmn.task`, and `mxgraph.networks.*`), each with its label below the figure, where it used to write them as rectangles with a warning. A BPMN event or gateway draw.io draws that has no outline here, such as an end event or a complex gateway, reads as the nearest one. The network `globe` still goes out as a rectangle. Mermaid, which has no such figures, now writes an event as a circle, an intermediate event as a double circle, a gateway as a diamond without its marker, and a subprocess as a rounded rectangle, with a warning saying so.
- 3418e3a: DOT keeps outlines it has no exact shape for. A stadium, and any outline DOT has no shape of its own for (the network devices, BPMN gateways and events, and the rest), is written with a `weasel_outline` attribute beside the box Graphviz draws, and read back as itself. A rounded box without one now reads as `roundRect` rather than `stadium`, which is how Graphviz draws it.
- 39cc5a8: draw.io export writes inclusive and event-based BPMN gateways the way draw.io's own palette does, as an event outline
  inside the diamond (`outline=end;symbol=general`, `outline=catching;symbol=multiple`); the `gwType` values it wrote
  before are not ones draw.io knows, and drew a bare diamond. Import reads draw.io's forms and the earlier ones. A
  `globe` node goes out as `mxgraph.office.concepts.globe_internet` rather than a rectangle.
- a80f8be: A scene composes poses by default. A child's stored pose is now relative to the frame of the nearest container above it that defines one (`RIGID_POSE_COMPOSITION`), so moving a container writes one pose, rotating it rotates its contents, and resizing it leaves them where they draw. A container whose pose derives from its children (`dependsOn: 'children'` with a `derivePose`) is an envelope, not a frame: its children share the frame above it.
  
  **This breaks a consumer that stores absolute child poses.** To migrate:
  
  - A scene whose `TPose` is not a rect pose must name its composition: `useScene` and `createScene` require `composition` in the type unless `TPose` is a `RectPose`. `IDENTITY_POSE_COMPOSITION` keeps every pose world; under it a container groups its children and never carries them. kernel3d's scenes name it.
  - Saves: `toJSON` writes version 3, whose child poses are local. `sceneFromJSON`, `Scene.loadState`, and `specsFromSerialized` read a version 1 or 2 save as world and make each pose local as it loads, under the scene's composition (`SpecsFromSerializedOptions.composition`). A recorded history from before is not restored: `SCENE_HISTORY_FORM` is 4.
  - Specs or ops you build with world poses for children: put them through `localizeWorldPoses(specs, composition)`, or `localizeInScene(scene, specs)` when they land under a container already in the scene. `worldPosesOf(specs, composition)` reads them back as world, and `heldInFrame(scene, id)` names what a container's frame holds.
  - `sceneToAdapter`'s `setPose` no longer moves a container's descendants by the same delta, and a container's pose target no longer shows them traveling beside it: the frame carries them. `PoseCascade` and the `cascade` argument of `scenePoseTarget` and `sceneClipTargets` are gone.
  - The group action makes a frame group, whose pose is authored, under any composition; it no longer derives an envelope's pose from its members under the identity strategy.
  - `resolvePreviews` answers each entry's pose in world, and a previewed frame brings the children it carries.
  - `SnapTarget.slotPose` is world, as documented; `snapToContainer` stores it in the target's frame.
  - `diagramScene` returns each spec's pose in its container's frame (`composition`, default `RIGID_POSE_COMPOSITION`; pass `IDENTITY_POSE_COMPOSITION` to read the layout in world). Body rows, container titles, lanes, and members are stored relative to what holds them; `DiagramView`'s reports, `diagramLayoutOf`, and `documentFromScene` stay in world.
  - `svgNodesFromKit` folds a tree's `composition` when it has one, and `unpackSvgFiles` stores each imported node in its container's frame.
- Updated dependencies [d8fbd3d]
- Updated dependencies [b4cc0d7]
- Updated dependencies [575e470]
- Updated dependencies [47656e3]
- Updated dependencies [ad58b32]
- Updated dependencies [f045da7]
- Updated dependencies [ac7aa31]
- Updated dependencies [0c6c086]
- Updated dependencies [436f034]
- Updated dependencies [99fc88d]
- Updated dependencies [0145603]
- Updated dependencies [b2bd005]
- Updated dependencies [e1bbdcd]
- Updated dependencies [726d80b]
- Updated dependencies [a1b06d8]
- Updated dependencies [9725598]
- Updated dependencies [592b6e5]
- Updated dependencies [41a013b]
- Updated dependencies [965e698]
- Updated dependencies [fda48f1]
- Updated dependencies [070f3d0]
- Updated dependencies [f2188ba]
- Updated dependencies [b4a8e98]
- Updated dependencies [60c7c69]
- Updated dependencies [fc0962a]
- Updated dependencies [8b14236]
- Updated dependencies [41ebe89]
- Updated dependencies [47330a3]
- Updated dependencies [db4b0aa]
- Updated dependencies [1298c24]
- Updated dependencies [76edfb1]
- Updated dependencies [61e07e5]
- Updated dependencies [270bc4f]
- Updated dependencies [7242ab2]
- Updated dependencies [88573be]
- Updated dependencies [b142892]
- Updated dependencies [14f8583]
- Updated dependencies [e7f4305]
- Updated dependencies [2f3d924]
- Updated dependencies [c01c5f0]
- Updated dependencies [23bb196]
- Updated dependencies [783756a]
- Updated dependencies [2692828]
- Updated dependencies [3c3a219]
- Updated dependencies [767713e]
- Updated dependencies [6a69c27]
- Updated dependencies [b0a55a6]
- Updated dependencies [5c8636b]
- Updated dependencies [5b7d0ac]
- Updated dependencies [930f2fa]
- Updated dependencies [edc7324]
- Updated dependencies [1968706]
- Updated dependencies [e7fca17]
- Updated dependencies [1d39cf6]
- Updated dependencies [e5ea7e8]
- Updated dependencies [22472a1]
- Updated dependencies [ec6d7d3]
- Updated dependencies [80789ff]
- Updated dependencies [f695cff]
- Updated dependencies [b1b16ce]
- Updated dependencies [b15704a]
- Updated dependencies [81d08f7]
- Updated dependencies [baf354e]
- Updated dependencies [a29d2df]
- Updated dependencies [4aa9b8b]
- Updated dependencies [39cb8ed]
- Updated dependencies [a58fb4f]
- Updated dependencies [8e6ed97]
- Updated dependencies [18c96c3]
- Updated dependencies [5af16a6]
- Updated dependencies [966c37f]
- Updated dependencies [f30c624]
- Updated dependencies [b06e2b9]
- Updated dependencies [d9896bb]
- Updated dependencies [03d30ee]
- Updated dependencies [c8fcbc2]
- Updated dependencies [34a364e]
- Updated dependencies [4c0141f]
- Updated dependencies [f9282f7]
- Updated dependencies [01b103e]
- Updated dependencies [19e4c11]
- Updated dependencies [a80f8be]
- Updated dependencies [6940f43]
- Updated dependencies [8e2c8c8]
- Updated dependencies [ebe1f55]
- Updated dependencies [b668624]
- Updated dependencies [e9ea01b]
- Updated dependencies [928f014]
- Updated dependencies [3401898]
- Updated dependencies [7e4c7c4]
- Updated dependencies [5967c5c]
- Updated dependencies [0dd5658]
- Updated dependencies [2bdc135]
- Updated dependencies [a4b6c5b]
- Updated dependencies [16f7828]
- Updated dependencies [0ac4e47]
- Updated dependencies [8c7fb03]
- Updated dependencies [3b25c35]
- Updated dependencies [058fcdf]
- Updated dependencies [1a64358]
- Updated dependencies [99a8383]
- Updated dependencies [880f2b0]
- Updated dependencies [4a8b5be]
- Updated dependencies [871a56b]
- Updated dependencies [1fb8193]
- Updated dependencies [f645651]
- Updated dependencies [1e54d33]
- Updated dependencies [9adc0cd]
- Updated dependencies [ca31c35]
- Updated dependencies [69d6ede]
- Updated dependencies [7a6f462]
- Updated dependencies [de97d4d]
- Updated dependencies [9abd787]
- Updated dependencies [09442dc]
- Updated dependencies [fceb8c5]
  - @weasel-js/core@1.14.0
  - @weasel-js/diagram@1.14.0
  - @weasel-js/svg@1.14.0
  - @weasel-js/pdf@1.14.0

## 1.13.0

### Patch Changes

- ed89d42: A node clips its children only when it declares a clip. Breaking: a group no longer clips its children to its outline by default, and nothing else does either. A node clips its children to its `clipFromPose` when it has one, or to its outline when it sets the new `clip: 'outline'` field. Its own paint, under its children or over them, is not clipped by its own clip. That outline is the silhouette of whichever painter claims the node, the rect fallback's box included, read by the new `clipOutline(node, pose)`. `clip` is saved and loaded, copied, pasted and undone like the node's other fields, and `NodeClip` names its type.
  
  Scenes saved at version 1 keep their look: a version 1 container that loads as a group, as it does by default, gets `clip: 'outline'` when it has no clip function or a load skips its clip key. One that `classifyV1` makes a mark gets no implicit clip, since the loader cannot know which painter will claim it; set `clip` on it where it should clip. Version 2 scenes saved by builds between the version 2 format and this change are read as written, so a group there that relied on the old default clip draws its children unclipped.
  
  - `clipNothing` and symmetry's `SYMMETRY_CLIP_KEY` stay registered so saves naming them load; diagram bodies and symmetry groups no longer set a clip, and `@weasel-js/diagram`'s `BodyNodeSpec` drops its `clipFromPose` field.
  - Baking a symmetry group carries each copied node's pose through the copy's transform, its clip with it, and copies a mark's children and every node's stated fields (`pickable`, `hidden`, `units`, `clip`). A mirrored copy of a clipping group used to clip its content away.
  - `statedFields(node)` and `StatedNodeFields` are exported: the plain optional fields a copy of a node carries.
  - `@weasel-js/svg`: an imported `<g clip-path>` is a group with `clip: 'outline'` (`SvgSceneDraft` carries `clip` on a group). The export writes a clip only for a node that declares one, clipped to the same `clipOutline` the canvas uses; a group holding `data.path` without `clip` exports unclipped. A mark with children now exports as a `<g>` holding its own element and then its children, which were left out before; its declared clip and copies apply to its children only. `SvgKitTreeNode` takes `clip`.
  - `@weasel-js/diagram-formats`: a page export writes a diagram box as its outline followed by its rows, with no special case for diagram nodes.
  - `specsFromSerialized` is exported, with `SpecsFromSerializedOptions`. Its `unknownKeys: 'skip'` loads a node whose registry key is unknown without that function instead of throwing, and `onSkip` hears each key left out as a `SkippedKey`. `sceneFromJSON` takes both options, and `scene.loadState(json, opts)` takes them as a second argument.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- Updated dependencies [b1c691a]
- Updated dependencies [16464c5]
- Updated dependencies [9a76fb5]
- Updated dependencies [38d5ad1]
- Updated dependencies [7edd3be]
- Updated dependencies [cbb16ca]
- Updated dependencies [5f28e9c]
- Updated dependencies [e70d2cd]
- Updated dependencies [ed89d42]
- Updated dependencies [04b862d]
- Updated dependencies [7e7549c]
- Updated dependencies [d5a9a80]
- Updated dependencies [3519c96]
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [8c39126]
- Updated dependencies [1322310]
- Updated dependencies [fb5bb67]
- Updated dependencies [ceae749]
- Updated dependencies [bbee4df]
  - @weasel-js/core@1.13.0
  - @weasel-js/diagram@1.13.0
  - @weasel-js/svg@1.13.0
  - @weasel-js/pdf@1.13.0

## 1.13.0-rc.0

### Patch Changes

- ed89d42: A node clips its children only when it declares a clip. Breaking: a group no longer clips its children to its outline by default, and nothing else does either. A node clips its children to its `clipFromPose` when it has one, or to its outline when it sets the new `clip: 'outline'` field. Its own paint, under its children or over them, is not clipped by its own clip. That outline is the silhouette of whichever painter claims the node, the rect fallback's box included, read by the new `clipOutline(node, pose)`. `clip` is saved and loaded, copied, pasted and undone like the node's other fields, and `NodeClip` names its type.
  
  Scenes saved at version 1 keep their look: a version 1 container that loads as a group, as it does by default, gets `clip: 'outline'` when it has no clip function or a load skips its clip key. One that `classifyV1` makes a mark gets no implicit clip, since the loader cannot know which painter will claim it; set `clip` on it where it should clip. Version 2 scenes saved by builds between the version 2 format and this change are read as written, so a group there that relied on the old default clip draws its children unclipped.
  
  - `clipNothing` and symmetry's `SYMMETRY_CLIP_KEY` stay registered so saves naming them load; diagram bodies and symmetry groups no longer set a clip, and `@weasel-js/diagram`'s `BodyNodeSpec` drops its `clipFromPose` field.
  - Baking a symmetry group carries each copied node's pose through the copy's transform, its clip with it, and copies a mark's children and every node's stated fields (`pickable`, `hidden`, `units`, `clip`). A mirrored copy of a clipping group used to clip its content away.
  - `statedFields(node)` and `StatedNodeFields` are exported: the plain optional fields a copy of a node carries.
  - `@weasel-js/svg`: an imported `<g clip-path>` is a group with `clip: 'outline'` (`SvgSceneDraft` carries `clip` on a group). The export writes a clip only for a node that declares one, clipped to the same `clipOutline` the canvas uses; a group holding `data.path` without `clip` exports unclipped. A mark with children now exports as a `<g>` holding its own element and then its children, which were left out before; its declared clip and copies apply to its children only. `SvgKitTreeNode` takes `clip`.
  - `@weasel-js/diagram-formats`: a page export writes a diagram box as its outline followed by its rows, with no special case for diagram nodes.
  - `specsFromSerialized` is exported, with `SpecsFromSerializedOptions`. Its `unknownKeys: 'skip'` loads a node whose registry key is unknown without that function instead of throwing, and `onSkip` hears each key left out as a `SkippedKey`. `sceneFromJSON` takes both options, and `scene.loadState(json, opts)` takes them as a second argument.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- Updated dependencies [38d5ad1]
- Updated dependencies [7edd3be]
- Updated dependencies [cbb16ca]
- Updated dependencies [5f28e9c]
- Updated dependencies [e70d2cd]
- Updated dependencies [ed89d42]
- Updated dependencies [04b862d]
- Updated dependencies [7e7549c]
- Updated dependencies [d5a9a80]
- Updated dependencies [3519c96]
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [8c39126]
- Updated dependencies [1322310]
- Updated dependencies [fb5bb67]
- Updated dependencies [ceae749]
- Updated dependencies [bbee4df]
  - @weasel-js/core@1.13.0-rc.0
  - @weasel-js/diagram@1.13.0-rc.0
  - @weasel-js/svg@1.13.0-rc.0
  - @weasel-js/pdf@1.13.0-rc.0

## 1.12.0

### Patch Changes

- 24f2495: An absent fill or stroke now means none everywhere, read through `resolveFill` and `resolveStroke`. This breaks three things that used to fill in a default:
  
  - **A text node built without a `fill` now draws no glyphs.** Write `fill: { paint: solid('#000') }`, or `DEFAULT_TEXT_FILL`, now exported from `@weasel-js/text` and `@weasel-js/core`. `DEFAULT_TEXT_STYLE.fill` is `null`. The text insert, the sticky note and SVG import write black themselves.
  - **A derived part with no `fill` or `stroke` no longer takes its node's.** Write `INHERIT` (`'inherit'`) for that; `DerivedPart` allows it, and `resolvePartPaint` is the one reading of a part's paint.
  - **`diagramShape` drops its `defaultFill` and `defaultStroke` options.** An outline paints what its data names; `diagramScene` already writes the default style onto every node. SVG import writes SVG's initial black onto text that names no fill, and SVG export writes `fill="none"` for text that has none.
  
  `setFill` and `setStroke` write None as a record with no `paint` rather than `null`, so a stroke keeps its width and dash; a `paint: null` passed when the gesture starts used to be read as no paint given and painted the default color. The selection panel shows a fill or stroke paint as a paint, None or Mixed, never unset; `nestedPaintValue` is that reading. Booleans, Outline Stroke and the character bar read a fill with no paint as unfilled. Core re-exports `resolveFill`, `resolveStroke`, `INHERIT` and their types.
- 929736f: `@weasel-js/pdf` draws a group's Porter-Duff `composite` exactly instead of source-over. With a `rasterize` hook, a group whose composite is anything but `source-over` is handed to the hook together with everything the page drew before it, inside the groups it sits in, so the renderer composites it onto its real backdrop; the raster is placed on white paper over the group's bounds, or over the whole page for an operator that clears what the group leaves empty. An isolated group holding such a composite is rasterized whole. The hook's signature is unchanged; without one, a composite is still drawn source-over and reported in `skipped`.
  
  `@weasel-js/renderer` exports `leavesUncovered(composite)`, whether an operator leaves the destination as it was wherever the source is empty, and `readsBackdrop(commands)`, whether any group in a list has its own composite.
- d9fd036: `@weasel-js/pdf` rasterizes a group with effects over the group's bounds grown by how far its effects reach, rather than over the whole page, so a small blurred badge no longer costs a full-page bitmap. An `Effect` can now say how far it reaches with the new optional `reach`, in device pixels; `blur` sets it, and `effectsReach` (`@weasel-js/renderer`) adds up a stack's. An effect without one, such as `vignette`, still covers the whole page. The renderer's retained surfaces use the same bound, and `commandsBounds` takes the scale the commands will be drawn at.
  
  `screen`-unit paint inside a rasterized group now lands in the PDF where the vector path puts it, in page points rather than raster pixels. `WeaselRenderer.render` takes `screen` in its options, naming what screen space is when it is not the drawing surface, and `renderSceneToPixels` and a raster session's `render` pass it through as `screen`.
- Updated dependencies [0996ce6]
- Updated dependencies [22d571c]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [400b393]
- Updated dependencies [40d87f7]
- Updated dependencies [0510091]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
- Updated dependencies [92a0f2d]
- Updated dependencies [c697535]
- Updated dependencies [d5270fe]
- Updated dependencies [c2fb65c]
- Updated dependencies [3aaee5d]
- Updated dependencies [24f2495]
- Updated dependencies [953c402]
- Updated dependencies [929736f]
- Updated dependencies [d9fd036]
- Updated dependencies [bb7e6b5]
- Updated dependencies [f461572]
- Updated dependencies [3bf5edb]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [eec50d7]
  - @weasel-js/core@1.12.0
  - @weasel-js/diagram@1.12.0
  - @weasel-js/svg@1.12.0
  - @weasel-js/pdf@1.12.0

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
