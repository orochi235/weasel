# @weasel-js/diagram-formats

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
