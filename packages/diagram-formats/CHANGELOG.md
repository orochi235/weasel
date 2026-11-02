# @weasel-js/diagram-formats

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
