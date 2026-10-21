# @weasel-js/diagram

## 1.11.1

### Patch Changes

- 267d5e4: Connectors can route around shapes. The `avoid` router draws a connector orthogonal, with few bends,
  clear of every shape, and with parallel runs spread apart. Its route is computed when the scene is
  edited and stored on the edge as `diagram.route`, so a saved file draws it without rerouting and
  undo restores it exactly; a stored route that no longer fits its ends draws as `orthogonal`.
  `useAvoidRouting(scene)` (or `installAvoidRouting` outside React) reroutes whatever each edit
  disturbed in that edit's own undo entry, and reroutes the connectors near a dragged shape every
  frame. Containers, pools, and group boxes are in the way only of connectors with neither end inside
  them; lane bodies never are; headers always are. Dragging a segment of an `avoid` connector pins
  only that segment. `DiagramView` takes `router="avoid"`, and `createAvoidRouter` — the search alone,
  over plain boxes and ports — is in `@weasel-js/diagram/layout`. New commands set the selected
  connectors' router (`SET_ROUTER_ACTION_IDS`), and layout no longer writes waypoints to an `avoid`
  connector.
  
  Core adds scene edit passes: `scene.addEditPass(pass)` hears each live edit's added, removed,
  posed, re-parented, and data-changed ids once its own mutations and the arrival handler have run,
  and its ops join the same undo entry. Passes never re-trigger on their own writes, and undo, redo,
  and history replay never run them. While any pass is added, a bare scene call runs as an edit of
  its own.
  
  weaselchart's connector tool draws connectors that route around shapes, and Format › Connector
  picks Around shapes, Orthogonal, Straight, or Curved for the selected connectors. Charts saved
  before keep the router they have.
- 922cddf: Diagrams get containers and swimlane pools, and core's layouts and drops carry and filter nested nodes.
  
  - core: a layout pass that moves a child container now takes that container's descendants along, under absolute poses, in the same edit; so does a layout drop that shifts siblings, in its preview and its commit. `carriedDescendants(source, root, translate)` and `sceneCarrySource(scene)` are the helper behind both. A new optional `canDropInto(parent, ids)` dep (`CanDropIntoDep`) decides which containers a move may drop into: reparent-on-drop passes over a refused container, the layout drop skips it, and a child leaving its layout container does not land in it.
  - diagram: `CONTAINER_STENCILS` offers Container, Pool (rows), and Pool (columns). A container is a titled box whose members move with it and stay put when it is resized; a pool stacks lanes that reorder by their headers, resize by the boundary after each (`diagram.resizeLane`), and grow by the button past the stack (`diagram.addLane`). `diagram.releaseMembers` removes a container and keeps what it holds. `diagramCanDropInto(scene)` is the drop filter, `diagramContainers` returns the lane layer and the contribution, and `diagramContainerLayout` and `laneStackLayout` register through `withDiagramRegistry`. `useStencilInsert` takes `containers`, and a stencil drawn inside a container or a lane becomes its member. Lanes take no connectors, and `diagramResizable` refuses them.
  - core: a container with a layout is arranged again whenever one of its children's poses is written — a nudge, an align, a panel edit — not only when its children or its size change, in the same undo entry as the write.
- d5a4102: Breaking at the type level for custom `commit` and `canConnect` callbacks: the ends of a `PendingEdge` and the arguments of `CanConnect` are now a `ConnectEnd`, which is a port or a shape's body, where they were always a port.
  
  `@weasel-js/diagram` gains editing surface. Edges connect onto a shape's body (`connectBodies`, the `bodies` option, and a connector tool), and a selected edge's ends reconnect by dragging a handle. A label action (`editEdgeLabelAction`, `edgeLabelSpec`, `labelSize`) creates and edits an edge's label. Stencils (`FLOWCHART_STENCILS`) come with `useStencilInsert` and `useStencilTool`. `DiagramView` takes `onReconnect`, `onDelete`, `onEditLabel`, `connectBodies` and `ambient`, and its ref has `worldAt`. `diagramResizable` keeps resize handles off edges and labels. `DataEdge` and `EffectWire` take an optional `id`, and the `ellipse` outline is new. For effect pipelines there is an edit model, stage types with typed params, and `EffectEditor`, an editable node graph.
  
  `@weasel-js/core` exports `createDeleteAction` and `commitDeleteToScene`, so a consumer can swap how a delete commits.
- 9cd12f7: Edge labels are obstacles, and they dodge. An `avoid` connector now routes around every other
  connector's label, 4 world units clear (`labelClearance`), and never around its own; within one
  commit a label is restationed on its connector's new route before the next connector routes.
  `AvoidEdge.label` carries it, filled from the scene and from `DiagramView`'s specs. An obstacle's
  `kind` may now be `'label'`.
  
  After any edit, `useLabelPlacement(scene)` (or `installLabelPlacement` outside React) moves a label
  that sits on a shape, another label, or another connector along its own connector, or across it,
  to the nearest clear station, in that edit's own undo entry, and sizes a label to the text an edit
  gives it. The chosen station is stored on the label trait as `placed`, which `labelDerivePose`
  reads before `at` and `offset`; `dodge: false` opts a label out. Labels hold still during a drag
  and settle on release. `DiagramView` takes `labels="dodge"`, `createSpecLabelPlacer` is that step
  on its own, and `placeLabels` — the placement alone, over plain boxes and routes — is in
  `@weasel-js/diagram/layout` with `labelCenter`.
  
  Core adds `documentDepOf(scene, id)`: a dependency at the pose and path the document holds, with
  no override counted, for a reader such as an edit pass.
  
  weaselchart places edge labels, so a shape dropped on a label moves the label off it on release.
- e5ba382: Connectors can jump each other. While a scene's `HOPS_DOC_KEY` document value is set, wherever two
  connectors cross, the one later in render order bows over the other in a half circle of the value's
  `size`. A hop bulges toward −y on a horizontal run and toward −x on a vertical one, whichever way the
  connector travels, and to the left of travel on a diagonal. Crossings near either connector's ends
  or a bend, and collinear overlaps, make no hop, and hops closer than twice their radius merge into
  one longer hop. A connector split across pages neither hops nor is hopped over. Each connector stores its hops as `diagram.hops`, so a saved file draws them with no
  pass running, and a hop no longer on its connector's route does not draw.
  
  `useHops(scene)` (or `installHops` outside React) recomputes the hops an edit disturbed in that
  edit's own undo entry, and turning the value on or off recomputes or clears them all in the one
  entry that sets it. While a drag is in progress, the connectors it moves, and those hopping over
  them, draw without hops until release. `diagramWaypoints` carries a Line jumps toggle
  (`SET_HOPS_ACTION_ID`), `DiagramView` takes `hops`, a radius, and `edgeHops`, the crossing finder
  over plain polylines, is in `@weasel-js/diagram/layout`.
  
  Core's `TransformFollower.preview` gets a second argument: the data the followers before it
  previewed, by id, so a follower can build on a route an earlier one previewed. A follower that
  calls `preview` itself now passes it. `useAvoidRouting`'s drag preview reads the waypoints a
  `waypointFollower` registered before it carried, rather than carrying them itself, so without one
  the preview leaves waypoints where the commit will.
  
  weaselchart adds Format › Connector › Line jumps.
- 8e317f5: Off-page reference markers. On a scene with pages, a connector whose two shapes sit on different
  pages no longer draws across the gap: each end draws a short stub out of its shape, ending at a tag
  that reads the other page's name and a reference letter, such as "Page 2 · A".
  `useOffPageMarkers` (or `installOffPageMarkers` without React) splits and joins connectors as edits
  move their ends or change the pages, in that edit's own undo entry, and writes
  `DiagramEdge.offPage`. The tags are text nodes with a background (`offPageTagSpec`, registry key
  `diagram:offPageTag`), colored by the theme. `diagramOffPage()` binds a double-click on a tag to
  selecting the shape at the far end and fitting the view to its page. `offPageSplits` is the split
  rule as arithmetic, and `offPageOps` runs the pass over named connectors.
  
  A split connector's `ResolvedRoute` carries its two `stubs`, it shows no route handles, and the
  `avoid` router leaves it out until it joins again. An edge label on a path with several subpaths
  sits on the first (`subpathOf`).
  
  `pageName` (core) is the name a page shows, its own or "Page" and its place, and `PageTabs` uses it.
- d3787a4: An effect pipeline can be run, not only drawn. `runPipeline` evaluates it in `runOrder` with an
  `EffectEvaluator` per stage type and an `EffectValueKind` per value type, filling each stage's cost,
  values, and previews; a stage nothing reaches is skipped, a bypassed stage passes its input through,
  a throwing evaluator records its `error`, and stages on a cycle never run. A stage with no outputs
  shows and previews what reached its inputs (`shownPorts`), so a sink shows the finished result. `createEffectRunner` runs
  one pipeline whole, a stage at a time (the run's new `at`), or every frame while playing, and closes
  the previews of runs that are off screen; `useEffectRunner` plays it through `useVisibleRaf`.
  `IMAGE_STAGE_TYPES`, `imageEvaluators`, `imageValueKinds`, and `testCard` run image pipelines on
  `OffscreenCanvas`. `paintRun` outlines the stage a run is `at` and writes a stage's `error` where its
  cost goes, and `EffectEditor` takes a `run`, fading the port dots of unreached stages as
  `EffectChart` does.
  
  weaselchart's pipeline mode has a Run menu (Run, Step, Play, Pause, Reset, and Choose Source
  Image…) and View › Show Values and Show Previews; its stage palette is now `IMAGE_STAGE_TYPES`.
- 312eb35: Themes can be edited. `forkTheme`, `setThemeValue` (by a `ThemePath` such as
  `['roles', 'accent', 'fill']` or `['series', 2]`), `addThemeRole`, `renameThemeRole`, and
  `removeThemeRole` return a new theme and leave the one given alone, so a shipped theme is never
  changed; `editableTheme` forks a shipped theme and passes a custom one through. `DiagramTheme` takes
  `roleLabels`, the names of roles beyond the shipped six, and `themeRoles(theme)` lists every role
  with its name. A removed role's shapes are drawn in the default role. `parseDiagramTheme` and
  `themeToJson` read and write `.weasel-theme.json` files, and a bad file comes back as errors naming
  each bad value by its path. `applyDiagramTheme` takes `{ coalesceKey, from }`.
  
  Applying a theme whose font size differs from the scene's moves existing text by the step between
  them: shape rows, titles, and connector labels keep their offset from the body size.
  `setDiagramFontSize(scene, ids, size)` sets a shape's or connector's text size by hand and records
  it in the trait's new `ownFont` (`FontField`), which a theme's size change then leaves and choosing
  a role keeps. A body whose text changes size is laid out again in the same undo entry: it grows
  to fit its rows and never shrinks. A body built from text rows alone records how it stacks them
  as `DiagramNode.body`, its rows carrying `bodyRow`; `relayoutBodies` lays such bodies out again,
  and `rendererMeasure` measures text from the registered font as the renderer draws it.
  
  Core's `scene.batch(label, fn, { coalesceKey })` folds a batch into the undo entry before it when
  that one was recorded under the same key and nothing came between, so a run of batches, such as a
  color dragged, undoes as one entry back to the state before the first. Unlike an op's own key it
  needs no `coalesceWindowMs`; `scene.history.seal()` ends the run. `@weasel-js/history`'s
  `recordEntry` takes the same `coalesceKey`.
  
  weaselchart's Format › Theme › Edit Theme… opens a Theme panel: every role's colors, with roles
  added, renamed, and removed (not the default), the connector, label, container, lane, page, and
  series colors, and the font. The Style panel gains Text size. The chart recolors as a color is dragged, and one undo takes back the
  drag. The first edit to a shipped theme copies it into the chart as "<name> (edited)". Import
  Theme… and Export Theme… move a theme between charts.
- 7ffc196: Connector routes are editable, and whole-node transforms carry other nodes along through one dep.
  
  - core: a `transformFollowers` dep holds every `TransformFollower`, `{ preview(frame), finish(ops, label) }`, and each whole-node transform (move, resize, rotate, flip, align, distribute, nudge, transform again) finishes its batch and previews its frame through all of them in order. `useTransformFollower` adds one. Path edit's constraint links are now one of them, so `EditAnchorsDep.transformOps` and `EditAnchorsDep.transformPreview` are gone; that is breaking for anyone who called them. `writtenBy(scene, ops)` reads the pose and data a batch leaves each node it writes.
  - diagram: a selected edge shows handles along its route. Under `straight` and `bezier`, a dot on each waypoint moves it and a hollow dot in each leg inserts one; under `orthogonal`, a bar slides its segment, jogging where it touches a port. A double-click removes a waypoint or straightens a jog. Drags snap into line with neighboring stops and port axes. `diagramWaypoints` returns the handle layer and a contribution carrying the drag, the double-click, and the `diagram.resetRoute` command; the math is exported on its own (`routeHandles`, `dragSegment`, `simplifyStops`, and the rest). `waypointFollower(scene)` carries waypoints along with a move of both ends. `DiagramView` takes `onEditRoute`, and `EffectEditor` keeps wire routes in `EffectDoc.routes` (`setWireRoute`). `edgeRouter` answers an edge's resolved route, as `edgeDerivePath` draws it.
- 11e1ecb: The container stencils carry palette glyphs. `ContainerStencil` takes an `icon`, and
  `CONTAINER_STENCILS` sets one on each: a box with a title band for Container, a box with a left
  header and two stacked lanes for Pool (rows), and a box with a top header and two lanes side by
  side for Pool (columns). The glyphs are diagram's own `diagram` icon namespace, published as
  `@weasel-js/diagram/icons` and found by the icons build plugin through the package's
  `weaselIcons` field; an app that registers tables by hand adds this one beside the kit's.
- 853ce69: A dep source is handed `below`, which reads the source it displaced, in its own scope or one above, so a source can handle part of a dep and pass the rest to the default (`DepSource`, accepted by `useDepSource` and `DepRegistry.register`). A source taking no argument works as before. `useStencilInsert` uses it: a kind no stencil names goes to the `insert` dep beneath it, so core's rect, ellipse and text tools work beside stencils.
- 10da7a0: A body's label rows are centered in their row (`rowTextStyle`, used by `diagramScene` and by stencils alike); field rows stay left-aligned. `formatParam` shows a number to as many places as its control's `step` has, and never prints `-0.0`. `EffectEditor` pins every stage where it shows on a drag, as adding a stage already did, so layout no longer moves the stages nobody placed, and a delete clears its picked wire. `dropEmptyEdgeLabel` removes an edge label whose edit ended with no text; pass it as a text edit's `onEnd`.
  
  `CanConnect` takes a third argument, `moving`: the edge and end a reconnect is carrying, absent for a new connect. A connect or reconnect no longer lands on the body of a shape with no ports, which left an edge with nothing to route to. A reconnect's preview aims its fixed end the way the committed edge will, at the first waypoint when there is one, through `endAims`, the one rule both now share.
- 1729b01: `DiagramData` takes containers and pools. `containers` lists regions by id, each a container with
  `members` or a pool with `lanes`; `diagramScene` builds each as a scene container holding its
  members, outer regions first. A container with a `box` is laid out as one node of that size and its
  members ride along with it, a member with no `at` seeded inside it in rows; one with no `box` is laid
  out as a group and fits its members. A pool always has a box, and its lanes stack at their `size` or
  share what the box leaves. An edge with an end inside a boxed region ranks against the outermost one.
  Under `theme`, regions take the theme's container and lane colors, or a `style` role's, and their
  titles the theme's face. A node named by both a group and a region is refused: `diagramScene` throws.
  
  `DiagramView` takes `onEditContainer`, which reports a region moved or resized (`box`), a lane
  boundary dragged, a lane reordered by its header, or a lane added (`lanes`), a header
  double-clicked (`title`), and Release members (`release`), keeping none of them until the specs
  follow. `NodeMove` carries `parent` when a drop changed the region a node is in, `onDelete` reports a
  deleted region with everything inside it, and the view lets shapes drop only into containers and
  lanes. `router="avoid"` routes around regions and their headers as the scene router does, and
  `diagramLayoutOf` also returns the boxes layout gave containers and pools.
  
  `regionSpecs` and `firstLanes` are exported, so stencils and data build regions one way, and
  `editContainerTitleAction` reports a double-click on a header. The data types moved to their own
  module; every import path is unchanged.
- 06f7bca: `DiagramData` takes `pages`: `diagramScene` splits a connector between pages into stubs with off-page tags, as chart mode's edit pass does.
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
- 46224b6: Groups now work under the `rack` and `lanes` looks. Layouts that have groups change: the `chain`
  layout keeps each group's members together and moves stages outside a group out of its columns,
  and the `lanes` look gives each group columns of its own. `EffectEditor` reorders a group by
  dragging its title and renames it by double-clicking the title under both looks, moves a run of
  stages along the chain as one, and refuses a stage drop that would split a group. In
  `ReorderItem`, `grip` accepts `null` for an item that has gaps but can't be picked up, and a
  `'bar'` drag now moves everything an item `carries`.
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
- 4a74f67: One reorder drag: `createReorderAction` carries an item of any drawn sequence and takes a `show`
  option, `'bar'` (the default) for an insertion bar or `'slide'` to slide the other items into place.
  `DiagramView`'s `onReorder` is now built on it through `groupReorderSlots`, and the pipeline editor's
  stage and lane reorders use it too; `onReorder` behaves as before.
  
  Breaking: `createSlotReorderAction`, `slotReorderContribution`, `slotReorderBinding`,
  `SLOT_REORDER_ACTION_ID`, and `reorderBindings` are gone. Use `createReorderAction`,
  `reorderContribution`, `reorderBinding`, and `REORDER_ACTION_ID` (`'diagram.reorder'`), whose
  `slots` now also hears the press point. `createReorderAction` no longer takes a report callback;
  `groupReorderContribution(report)` is what `onReorder` installs. A move's `commit` hears `order`
  beside `id`, `from`, and `to`, and an item lands in the gap nearest its middle rather than the
  pointer.
- e30f4df: `DiagramView` can hold DOM against its nodes, groups and edges, report what the pointer is over, and let a group's members be dragged into a new order. All three are additive.
  
  - `overlays` places each `DiagramOverlay` against its target after every paint: centered on it, or beside it through geom's `placeRect`, flipping inside the view. An edge's place is the midpoint along its route. The view now renders a box around its canvas to hold them, and `className` goes on that box rather than on the canvas.
  - `onHover` reports the node, group or edge under the pointer; `pickEdges` lets a click or a hover land on an edge whatever editing callbacks are set. `rectOf(id)` and `subscribeFrame` on the ref give a target's client rect and when to read it again.
  - A `DataGroup` with `reorder: 'x' | 'y'` lets `onReorder` drag any member along that axis, carrying everything inside a member that is a group, or step the picked one with Alt and an arrow key. It reports `{ group, order }` and moves nothing. `layered` keeps such a group's members in the order given across every rank instead of sorting them by crossings. `createReorderAction`, `createStepReorderAction`, `reorderBindings` and `reorderContribution` are exported for use outside `DiagramView`.
  
  `SceneCanvas` takes `onHover`, called when the topmost pickable node under the pointer changes. `@weasel-js/react` exports `adoptCss`, `adoptCssOnce` and `styleRootOf`, the stylesheet adoption core's canvas and `KitSettingsFromPrefs` now share.
- e7ba51a: Diagram themes. A `DiagramTheme` holds a style per role (`DIAGRAM_ROLES`: default, accent, muted, positive, warning, negative), connector and label colors, container and lane looks, a page color, a font, and a color series. `DIAGRAM_THEMES` ships `paper`, `night`, `blueprint`, `pastel`, and `mono`, and `diagramThemeFromTokens(read)` builds one from resolved `--wzl-*` values.
  
  - A theme writes literal colors into the scene. `applyDiagramTheme(scene, theme)` recolors every shape, text row, group, connector, and label and saves the theme as the `diagram:theme` document value, as one undo entry; `themeWrites` is its pure half, and `diagramThemeOf` reads the value back.
  - `DiagramNode` and `DiagramEdge` gain `style` (a role id) and `ownStyle` (the colors set by hand, which a theme leaves). `setDiagramStyle` names a role and recolors in it; `setDiagramColor` sets a fill, stroke, or text color by hand. `diagramStyleOf` reads either back.
  - `DiagramSceneOptions.theme` draws each `DataNode` in its new `style` role, and edges, groups, labels, and text in the theme. `stencilBuild` and `useStencilInsert` take `font`. `roleStyle`, `roleEdgeStyle`, `themeEdgeStroke`, `themeFont`, `themeLabelFont`, and `themeLabelStyle` turn a theme into what the insert paths take.
  - The effect looks take `theme` in their options (`LookThemeOptions`; default `night`, `LOOK_THEME`), reading stage styles, lane bodies, and type colors from it. Under `night` they draw exactly as before. `typeColors` takes the series and `stageStyle` and `sceneStyles` the theme, as optional last arguments.
- 8c2a9a9: `DiagramView` takes `onResize`. With it set, a selected node shows resize handles; the box resizes
  live under the drag, and on release the view reports `{ id, x, y, width, height }` for each resized
  node and changes nothing until the specs follow. Store the box as the data node's `width`, `height`,
  and `at`; the size is a minimum, so a box dragged smaller than its rows grows back to them.
  `diagramResizable` now refuses a group's box, whose size comes from its members.
  
  Core adds `createResizeAction({ commit })`, the resize action with its commit swapped: `commit` is
  handed each resized node's pose at release, and the scene is left as it was.
- 13fc67f: An edge label can be dragged along and beside its edge. `diagramLabelDrag({ scene, selected })`
  returns a layer and a contribution: a drag on a label (`diagram.moveLabel`) stores where it was
  dropped as a fraction along the route (`at`), an offset from the line (`offset`), and
  `dodge: false`, so label placement leaves it there and it keeps its spot when the edge reroutes. A
  click on a label selects its edge, and a double-click edits its text. Locked and hidden labels do
  not drag. With no `commit` the drag writes the scene in one undoable entry; `DiagramView` reports it
  through `onMoveLabel` instead. `diagram.resetLabel` (`RESET_LABEL_ACTION_ID`) puts the selected
  edges' dragged labels back to `LABEL_PLACEMENT`, which the main entry now exports.
  
  Geom adds `PathMeasure.nearest`, the arc length along a path nearest a point.
  
  All of it is additive. weaselchart adds label dragging and Format › Connector › Reset label.
- adadf5e: Scene edit passes now compose. `scene.addEditPass(pass, { order })` runs passes by ascending
  `order` (default 0), ties in the order they were added, and each pass hears the edit's own changes
  plus every write the passes before it made; it still runs once per edit, and undo, redo, and
  history replay still run none. This changes what a second pass hears: it used to miss the first
  pass's writes. `SceneEditSummary.docChanged` lists the document-value keys an edit set.
  
  Diagram exports `DIAGRAM_PASS_ORDER`, where each of its passes runs, and avoid routing installs its
  pass at `DIAGRAM_PASS_ORDER.avoid`. The routers (`straight`, `orthogonal`, `bezier`, `avoid`,
  `ROUTERS`) moved to their own module; the package exports them as before.
- d863c74: `EffectEditor` edits wire routes under the `rack` and `lanes` looks as well as `nodeGraph`. A
  selected wire shows its route handles, and a drag reports `'Edit route'` with the route in the new
  `EffectDoc.lookRoutes`, kept by look and by wire together with where the wire's two ports were drawn.
  Since these looks move stages on every reorder or added stage, a route is drawn only while both
  ports are still there, and otherwise the look routes the wire itself. Reset route gives the wire
  back to the look. `setLookRoute`, `applyLookRoutes`, `pruneLookRoutes`, and `wireEnds` are exported
  from `@weasel-js/diagram/effect`, and so is `setWireRoute`, which the README already named.
  
  A reorder now drops the routes, under every look, of the wires it rewires or removes, so a new wire
  that takes a freed id starts unrouted. Removing a wire or a stage drops its routes under every look.
  Files saved before have no `lookRoutes` and load unchanged.
  
  weaselchart's pipeline mode gains Format › Connector › Reset route.
- b3aa7cb: `documentFromScene` exports a shape sitting in the gap between pages on the nearest page rather
  than the first, and marks a connector cross-page exactly when the scene's off-page split does. A
  connector from a gap shape to another page stays whole, keeping its waypoints in world
  coordinates. core gains `pageHolding`, the page a box is on, else the nearest one.
  diagram gains `documentBoundsOf`, the box a node has in document space, which off-page splitting and
  export now both read.
- cf036c2: Add `@weasel-js/diagram/effect-audio`, which plays an audio pipeline through a patchable `@weasel-js/audio` graph. `createLiveAudioRunner` (and the `useLiveAudioRunner` hook, or `useFollowAudioRunner` for a runner the caller makes later) edits the graph as the pipeline changes, so a delay keeps its tail when another stage is tweaked. `AUDIO_STAGE_TYPES` is the palette, `audioStageNodes` maps each stage to its graph node, and `drawScope` and `drawSpectrum` draw a stage's output into its preview. `@weasel-js/audio` is an optional peer dependency.
- 672d5cd: `EffectEditor` edits a pipeline's groups. Under `nodeGraph` each group is a titled container: drag
  a stage into or out of it, drag the box to carry what it holds (the stages, the boxes inside it,
  and the routes of wires between them, as one `'Move'`), resize it (`'Resize group'`), or
  double-click its title to rename it in place (`'Rename group'`). A resized box is stored in the new
  `EffectDoc.groupBoxes`; a group with none fits its members, so older docs load unchanged. Under
  `rack` and `lanes` groups draw as before. `selectedGroup` and `onSelectGroup` pick a group under
  every look, and the ref gains `group`, `ungroup`, and `renameGroup`.
  
  The edits are plain functions in `@weasel-js/diagram/effect`: `groupStages`, `ungroup`,
  `renameGroup`, `moveToGroup`, `setGroupBox`, `moveGroup`, `groupContents`, and `nextGroupId`.
  `removeStages` drops the box of a group it leaves empty, and no longer drops a group that was
  empty before it ran. `EditorScene` gains `groupOf`.
  
  `EffectEditor` now reports a drag's moves a microtask after `DiagramView` does, so that a group
  box's move and the stage moves it carried arrive as one edit.
- b85addf: Route-handle drags now snap through the canvas's `snap` dep instead of a private snapper: a dragged bend or segment still lines up with the stops beside it and with a port's axis within `snapPx`, and now also with the canvas's other sources, such as a grid. Ctrl suspends snapping, Shift holds a dragged bend to the axes and diagonals, and the alignment marks are drawn by the canvas's snap readout rather than as the action's own guide overlay. The edited edge offers no targets, and the canvas's default anchor snapping (`'path-snap'`) is left out for these drags. `snapPoint`, `portTarget` and `stopTarget`, and their types `SnapTarget` and `Snapped`, are removed.
- f819e61: Breaking for anyone naming ui's shape glyphs: the plain shapes move out of `@weasel-js/ui` into `@weasel-js/icons`, under a namespace of their own, so `ui:shapeHexagon` is now `shape:hexagon`, and every package may name them without depending on ui. Their table is `@weasel-js/icons/shapes`, and ui's `kitIcons` includes it. There is one new glyph, `shape:trapezoidSide`, a trapezoid on its side with its narrow end west.
  
  `ToolPalette` takes `columns`, which lays each group out as a grid that many buttons across, and `onToolDragStart`, which makes each button a drag source. `ToolGroup` takes `columns`, and `ToolButton` takes `onDragStart`.
  
  A `DiagramStencil` takes an `icon`, its tool's palette glyph, and each of `FLOWCHART_STENCILS` has one.
  
  `@weasel-js/icons-plugin` reads a workspace package's source table when the table its manifest declares is not built yet.
- ac892f8: `EffectEditor` takes `look`: `'nodeGraph'` (default), `'rack'`, or `'lanes'`, with that look's options. Under rack and lanes, connecting, reconnecting, and deleting work as under node graph, and a stage on the main line drags along it to another place, which rewires the pipeline (`'Reorder'`). Under lanes a lane drags by its label (`'Reorder lanes'`). `editorScene(doc, look, options)` replaces the node-graph-only signature, which is breaking for a caller that passed options second.
  
  The effect model gains `chainLinks`, `moveInChain`, and `canMoveInChain`; `EffectDoc.laneOrder` with `setLaneOrder`; `laneTypeOf`; and `order` and `laneOrder` on `EffectLookResult`, which `rack` and `lanes` fill. `@weasel-js/diagram` adds `createSlotReorderAction`, `slotReorderContribution`, and `sequenceSlots`, which drag one item of any drawn sequence along its axis and draw an insertion bar. Core's overlay strokes and routing's `OverlayRole` add the `insert` and `refused` roles that bar draws in.
- Updated dependencies [70b12d1]
- Updated dependencies [ca1f524]
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
- Updated dependencies [312eb35]
- Updated dependencies [7ffc196]
- Updated dependencies [25a112b]
- Updated dependencies [4d99526]
- Updated dependencies [853ce69]
- Updated dependencies [8c1861a]
- Updated dependencies [6440997]
- Updated dependencies [44cf2c5]
- Updated dependencies [8ff750f]
- Updated dependencies [161c9c4]
- Updated dependencies [33fa471]
- Updated dependencies [2eb0370]
- Updated dependencies [c726003]
- Updated dependencies [e30f4df]
- Updated dependencies [8c2a9a9]
- Updated dependencies [1156d63]
- Updated dependencies [13fc67f]
- Updated dependencies [adadf5e]
- Updated dependencies [b3aa7cb]
- Updated dependencies [50da815]
- Updated dependencies [ee2f0fc]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [0e24110]
- Updated dependencies [0f455dc]
- Updated dependencies [4bf5dec]
- Updated dependencies [15efc86]
- Updated dependencies [fe2a8c5]
- Updated dependencies [b7e6edc]
- Updated dependencies [c29ac84]
- Updated dependencies [87cded1]
- Updated dependencies [07b686c]
- Updated dependencies [24267d3]
- Updated dependencies [041bc38]
- Updated dependencies [683dea0]
- Updated dependencies [61e7b0c]
- Updated dependencies [f819e61]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [8f2c044]
- Updated dependencies [ac892f8]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [e1eeb08]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [433540d]
  - @weasel-js/core@1.11.1
  - @weasel-js/audio@1.11.1
  - @weasel-js/animator@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/react@1.11.1
  - @weasel-js/font@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/simulation@1.11.1

## 1.11.0

### Patch Changes

- 4447e67: A canvas host given no `width`/`height` fills its parent and follows it as it resizes: `Canvas`,
  `SceneCanvas`, `LeanSceneCanvas`, `DrawCanvas`, `SceneViewCanvas` and `MinimapCanvas`, each with a new
  `onResize` reporting every size. Nothing paints until the first measure. On a resize the view keeps
  its transform, so more or less of the world shows; `DiagramView` and `EffectChart` refit until the
  user pans or zooms, and `MinimapCanvas` refits its overview. `DrawCanvas`'s `draw(size)` gets the
  measured size. Core exports `SurfaceSizeProps` and `viewportWorldRect`; labkit's
  `TrialSceneCanvas` fills through `SceneCanvas` instead of measuring its own trial.
  
  `createGridLayer`'s `bounds` is now optional and receives the paint's view and canvas size. Omitted,
  the grid covers whatever the canvas shows, its lines held on world multiples of `spacing` as the view
  pans, and any set of lines that would sit closer than 4px on screen is left out.
- e3637c9: EffectChart fixes and additions:
  
  - `rack` widens a stage on its line so the side ports along its top or bottom sit at least `SIDE_PORT_GAP` (24) apart, however many there are.
  - Branch symbols take `{ controlSide, style, tints }`. `rack` passes `controlSide: 'bottom'` with `side: 'below'`, so a control wire comes straight up from the stage driving it; a symbol's title then moves above it, and a diamond takes control in by its lower-left edge, keeping its bottom vertex for the second exit. A symbol's lines, dots and ticks take the `text` color of `style` (default `stageStyle(stage)`), so a bypassed decision draws dim and a look can restyle it; a bar's bands take `tints`.
  - `EffectLook`'s options parameter defaults to `never` rather than `unknown`, so `[nodeGraph, rack]` is an `EffectLook[]` without a cast. Breaking for code that called a plain `EffectLook` with options: give it the options type, `EffectLook<MyOptions>`.
  - `EffectChart` takes `minScale`, default `EFFECT_MIN_SCALE` (0.5), so a large chart opens readable at its start instead of fitted whole and tiny.
  - Under a run, a `switch` symbol is thrown to the output the decision took, and `EffectChart` fades the port dots of stages the run never reached.
  - `edgeIdOf` escapes `.`, `>`, `:`, `/` and `\` in an edge's ends, ports and label with a backslash, so two different edges never share an id. Breaking for code that built an edge id by hand for ids, ports or labels holding those characters; use `edgeIdOf`.
- 29a90e3: `edgeIdOf` tells an empty-string port or label apart from none: `{ from: 'a', fromPort: '', to: 'b' }` is `edge:a.->b`, no longer `edge:a->b`, and an empty label adds a trailing `:`. Two such edges used to share an id, so `diagramScene` drew only the first.
- 9c24f2b: `onMove`'s `EdgeRoute` now carries `ports`, the ports a layout run named, and an edge is reported
  when only its ports change. Store them as the new `DataEdge.routedPorts`, which `edgeIdOf` does not
  read, so storing them no longer renames and replaces the edge. Breaking for code that builds an
  `EdgeRoute` or assumes a reported route always has new waypoints.
  
  A live run eases routes for every layout, `force` included, and each eased frame draws an edge
  through the ports the run will commit, so an edge that changes faces no longer jumps on arrival. An
  edge to a group reads the group's box from the same frame.
  
  `layered` holds far more pins: a pin's band slides or deepens to cover it, the gaps toward other
  pinned ranks shrink together, a node with no room between two pins moves past one, and a group's
  column moves or widens as one so no outsider lands in its box. `LayeredPlan.unheld` is left for
  pins no arrangement can reach.
  
  `chain` routes an edge between a chain node and a node hung beside it on a track of its own, orders
  the hung row by the ports it connects to, and grows the gap to keep tracks 12 apart, so a fan of
  side stages into one `rack` stage never crosses. `rack`'s spread side ports face straight out.
  
  The `lanes` look routes a wire around the stages in its lane, each wire in a shared corridor on its
  own track, places labels clear of every stage, and keeps a decision's title and cut values inside
  its lanes and column. `EffectChart` picks only stages, so clicking a lane or group box no longer
  leaves it highlighted.
  
  A perimeter port can carry a `label` (`PortSpec.label`, or `portLabels` by port id on a `BodySpec` or
  `DataNode`), drawn outside the node beside its wire. Layout lays each node out at its bounds grown by
  the room its labels take (`DiagramNode.margin`, `GraphNode.margin`), and a group's box takes it in.
  A port's alternative `sites` may carry their own `normal` (`PortSite`).
  
  `diagramLayoutOf(specs)` reads where a `diagramScene` build's layout put each unpinned node, and the
  routes and ports it wrote, in `onMove`'s shapes, so a host can keep a diagram still across edits.
  
  Under `layered`, an edge between two nodes that pins leave level along the rank axis runs straight
  between their facing sides, or around past both when a node sits between them, instead of looping
  round.
- 72a0ea2: `layered` reads a port where `portsOf` puts it on the node's outline rather than at its anchor, and reads a port with several places at the one nearest where the wire's other end falls among the node's wires on that side, while ordering, rather than at their mean. `GraphNode` carries the node's `outline`.
  
  The compass ports `diagramScene` names under `layered` are marked as layout's: an `EdgeEnd` records the port layout named as `laidOut` (`layoutOwnsPort`), and `LayoutPlan.ports`, which `layeredPlan` now fills, carries them to `routesOf` and `routeWrites`. A later layout names an end again while it names no port or still names that one, so an edit that turns which way an edge runs no longer leaves it leaving by the old face. A live `layered` run or the layout action now names ports on a hand-built scene's edges that name none, as `diagramScene` does.
  
  Breaking: `DiagramLabel`'s `at: { waypoint: k }` is replaced by `at: { near: { x, y } }`, which stations a label where its route passes nearest that point, so a bend added or removed before it leaves it on its stretch. `LayoutPlan.labels`, `LayeredPlan.labels` and `LayeredRoute.labelAt` carry that point instead of a waypoint index.
  
  A group box `diagramScene` makes depends on the labels of the wires with both ends inside it, so a long label no longer spills out of it.
  
  A live eased run eases each route it will write along with its nodes, published as the edge's path on the override channel, rather than drawing long edges through their old bends until it arrives.
  
  Core: `moveSources` and `shapeSources` no longer hand back a node that derives only its path when they reach it through a derived node, so moving or turning a group box that depends on a wire's label does not write the wire's placeholder pose.
- 4f7c861: A live layout and `DiagramView`'s `layout()` take a `LayoutPlanner`: an object whose `plan(graph, opts)` answers with a whole `LayoutPlan`, now or as a promise. The run asks it once, with the graph as it stands, and eases to the answer as it eases to `layered`'s, with the same route easing and the same moves, routes and ports reported to `onMove`. While the answer is pending, a newer request, `cancel`, `stop`, or a graph that moved or changed drops it, and `isRunning()` is true. A change of shape mid-run asks the planner again. A planner that rejects starts no run and reports the reason to the new `onError` option (`DiagramView`'s `live.onError`), or to `console.error` when that is unset; it is never left an unhandled rejection. `plannerPlan` lays a planner's graph out by footprint the way `planOf` does, and `DiagramLayout` names what `layout()` takes. `DiagramView` now fits again once a layout run settles, while the view is still its fit. `@weasel-js/diagram-elk` adds `elkPlanner(opts)`, ELK as a `LayoutPlanner`. Additive.
- b919c0d: `EffectChart` has two more looks, both in `EFFECT_LOOKS`. `lanes` gives each value type a horizontal lane and stands each stage across the lanes of the types it reads and writes, as tall as they are, with each port in its own type's lane; lanes grow until what stands in them fits (`lanes`, `laneHeight`, `rankGap`, `router`, `colors`, `showParams`, `showValues`, `branch`, `measure`; `laneId`, `LANE_INSET`). `compact` draws each stage on one line with no ports drawn and one line between two stages however many wires join them, a decision as a one-line hexagon by default with a line per exit (`router`, `nodeGap`, `rankGap`, `colors`, `branch`; `COMPACT_PADDING`). It shows no params or value rows.
  
  Five more branch symbols: `'hexagon'`, `'step'`, `'comparator'`, `'crossover'` and `'fork'`, a bare dot whose conditions sit on its wires. `'step'` and `'crossover'` need a sound `split` and `'comparator'` exactly two outputs; each draws a diamond otherwise. `wireEdges(pipeline, color)` builds the port-to-port edges `nodeGraph` and `lanes` draw. Additive.
- ffd8829: A hidden or locked node shows no ports. `sceneParticipants` marks each participant `hidden` or `locked` from the scene's `nodeGates`, and the port layer neither draws nor hits a marked participant's ports, and a connect never lands on one. A node is hidden by its own flag, an ancestor's, or a hidden layer; locked by its own lock, an ancestor's, or a locked layer. `ParticipantPose` gains the two optional fields, so a hand-written participant source can set them too. The graph still reads every participant, so layout places a hidden node as before.
- 14b7551: Chrome now stays off a layer the view hides with `layerVisibility` or leaves out of `layerOrder`, not only off a layer the scene itself hides. In a `<CanvasView>` panel that hides a layer, a node on it that is selected on the surface shows no outline, resize or rotate handles, path anchors, or warp handles there, and none of them can be grabbed there. A diagram's ports are not drawn on such a layer, a press there does not grab one, and a connect drag started in that view does not land on one.
  
  To make that possible, `ChromeState` carries `layerIsPainted(layerId)` for the view it was built for, the same answer `ViewApi.layerIsPainted` gives, and its `selection` leaves out ids on a layer that view does not paint (`multiActive` and `unionBounds` follow). `buildChromeState` takes `layerIsPainted` and `layerOf` for this, and a view reads each id's layer through its adapter's `getNode`. `paintsLayer(gate, layer)` is the one test every piece of chrome uses: `gate` is a `ChromeState` or a `ViewApi`. In the diagram package, `sceneParticipants` reports each participant's `layer`, and `offersPorts` takes the view as a second argument. Additive.
- eec8a5b: An `EffectRun` can carry a picture per output: `previews: { [port]: ImageBitmap }` on a stage's entry. A look's `showPreviews` option (on `nodeGraph`, `rack` and `lanes`) keeps a slot per output, `previewSize` big (default `PREVIEW_SIZE`, a 48-unit square, or `{ width, height }`), laid out from the first draw so a run filling it never lays the chart out again. Until a run fills a slot it draws as an empty frame, and it fades with its stage. `paintRun` fills it by a data edit, so a run that hands back the same bitmap writes nothing to the scene and uploads nothing; `EffectChart` frees the texture of a bitmap the next run no longer shows, and of every one it shows when it unmounts. `RunRowOptions` is the shared type of `showValues`, `showPreviews` and `previewSize`, and `previewRowId(port)` names a slot.
  
  `bitmapSrc(bitmap)` (renderer, re-exported by core) names an `ImageBitmap` made at runtime as an image `src`, so an image node draws it with no load. The same bitmap always gets the same name; the cache holds it weakly and never drops it to fit its budget, and `releaseImage` frees its textures and retires the name.
  
  A body's `slot` row takes a `width`: the body is at least that wide and the slot's box is that wide, centered. In `diagramScene`, a slot with an `id` becomes a scene node of that name, an empty frame, ready to be filled by a data edit. `DiagramSceneData` gains `image`.
  
  `lanes` widens a source or sink stretched taller than it measured, so its round ends no longer eat into its rows.
- 16b7ad7: A custom `Path` outline is drawn in a unit square and stretched over its node's box, as a mark's path data is, so it follows its node when layout or a drag moves it. Breaking: a `Path` outline built in world coordinates now has to be rebuilt in the unit square.
  
  `diagramScene` parses each drawn mark's `d` as it builds the scene and throws on path data that does not parse or draws nothing, naming the node and the mark's index, rather than painting a truncated path or nothing at first paint.
  
  `DiagramView` fits its view again when `width`, `height` or a fit option (`minScale`, `maxScale`, `anchor`, `fitPadding`) changes, as long as the view is still the fit it last applied; once the user pans or zooms, a resize leaves the view where they put it. The refit reaches `onViewChange`.
  
  `DiagramView`'s `onMove` takes a second argument: every edge whose route a layout run rewrote, as `EdgeRoute` (`{ id, waypoints }`, with `id` the edge's `edgeIdOf` and `waypoints` empty when the run left it straight). Stored as the data edge's new `routed` field, a route survives the data being laid into a scene again and stays layout's to replace; `waypoints` still means the author's own route.
- a988460: `EffectChart` draws a run of its pipeline.
  
  - **`run` prop.** An `EffectRun` sits beside the pipeline, keyed by stage id: each stage's `cost`
    in milliseconds, a decision's `taken` output, and each output's `values` as text. The chart
    fades a stage the run never reached and its wires, fades a decision's wires to outputs it did
    not take, writes each cost above its stage's corner, and fills in value rows. A run edits the
    scene in place: no new layout, no refit, and only the changed fields are written, so it may
    change every frame. `paintRun` and `costText` are exported for a chart of your own.
  - **`showValues`** on `nodeGraph` and `rack` keeps a row per output for a run's value
    (`valueRowId`, `NO_VALUE`).
  - **Breaking:** `stageRows(stage, showParams, withPorts)` is now
    `stageRows(stage, { showParams, withPorts, showValues })`.
  - **Body rows.** A `label` or `field` row may carry an `id`, which names its scene node
    `<body id>/<row id>` so it can be found again; and a `field` may carry `room`, a value it is
    measured at least as wide as.
  - **`EffectLookResult.exits`** maps the edges that stand in for a decision a look does not draw,
    such as `rack`'s skip arcs, to the exit each one is, so a run's `taken` reaches them.
  - **Renderer:** text now honors a solid fill's `opacity`, in its glyphs, its color glyphs (emoji)
    and its decoration rules. It was ignored, so faded text drew at full strength.
- a083eaf: `@weasel-js/diagram/effect` is new: `EffectChart` draws an effects pipeline given as plain data, with stages, the typed ports each reads and writes, the wires between them, and groups. How the pipeline is drawn is a look, a function from a pipeline to what `diagramScene` takes; `nodeGraph` gives every port a named row and `rack` runs the main signal along one line with the rest hung beside it. `EffectChart` takes the pipeline, which it compares by content, a look, the look's options, a size, a `background` paint, and the usual `selected` / `onSelect`, and reports `checkPipeline`'s findings through `onProblems`. A stage that sends the signal one of several ways draws as a branch symbol (`diamond`, `bar`, `demux`, `switch`), and one with `split` draws its cut values as ticks on a bar. `checkPipeline` reports a wire that names a missing stage or port, runs the wrong way, or joins two types, a repeated stage, port or group id (`duplicate-group` for a group whose id repeats another's or a stage's), and the other ways a pipeline can be wrong.
  
  For writing a look, the entry also exports what the shipped looks are built from: `uniqueStages`, `uniqueGroups`, `drawableWires` and its `DrawableWire` type, `stageRows`, `exitLabel`, `stageStyle`, `wireStyle`, `isControl`, `kindOf`, `portOn` and `PROBLEM_COLOR`.
  
  The rest is additive in `@weasel-js/diagram` itself, and nothing existing changes:
  
  - `DiagramView` takes `ports="show"`, to draw ports with nothing to connect.
  - `portOptions.fill` may be a function of the port.
  - `portOptions.shape` may be `'circle'`.
  - `portOptions.showsPort` picks which of a node's ports show; `createPortAffordance` takes the same option, and `createConnectAction` takes it to keep a connect from landing on a hidden port.
  - `'trapezoid'` is an outline.
  - A data node takes `marks`: shapes in a unit square stretched over its box, and text pinned to a point on it. `diagramMarkOf`, `markShape`, `registerMarkShape` and the `DataMark` and `DiagramMark` types are exported.
  - `chain` is a layout, exported and accepted by name as `layout: 'chain'` in `diagramScene`, `layout('chain')` on a `DiagramView` and `algorithm: 'chain'` in `createLayoutAction`. It stands one run of nodes on a line and hangs the rest beside it; the `chain` and `chainSide` layout options pick the run and the side, and the run is the longest path when `chain` is unset or names no node.
- 4af4627: `layered` builds the layout around every pinned node, not only the first. Each pin after the first
  keeps its place across its rank, with the rest of the rank pushed clear of it, and the gap on the
  first pin's side of its rank stretches or shrinks to reach it, so a long edge no longer runs through
  a second pin and a re-run moves nothing. A pin it cannot reach — one that would shrink a gap below a
  quarter of `rankGap`, or that has too little room beside another pin in its rank — is laid out
  around as before and named in the new `LayeredPlan.unheld`.
- 6812344: `layered` routes long edges and leaves labels room on a live scene too.
  
  - **Under `order: 'seeded'`.** An edge spanning ranks now stands in each rank it crosses and a
    labeled edge gets a rank of its own, as under `'barycenter'`. An edge keeps its place in a rank
    the way a node does, from where its route crosses that rank now (`GraphEdge.waypoints`, which
    `buildGraph` fills in), so a second run still moves nothing. This changes where a seeded layout
    puts nodes in any graph with a long or labeled edge.
  - **Written to the scene.** The layout action and a live `layered` run write each long edge's
    waypoints, and station its label in the room left for it, in the same undo entry as the moves.
    `buildGraph` reads a scene label's size as its edge's label room.
  - **Whose route it is.** `DiagramEdge.laidOut` records the waypoints layout wrote, and layout
    rewrites a route only while the edge's waypoints still match them (`layoutOwnsRoute`). An edge
    someone has bent, and the label on it, are left alone, and get no room in the ranks the edge
    crosses (`GraphEdge.authored`); so is a label put at `'start'`, `'end'` or a fraction.
    `diagramScene` marks the routes it lays out the same way. A layout that routes nothing
    (`tree`, `force`, `chain`) takes layered's routes back off.
  - **`diagramScene`.** A label whose edge sets `labelPlacement` at `'mid'` now gets room beside
    its wire like an unplaced one, at that placement's offset. Routes come from any layout with a
    `plan`, not only `layered`.
  - **Locked layers.** `applyLayout` skips a node, edge or label on a locked layer instead of
    throwing.
  - **New surface.** `LayoutFn` may carry a `plan` returning `LayoutPlan` (`moves`, `waypoints`,
    `labels`); `layered.plan` is `layeredPlan`, and `planOf` reads any layout's. `routesOf` and
    `routeWrites` turn a plan into scene edits, and `applyLayout` takes them as `routes`.
    `usePoseRun` takes `commitWith`, writes of the caller's own made inside the commit's batch.
  - `expand`'s `placeholders` and `labels` options are gone; it always adds both.
- 89229df: `layered` reads ports and leaves labels room.
  
  - **Ports.** The layout graph carries each node's ports (`GraphNode.ports`) and the ports an edge
    names (`GraphEdge.fromPort`, `toPort`); `buildGraph` and `diagramScene` fill them in. Ordering
    reads each wire at the port it joins, so wires into one node arrive in the order of its ports,
    and placement lines up the two ports a wire joins rather than the two centers.
  - **Port places.** A `PortSpec` may list other places it can sit in `sites`. An edge meeting the
    port takes whichever place faces its next point; `portSitesOf` resolves them all. The decision
    diamond's second exit may now leave by its top vertex as well as its bottom.
  - **Label room.** Under `order: 'barycenter'`, an edge whose `GraphEdge.label` gives its label's
    size gets a rank of its own between its ends, with room beside its wire. `layeredPlan` reports
    where (`labels`), and `diagramScene` sets each label there unless its edge sets
    `labelPlacement`. `DiagramLabel.at` takes `{ waypoint }`, a place between two of the edge's
    waypoints.
  
  Behavior changes: a diagram with labeled edges laid out by `diagramScene` is taller (or wider)
  than before, and lands in a different place. Inside a group, `layered` keeps each member where
  placement lined it up instead of centering each rank in the group's column. An edge end with no named port now aims at the
  edge's first or last waypoint, not the other node, when it has waypoints. A smooth (`bezier`)
  route passes two waypoints level on one axis along that axis.
- 298b28b: `layered` lays diagrams out differently, so a diagram laid out before this lands somewhere else
  after it. Ranks keep edges as short as they can (network simplex, exported as `ranksByLength`),
  so a node with no inputs sits beside what it feeds instead of in the first rank, and nodes are
  lined up with their neighbors across ranks (Brandes–Köpf) instead of packed and centered. Under
  `order: 'barycenter'`, which `diagramScene` uses, an edge spanning ranks stands in each rank it
  crosses, so ordering counts its crossings and placement leaves it room; ordering also swaps
  neighbors to clear crossings and keeps the best order it finds. An edge closing a cycle is turned
  around for layout, so it gets a route too.
  
  New `layeredPlan(graph, opts)` returns the moves with each node's rank and each spanning edge's
  waypoints; `diagramScene` draws those edges through them. `LayeredRouteInput` changes shape: it
  takes `ranks` and `waypoints` from a plan in place of `graph`, `boxes` and `clearance`.
  `GraphEdge` gains an optional `origin`, the edge as drawn, on edges `expandGroupEdges` made for
  an edge to or from a group.
- 36eca7a: Breaking: `useAnimator` moved to `@weasel-js/animator/react`; the root entry has no React. `@weasel-js/core/math` no longer reaches routing or animator in its types. geom exports `FramedBox`. New `@weasel-js/font/metrics` entry carries `parseBmFont`, the face-metric readers and `cssFamilyName` with no DOM in its types, and `@weasel-js/diagram/layout` measures through it, so neither it nor `@weasel-js/diagram-elk` needs a browser. `faceMetricsOf` takes any value with `entry` and `outlineFace`, a `ResolveResult` included.
- 0430dcc: Every type a public signature names is now exported, so the API reference links it. Signatures that named a file-local point alias (`Pt`, `XY`, `Vec`) take geom's `Point`, and ones that named a local `AnyScene` or `AnyNode` say `Scene<unknown, string, unknown>` or the node type outright. Newly exported: core's `AnnotationFlag`, `AnchorEdit`, `JoinPlan`, `PathEditPreview`, `PathStorageKind`, and `ViewPoseAdapter`; diagram's `RoutedScene`; prefs' `UsePrefsStoreOptions`; symmetry's `SymmetryKindDef`; path-tools' `WarpToolOptions`; and ui's `SceneLayerListProps`.
- Updated dependencies [304f53a]
- Updated dependencies [3ffe020]
- Updated dependencies [b882b2e]
- Updated dependencies [60d8e39]
- Updated dependencies [6a53aaa]
- Updated dependencies [193ba96]
- Updated dependencies [09c3e5f]
- Updated dependencies [535aaaa]
- Updated dependencies [ed0e096]
- Updated dependencies [6f839dd]
- Updated dependencies [327fb63]
- Updated dependencies [5338358]
- Updated dependencies [7116c36]
- Updated dependencies [1c76897]
- Updated dependencies [4447e67]
- Updated dependencies [84dd318]
- Updated dependencies [e0608bf]
- Updated dependencies [b0f392c]
- Updated dependencies [cf7b009]
- Updated dependencies [6072e93]
- Updated dependencies [53ba41a]
- Updated dependencies [1322a03]
- Updated dependencies [7162a7a]
- Updated dependencies [765cd31]
- Updated dependencies [89271a6]
- Updated dependencies [72a0ea2]
- Updated dependencies [14b7551]
- Updated dependencies [eec8a5b]
- Updated dependencies [1774dc4]
- Updated dependencies [8ff3b4b]
- Updated dependencies [02cbe1d]
- Updated dependencies [d2749ce]
- Updated dependencies
- Updated dependencies [8374354]
- Updated dependencies [5b20cca]
- Updated dependencies [516914b]
- Updated dependencies [6525caa]
- Updated dependencies [f4dd2ff]
- Updated dependencies [5adbb76]
- Updated dependencies [0382007]
- Updated dependencies [d0daf94]
- Updated dependencies [63b310c]
- Updated dependencies [ebb8804]
- Updated dependencies [c6a0a52]
- Updated dependencies [6812344]
- Updated dependencies [fb75358]
- Updated dependencies [ef6b6ae]
- Updated dependencies [e4642bb]
- Updated dependencies [e901a2b]
- Updated dependencies [57725cc]
- Updated dependencies [3f89d6b]
- Updated dependencies [86725ed]
- Updated dependencies [f34b290]
- Updated dependencies [679138c]
- Updated dependencies [7cbedd8]
- Updated dependencies [c17c978]
- Updated dependencies [a2dcbfb]
- Updated dependencies [a4c99c1]
- Updated dependencies [c53b0ae]
- Updated dependencies [8775065]
- Updated dependencies [d4d28ad]
- Updated dependencies [ad8f48a]
- Updated dependencies [5274f79]
- Updated dependencies [c4840ed]
- Updated dependencies [616a4b2]
- Updated dependencies [0677769]
- Updated dependencies [974682d]
- Updated dependencies [66e3696]
- Updated dependencies [5973184]
- Updated dependencies [7afe8cd]
- Updated dependencies [3378ade]
- Updated dependencies [71c079d]
- Updated dependencies [c0d59c6]
- Updated dependencies [f426089]
- Updated dependencies [dcca70c]
- Updated dependencies [420e4b2]
- Updated dependencies [bfb566c]
- Updated dependencies [d019f44]
- Updated dependencies [79b65f5]
- Updated dependencies [cc54285]
- Updated dependencies [e021579]
- Updated dependencies [5f12888]
- Updated dependencies [d18df3e]
- Updated dependencies [46c731d]
- Updated dependencies [36eca7a]
- Updated dependencies [cc11671]
- Updated dependencies [c1680fd]
- Updated dependencies [0430dcc]
- Updated dependencies [39f86d1]
- Updated dependencies [f3398d4]
- Updated dependencies [86a5ec7]
- Updated dependencies [c2048de]
- Updated dependencies [e562d4b]
- Updated dependencies [9073669]
- Updated dependencies [798e9b0]
- Updated dependencies [f082c83]
- Updated dependencies [db8c16e]
- Updated dependencies [e287da2]
- Updated dependencies [4df0749]
- Updated dependencies
- Updated dependencies [365ab72]
- Updated dependencies [3eb2abc]
- Updated dependencies [e554ae5]
- Updated dependencies [70fe7cc]
- Updated dependencies [c4e499e]
- Updated dependencies [ecdf4d0]
- Updated dependencies [7a31f9d]
- Updated dependencies [4cec295]
- Updated dependencies [1efa251]
- Updated dependencies [1faab2d]
- Updated dependencies [15fbffb]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
- Updated dependencies [ebc9858]
- Updated dependencies [329aa39]
- Updated dependencies [06d23a3]
- Updated dependencies [d8160be]
  - @weasel-js/core@1.11.0
  - @weasel-js/geom@1.11.0
  - @weasel-js/animator@1.11.0
  - @weasel-js/font@1.11.0
  - @weasel-js/simulation@1.11.0

## 1.10.1

### Patch Changes

- cdf60a1: `DiagramView` pans on a drag that starts on empty canvas, as its docs say. The select tool behind picking marquee-selected on that drag, and as the active tool's binding it outranked the view's drag-pan, so the view never moved. The diagram picks one node at a time, so it drops the marquee; a click on empty canvas still clears the pick.
- 00f60ff: `diagramScene` routes a `layered` diagram's edges. An edge running down the ranks leaves its source by the face toward the next rank and arrives at its target's face toward the last, where it used to take whichever side faced the other end, and an edge that skips ranks gets waypoints through the gaps in each rank it crosses, so it goes around the nodes and group boxes in its way. An author's `fromPort`, `toPort` and `waypoints` win; an edge running back up the ranks, and every other layout, keep the facing rule. `layeredRoutes` is the pass on its own.
  
  The `bezier` router passes a waypoint without a corner; it used to draw each leg between two waypoints as a straight line.
  
  A group's box fits its label. `DiagramGroup` gains `minWidth`, which `diagramScene` sets from the label, `groupDerivePose` widens the box to evenly, and `layered` and `tree` leave room for in a layout running down or up; `GraphGroup` carries it too, and `boxAround` is the box rule on its own.
  
  Breaking: a label's `offset` is the gap between the route and the label's near side, where it was the distance to the label's center, so a label beside a vertical edge no longer straddles it.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- Updated dependencies [113c088]
- Updated dependencies [cbd5b4d]
- Updated dependencies [d3b73b9]
- Updated dependencies [aaa2b4f]
- Updated dependencies [c7b7ed5]
- Updated dependencies [faf8ff3]
- Updated dependencies [8bee821]
- Updated dependencies [3fda6e6]
- Updated dependencies [67a7de8]
- Updated dependencies [f6e3e90]
- Updated dependencies [74ba77e]
- Updated dependencies [a8e8048]
- Updated dependencies [755b7ff]
- Updated dependencies [1d3ca5c]
- Updated dependencies [566f15e]
- Updated dependencies [ee59ccd]
- Updated dependencies [f22f5ce]
- Updated dependencies [92e6291]
- Updated dependencies [2216d1b]
- Updated dependencies [a7144f4]
- Updated dependencies [35c4879]
- Updated dependencies [9eefcc7]
- Updated dependencies [886380f]
- Updated dependencies [f8faa63]
- Updated dependencies [3bc85c9]
- Updated dependencies [d8b51a4]
- Updated dependencies [d0c3896]
- Updated dependencies [3448831]
- Updated dependencies [27fe0fb]
- Updated dependencies [8bbf878]
- Updated dependencies [b5267f9]
- Updated dependencies [62e766c]
- Updated dependencies [5485d35]
- Updated dependencies [690ea72]
- Updated dependencies [ab9ea7a]
- Updated dependencies [e962494]
- Updated dependencies [bad37cf]
- Updated dependencies [9e84e5d]
- Updated dependencies [bd6c203]
- Updated dependencies [ef29364]
- Updated dependencies [2f48645]
- Updated dependencies [92c2e8e]
- Updated dependencies [711ae46]
- Updated dependencies [365eae0]
- Updated dependencies [781a15e]
- Updated dependencies [a092978]
  - @weasel-js/core@1.10.1
  - @weasel-js/geom@1.10.1
  - @weasel-js/animator@1.10.1
  - @weasel-js/font@1.10.1
  - @weasel-js/simulation@1.10.1

## 1.10.0

### Patch Changes

- 96a63de: add `@weasel-js/animator`: the animator moved out of core. `useAnimator`, `createTarget`, `createTargetTable`, the timeline tracks and `sampleTrack`, the skeleton math (`resolveSkeleton`, `skeletonAxes`, `jointAxes`, `solveIk`, `mirrorPose`, `IDENTITY_JOINT`), the vertex-color helpers and `ColorOverrideRegistry`, `createSlew`, and every animator type (`Animator`, `AnimationHandle`, `TimelineHandle`, `Target`, and the rest) are exported from it and no longer from `@weasel-js/core`. Breaking: import those names from `@weasel-js/animator`. It needs geom, paint, react, and registry, and nothing of the scene.
  
  core keeps what moves a scene with it: `tweenPose`, `springPose`, `staggerSpringPose`, `createPoseTarget`, `momentum`, the `animate*` adapter wrappers, `useAnimatedReflow`, `bindRig`, and `useRig`, and still exports the easings from geom. The animator also exports `axesOf`, which gives the axes of a number, an array of numbers, or an object of numeric fields.
  
  `@weasel-js/ui`, `@weasel-js/diagram`, `@weasel-js/d3`, `@weasel-js/minimap`, and `@weasel-js/labkit` take the animator as a peer beside core. labkit leaves it out of its bundle, as it does core: the animator keeps its record of each target in module scope, so an app has to hold one copy.
- 3603da3: The force layout takes `createSimulation` and its types from `@weasel-js/simulation`, where they live, and no longer through `@weasel-js/core/math`. `@weasel-js/simulation` is a new peer dependency of `@weasel-js/diagram`.
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
- Updated dependencies [dfc0dda]
- Updated dependencies [cd8cbbd]
- Updated dependencies [1f7548d]
- Updated dependencies [a86d79f]
- Updated dependencies [ad15c29]
- Updated dependencies [90eae1c]
- Updated dependencies [96a63de]
- Updated dependencies [7140b5a]
- Updated dependencies [8e00180]
- Updated dependencies [fc267f3]
- Updated dependencies [9f5cdb2]
- Updated dependencies [b9fb732]
- Updated dependencies [67f4d79]
- Updated dependencies [d137eaf]
- Updated dependencies [1837952]
- Updated dependencies [99553f7]
- Updated dependencies [5149cce]
- Updated dependencies [2c6246d]
- Updated dependencies [de60e10]
- Updated dependencies [2892438]
- Updated dependencies [b310df0]
- Updated dependencies [2a5d8ef]
- Updated dependencies [3994be7]
- Updated dependencies [e80de55]
- Updated dependencies [b3ba3d9]
- Updated dependencies [126116b]
- Updated dependencies [9296fb4]
- Updated dependencies [6ba0496]
- Updated dependencies [0e46e02]
- Updated dependencies [dee0a3b]
- Updated dependencies [b1f7521]
- Updated dependencies [e77f185]
- Updated dependencies [d675fed]
- Updated dependencies [d635e84]
- Updated dependencies [dc1f09c]
- Updated dependencies [2ed751e]
- Updated dependencies [b3f1e4a]
- Updated dependencies [329f658]
- Updated dependencies [0449330]
- Updated dependencies [4878967]
- Updated dependencies [2a141ac]
- Updated dependencies [7063584]
- Updated dependencies [06003a5]
- Updated dependencies [da0335e]
- Updated dependencies [7bac60f]
- Updated dependencies [fb715f4]
- Updated dependencies [3777548]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [1bd7fdc]
- Updated dependencies [87dd1ad]
- Updated dependencies [3bacb3e]
- Updated dependencies [6b03b7e]
- Updated dependencies [b260415]
- Updated dependencies [66d5455]
- Updated dependencies [d58d2e8]
- Updated dependencies [eb7f534]
- Updated dependencies [3adb0d9]
- Updated dependencies [7548e82]
- Updated dependencies [eb3114f]
- Updated dependencies [0a37db1]
- Updated dependencies [a275f78]
- Updated dependencies [605ace8]
- Updated dependencies [0db7e81]
- Updated dependencies [6bb8035]
- Updated dependencies [5d82ef9]
- Updated dependencies [bc15034]
- Updated dependencies [1ce19c9]
- Updated dependencies [7d94bbb]
- Updated dependencies [1c9bc4e]
- Updated dependencies [525800f]
- Updated dependencies [dcf0554]
- Updated dependencies [5c7d50f]
- Updated dependencies [bb3e633]
- Updated dependencies [be611ae]
- Updated dependencies [ca09ae2]
- Updated dependencies [33c90ed]
- Updated dependencies [8d0498c]
- Updated dependencies [b3d4383]
- Updated dependencies [a6dff38]
- Updated dependencies [27c1c86]
- Updated dependencies [54b013c]
- Updated dependencies [a8ef308]
- Updated dependencies [5996856]
- Updated dependencies [0d1c052]
- Updated dependencies [71512af]
- Updated dependencies [54174b6]
- Updated dependencies [4edad85]
- Updated dependencies [bb53d86]
- Updated dependencies [18920a4]
- Updated dependencies [9b8bd89]
- Updated dependencies [efc1205]
- Updated dependencies [b4227bc]
- Updated dependencies [6139898]
- Updated dependencies [335f192]
- Updated dependencies [f3b977a]
- Updated dependencies [df159bc]
- Updated dependencies [7b9de2d]
- Updated dependencies [485bb80]
- Updated dependencies [21b6db7]
- Updated dependencies [970f489]
- Updated dependencies [af48ee3]
- Updated dependencies [1c8c3fc]
- Updated dependencies [4d4d81c]
- Updated dependencies [ea54a64]
- Updated dependencies [8524e05]
- Updated dependencies [8ac6236]
- Updated dependencies [eafd001]
- Updated dependencies [1956417]
- Updated dependencies [955defa]
- Updated dependencies [27b827e]
- Updated dependencies [d02d059]
- Updated dependencies [74f364f]
- Updated dependencies [01d6e4e]
- Updated dependencies [32b3cc9]
- Updated dependencies [70413dd]
- Updated dependencies [fcf44fa]
- Updated dependencies [a91e5cd]
- Updated dependencies [91a479a]
- Updated dependencies [7afbc13]
- Updated dependencies [8f38287]
- Updated dependencies [936679d]
- Updated dependencies [813aea2]
- Updated dependencies [42f24c8]
- Updated dependencies [499af9b]
- Updated dependencies [8cc746f]
- Updated dependencies [a21947b]
- Updated dependencies [de07db0]
- Updated dependencies [4d3ff3f]
- Updated dependencies [85cb886]
- Updated dependencies [aed6320]
- Updated dependencies [9d11828]
- Updated dependencies [37463b5]
- Updated dependencies [3558fbb]
- Updated dependencies [fa0ecbe]
- Updated dependencies [bffba0a]
- Updated dependencies [efc5cea]
- Updated dependencies [32e243f]
- Updated dependencies [233f856]
- Updated dependencies [c9b9598]
- Updated dependencies [4b0a7d7]
- Updated dependencies [2705878]
- Updated dependencies [f59e769]
- Updated dependencies [5c9d69f]
- Updated dependencies [bbb538e]
- Updated dependencies [e69e97f]
- Updated dependencies [9c19d5e]
- Updated dependencies [0e1f269]
- Updated dependencies [5b1a788]
- Updated dependencies [d3b9057]
- Updated dependencies [b8eba2f]
- Updated dependencies [4fe6756]
- Updated dependencies [9fa373d]
- Updated dependencies [b76089a]
- Updated dependencies [54242f0]
- Updated dependencies [ad10f82]
- Updated dependencies [222fd80]
- Updated dependencies [4042637]
- Updated dependencies [70cf20d]
- Updated dependencies [6073365]
- Updated dependencies [46fcc7e]
- Updated dependencies [90f8ec4]
- Updated dependencies [a297730]
- Updated dependencies [38fd203]
- Updated dependencies [9ad34e0]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
- Updated dependencies [0cef6a3]
- Updated dependencies [6941e0c]
- Updated dependencies [98ec291]
- Updated dependencies [0d1c052]
  - @weasel-js/core@1.10.0
  - @weasel-js/geom@1.10.0
  - @weasel-js/animator@1.10.0
  - @weasel-js/font@1.10.0
  - @weasel-js/simulation@1.10.0

## 1.9.4

### Patch Changes

- 9ad839d: A `PathDrawCommand`'s `fill` and `stroke` are now `CommandFill` and `CommandStroke`: a pattern must name a registered texture, and no paint may be in `'bounds'` units, so a tile spec or a box-relative gradient on a hand-built command is a type error where it used to draw blank or in screen space. This is a breaking change to types: code that passes a node's `FillStyle` or `Stroke` straight into a command now calls `commandFill(fill, box)` or `commandStroke(stroke, box)`, which resolve both. Options that feed commands directly (`createPathLayer`'s `getFill` and `getStroke`, affordance paints, selection overlay and guide strokes, overlay role strokes) take the narrowed types. `<Canvas backgroundFill>`, `<DrawCanvas background>`, the rect fallback painter, a marker's own fill, and `diagramShape` now resolve their paint, so a tile spec or `'bounds'` gradient there paints.
- 339888c: A diagram group may be a member of another group. `DataGroup.members` and a group box's `dependsOn` can name groups as well as nodes; the outer box is drawn around the inner box and behind it, and `layered`, `tree`, and `force` keep a nested group's members together inside its parent's. `GraphGroup.members` is every participant inside a group through any nested group, `GraphGroup.parent` names the group it sits in, and `GraphNode.group` is a node's innermost group. A group id in `members` was ignored before.
- 6b67d5d: `@weasel-js/diagram/layout` no longer loads React. Its body builder imported
  `cssFamilyName` from the `@weasel-js/core` barrel, which pulled the whole kit
  into a subpath meant for a server with no DOM; it now imports from
  `@weasel-js/font`, which `@weasel-js/diagram` declares as a peer.
- 0d56482: An edge from a node to itself that names no ports now draws: it leaves by the node's east-facing side, returns by its north-facing one, and passes a point off the corner between them, which `edgeDerivePath` hands the router as a waypoint. It drew nothing before, both ends having picked the same port. `selfLoop` is the rule, `selfLoopStandoff` on `edgeDerivePath`'s options sets how far out the turn is (half the node's shorter side by default), and waypoints the author set are used in place of the rule's point.
  
  The `orthogonal` router no longer doubles back after a waypoint: where splitting the next leg at its midpoint would start back the way the route came, it turns at the waypoint. A route through a waypoint that overshot the next stop changes shape.
- c289df7: Every public export now carries a JSDoc block: the ones that had none are documented, among them audio's effect and envelope types, diagram's `DiagramData` family, and `SelectContext`. No behavior changes.
- f06caab: Moving or nudging a node whose pose is derived from an id list (`derivePose` with a `dependsOn` list) now moves the nodes it derives from, through however many derived nodes that takes; a pose written to the derived node itself was overwritten on the next read. A diagram group's box is pickable again, so dragging it, or its title, moves the group's members.
- fd57f62: The `force` layout now reads groups: a group's members are drawn toward their centroid (`ForceOptions.groupStrength`, default 0.2), and a group's box is pushed clear of every other group's box and of every node outside it. A graph with no groups relaxes exactly as before.
- 2711a79: `layered` (under the default `'seeded'` order) and `tree` now return an arrangement a second run keeps when the graph has groups. A group that pushed an outsider out of its column changed the order the next run read, so a re-run moved nodes again. New export `untilSettled` runs a layout until a pass moves nothing.
- Updated dependencies [6e2447b]
- Updated dependencies [9dfd8a5]
- Updated dependencies [4c4aa40]
- Updated dependencies [f17d213]
- Updated dependencies [7420a37]
- Updated dependencies [41a4b4e]
- Updated dependencies [50b294e]
- Updated dependencies [f7872a9]
- Updated dependencies [9d54d0a]
- Updated dependencies [d99eb26]
- Updated dependencies [0a2eba9]
- Updated dependencies [3df6f75]
- Updated dependencies [719b2eb]
- Updated dependencies [095c055]
- Updated dependencies [4b0688a]
- Updated dependencies [103f988]
- Updated dependencies [c567961]
- Updated dependencies [6ba9cad]
- Updated dependencies [3f18dbe]
- Updated dependencies [8d25bd4]
- Updated dependencies [bb078c0]
- Updated dependencies [663248a]
- Updated dependencies [c2a2a5d]
- Updated dependencies [92c8af4]
- Updated dependencies [9b4fc5c]
- Updated dependencies [e023a51]
- Updated dependencies [184be75]
- Updated dependencies [9ad839d]
- Updated dependencies [fb505bb]
- Updated dependencies [0aaeebc]
- Updated dependencies [e589003]
- Updated dependencies [ec79c3f]
- Updated dependencies [1c401e3]
- Updated dependencies [158e471]
- Updated dependencies [001aaae]
- Updated dependencies [a843f5a]
- Updated dependencies [2fda51b]
- Updated dependencies [557c01d]
- Updated dependencies [b370885]
- Updated dependencies [8a21a87]
- Updated dependencies [86fd792]
- Updated dependencies [8f23c57]
- Updated dependencies [a7c9133]
- Updated dependencies [c289df7]
- Updated dependencies [eb123ad]
- Updated dependencies [f06caab]
- Updated dependencies [2b3b637]
- Updated dependencies [55fd8a6]
- Updated dependencies [fc8068c]
- Updated dependencies [efcb538]
- Updated dependencies [1268f79]
- Updated dependencies [452fffc]
- Updated dependencies [01f9a06]
- Updated dependencies [41bddcc]
- Updated dependencies [94abaef]
- Updated dependencies [20c2d26]
- Updated dependencies [f5d50b0]
- Updated dependencies [b39b0f3]
- Updated dependencies [eefcc9a]
- Updated dependencies [f66ec41]
- Updated dependencies [1896646]
- Updated dependencies [ccf595e]
- Updated dependencies [546fd8a]
- Updated dependencies [310c9db]
- Updated dependencies [ad0b554]
- Updated dependencies [7da269f]
- Updated dependencies [f21325d]
- Updated dependencies [bb5c5dc]
- Updated dependencies [04caa20]
- Updated dependencies [f12ac6a]
- Updated dependencies [8fca412]
- Updated dependencies [a2e0462]
- Updated dependencies [234f718]
- Updated dependencies [5e1cbe4]
- Updated dependencies [8fa3cbc]
- Updated dependencies [fb297fb]
- Updated dependencies [657872c]
- Updated dependencies [110142d]
- Updated dependencies [39b26f9]
- Updated dependencies [3a4fa8e]
- Updated dependencies [71f5742]
- Updated dependencies [e39b73c]
- Updated dependencies [cf3d535]
- Updated dependencies [7c2e054]
- Updated dependencies [243984f]
- Updated dependencies [c527f50]
- Updated dependencies [b8a988c]
- Updated dependencies [9e51015]
- Updated dependencies [ab164dd]
- Updated dependencies [68dcc32]
- Updated dependencies [20617cc]
- Updated dependencies [71f5742]
- Updated dependencies [07d7cfe]
- Updated dependencies [2010b82]
- Updated dependencies [d490ebc]
- Updated dependencies [fc4676d]
- Updated dependencies [9d9eb3b]
- Updated dependencies [cc57bc6]
- Updated dependencies [420ba9c]
- Updated dependencies [abe11f9]
- Updated dependencies [316ecd0]
- Updated dependencies [fae67cb]
- Updated dependencies [b4f06f1]
- Updated dependencies [427ea6c]
- Updated dependencies [dcc041e]
- Updated dependencies [0a17152]
- Updated dependencies [f356bd0]
- Updated dependencies [9472e9a]
- Updated dependencies [928cafc]
- Updated dependencies [95e64cd]
- Updated dependencies [d01459d]
- Updated dependencies [1eee4df]
- Updated dependencies [cca79cf]
- Updated dependencies [5cd52f3]
- Updated dependencies [cad8bd9]
- Updated dependencies [190622a]
- Updated dependencies [36c6ca0]
- Updated dependencies [747e03e]
- Updated dependencies [6983df3]
- Updated dependencies [399033f]
- Updated dependencies [2d1c6af]
- Updated dependencies [e31a360]
- Updated dependencies [33e0710]
- Updated dependencies [a8e964e]
- Updated dependencies [b444e46]
- Updated dependencies [e4d444f]
- Updated dependencies [bdf0a97]
- Updated dependencies [0641010]
- Updated dependencies [667ca34]
- Updated dependencies [e06409e]
- Updated dependencies [1268f79]
- Updated dependencies [4d559ca]
- Updated dependencies [60ac0a5]
- Updated dependencies [93780f6]
- Updated dependencies [188604d]
- Updated dependencies [036d768]
- Updated dependencies [9f70b3c]
- Updated dependencies [812118e]
- Updated dependencies [4bbffa2]
- Updated dependencies [e640378]
- Updated dependencies [ec5e31d]
- Updated dependencies [2db1963]
- Updated dependencies [20cb4c6]
- Updated dependencies [0a83dfb]
- Updated dependencies [b413e19]
- Updated dependencies [d8b791e]
- Updated dependencies [dc856b3]
- Updated dependencies [0b93821]
- Updated dependencies [8b405d0]
- Updated dependencies [6fd724f]
- Updated dependencies [a145539]
- Updated dependencies [279d88f]
- Updated dependencies [60edb93]
- Updated dependencies [66f7465]
- Updated dependencies [9c10943]
- Updated dependencies [e98e95b]
- Updated dependencies [8261c9c]
- Updated dependencies [4787e75]
- Updated dependencies [c2ec0c3]
- Updated dependencies [16559ef]
- Updated dependencies [ba7cc48]
- Updated dependencies [569a013]
- Updated dependencies [ac8491b]
- Updated dependencies [5601761]
- Updated dependencies [7123087]
- Updated dependencies [1ca2395]
- Updated dependencies [47d868f]
- Updated dependencies [77fe781]
- Updated dependencies [d18b041]
- Updated dependencies [97bcbef]
- Updated dependencies [a53f3da]
- Updated dependencies [cd5ff3e]
- Updated dependencies [ec3c147]
- Updated dependencies [24bdb50]
- Updated dependencies [5d1ffd6]
- Updated dependencies [6b42996]
- Updated dependencies [6122f67]
- Updated dependencies [50cb70e]
- Updated dependencies [e9a28a0]
- Updated dependencies [ea6842f]
- Updated dependencies [54faddb]
- Updated dependencies [0cf2bf4]
- Updated dependencies [c5389a8]
- Updated dependencies [a1ea9ff]
- Updated dependencies [8953d33]
- Updated dependencies [8d56051]
- Updated dependencies [d16306d]
- Updated dependencies [b931128]
- Updated dependencies [a200c36]
- Updated dependencies [2bbcc5a]
- Updated dependencies [d3635ee]
- Updated dependencies [2098025]
- Updated dependencies [6a4a8ad]
- Updated dependencies [5b8578a]
- Updated dependencies [d8e003d]
- Updated dependencies [b3b209e]
- Updated dependencies [72002f8]
- Updated dependencies [26c11b8]
- Updated dependencies [44e1258]
- Updated dependencies [40533db]
- Updated dependencies [d71fc46]
- Updated dependencies [4334f6d]
- Updated dependencies [bb28e63]
- Updated dependencies [3dff419]
- Updated dependencies [611573e]
- Updated dependencies [ba4684e]
- Updated dependencies [0d82f92]
- Updated dependencies [6befeae]
- Updated dependencies [7c45605]
  - @weasel-js/core@1.9.4
  - @weasel-js/font@1.9.4
  - @weasel-js/geom@1.9.4

## 1.9.3

### Patch Changes

- b3e3fc6: `diagramScene` takes `groups`: each draws a box around its member nodes, with an optional label inside it, and `layered` and `tree` keep a group's members together. Each group gets a column on the cross axis that nothing else enters, in every rank from its first member's to its last, and rank gaps widen where a box needs the room. The box is a scene node that derives its pose from its members, so dragging a member carries it along. An edge naming a group meets the box, and ranks against the group's first stage.
  
  Underneath, `Graph` carries `groups` and each `GraphNode` its `group`, and `buildGraph` reads a group from a node whose trait carries `group`, its `dependsOn` naming the members, so `applyLayout`, `useLiveLayout` and `DiagramView` keep groups together too. `packClusters`, `rankGaps` and `expandGroupEdges` are exported for a custom `LayoutFn`. `groupDerivePose` and `anchorDerivePose` (a node held at a point on another's bounds, as a group's label is) are registered by `withDiagramRegistry`. `fitDiagram` frames group boxes as well as node boxes. Groups are flat, and `force` ignores them.
- 37bcee9: An edge label is no longer read as a diagram participant. The default trait reader took its `data.diagram.label` for a participant's trait, so a scene layout (`applyLayout`, `useLiveLayout`, `DiagramView`) gave every label a slot of its own, and the port affordance gave each one four ports.
- 6a1afa1: Canvas text in a CSS generic family — `sans-serif`, `monospace`, `system-ui` and the rest — now renders in that family. The dynamic glyph atlas quoted every family, and a quoted `"sans-serif"` names a font nobody has, so the browser drew it in its default serif; every `DiagramView` on default options was affected.
  
  Every font string the kit builds now goes through one helper, `cssFamilyName`, exported from `@weasel-js/font` and `@weasel-js/core`: a generic keyword stays bare, a single named family is quoted, and a family list passes through as written. `fontString` and the DOM face's fallback therefore now quote a named family (`"Helvetica"`), which CSS reads the same.
- c28a3cb: A canvas no longer claims Space or Enter when focus is on a control those keys activate — a button, a link, a checkbox — so a mounted canvas stops canceling a focused button's activation with its held-Space pan. Other shortcuts still reach the canvas from a focused button. The test is exported as `activatesFocusedControl`, beside `isEditableTarget`.
  
  `DiagramView` takes `enableKeybindings`, and a view-only diagram (no `onMove` or `onConnect`) now defaults it off, so it no longer takes held Space from the rest of the page. Pass `enableKeybindings` to keep a view-only diagram's keys on.
- Updated dependencies [6a1afa1]
- Updated dependencies [c28a3cb]
- Updated dependencies [7cb27b7]
- Updated dependencies [e05c820]
  - @weasel-js/core@1.9.3
  - @weasel-js/geom@1.9.3

## 1.9.2

### Patch Changes

- 227a3fb: `diagramScene` builds every box through `buildBody`, so a data node can set its `outline`, `rows` (label, field, ports and slot, with bold text), `padding`, `gap`, perimeter `ports`, `pinned`, a starting `at` and a minimum `width`/`height`. `lines` remains shorthand for label rows. Edges take `fromPort`/`toPort`, a per-edge `router`, `waypoints` and `labelPlacement`; `EdgeStyle` adds `dash`, `markerStart`, `markerEnd` and a `label` color, and `NodeStyle` adds `dash`. Options add `layout` by name (`'layered'`, `'tree'`, `'force'`), `measure`, `outline`, `padding`, `gap`, `minWidth` and `labelPlacement`, and `layoutOptions` now merge over the barycenter default instead of replacing it.
  
  Box sizes change: padding is the body's uniform 8 rather than 12 by 8, and rows are spaced by `gap`.
  
  `BodySpec.ports` replaces a body's four compass ports. `BodySpec.verticalAlign` (`'top'`, `'center'` or `'bottom'`) places the rows as a block when a body is taller than they need, and defaults to `'center'`: a body used to stack its rows from the top, so one built taller than its content now draws them lower. Data nodes and `diagramScene` options take `verticalAlign` too. A row's fallback height now follows its `fontSize` when no `measure` is given.
  
  `DiagramView` adds `maxScale`, `fitPadding`, `background`, and a controlled `view` with `onViewChange`.
- 3ba97df: `reconcileSpecs(scene, prev, next)` brings a scene from one list of node specs to another: it adds and removes by id and writes only the fields that changed between the two lists, as one untracked step. What the scene did since `prev` survives unless `next` changes that same field.
  
  `DiagramView` no longer remounts on a new `specs` array. It reconciles the new specs into the scene it holds, so the view, the pick and anything moved stay put. `onMove` turns on dragging and reports every node a drag or a layout run moved. `onConnect` makes ports grabbable and reports the edge a connect describes without drawing it, and `canConnect` and `portOptions` configure that. A `ref` gets `layout(algorithm)`, which re-runs a layout animated from where the nodes stand, and the run's `live` controls; `live` configures the run.
  
  `diagramScene` gives every spec an id, and takes `layout: 'none'` to leave each node at its `at`.
  
  `fitDiagram`'s scale and anchor arguments are now one options object.
- Updated dependencies [3ba97df]
- Updated dependencies [1b7af8d]
  - @weasel-js/core@1.9.2
  - @weasel-js/geom@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [c63f934]
  - @weasel-js/core@1.9.1
  - @weasel-js/geom@1.9.1

## 1.9.0

### Minor Changes

- 2540471: Add `diagramScene` and `DiagramView`, a laid-out read-only diagram from plain nodes and edges, and `order: 'barycenter'` for `layered`, which reorders ranks to reduce crossings.
  
  <!-- bump-approved: minor: maintainer — 1.9.0 release requested 2026-10-07 -->

### Patch Changes

- c06cc26: Read action deps at their declared `DepSchema` types instead of casting them.
- 1b22863: `fitViewToBounds` takes `anchor: 'start'`, which shows the left or top edge of bounds that overflow the viewport instead of their middle. `DiagramView` passes it through, alongside a new `minScale` floor on its initial fit.
- 63d0bf8: `<SceneCanvas onClick>` reports every click with the node under it, after the click's own behavior has run, including a click on a node that is already picked. `DiagramView` uses it, so `onSelect` fires on a re-click, and it now pans on a plain drag as well as the wheel. `diagramScene` throws on a repeated node id and drops a repeated edge with the same ends and label.
- 24b2eaf: `SceneRegistry`, `DerivedDep`, `DerivePathFn` and `DerivePoseFn` take the scene's data and layer types after the pose (`SceneRegistry<TPose, TData, TLayer>`), defaulting to `unknown` and `string`. A `derivePath` or `derivePose` on a `Scene<MyData, MyLayer, MyPose>`, or in its registry, now reads its node's and its dependencies' `data` and `layer` typed instead of casting. `withKitRegistry` and `withDiagramRegistry` carry the same parameters through. Existing `SceneRegistry<TPose>` spellings are unchanged.
- Updated dependencies [c06cc26]
- Updated dependencies [dc5bcfc]
- Updated dependencies [0b8d6f8]
- Updated dependencies [0004749]
- Updated dependencies [1b22863]
- Updated dependencies [ad0da6c]
- Updated dependencies [2b03077]
- Updated dependencies [718769e]
- Updated dependencies [3088756]
- Updated dependencies [63d0bf8]
- Updated dependencies [4146713]
- Updated dependencies [24b2eaf]
  - @weasel-js/core@1.9.0
  - @weasel-js/geom@1.9.0

## 1.8.1

### Patch Changes

- Updated dependencies [e07c4ca]
- Updated dependencies [934f195]
- Updated dependencies [7e72192]
- Updated dependencies [bf522cf]
- Updated dependencies [c49c9e0]
- Updated dependencies [2123049]
  - @weasel-js/core@1.8.1
  - @weasel-js/geom@1.8.1

## 1.8.0

### Patch Changes

- 4db0f2e: `PoseOverrides` has a new method, `read(id)`. It returns what a node is drawn and picked with: every source of overrides for that node folded into one, as of the last write or `commit()`. `get(id)` still returns the entry a writer stored, by reference. Painting, picking and `effectivePose` now call `read`. Today the only source is the entries table, so `read` and `get` agree. Once animations write overrides too, `read` will fold them in with the table.
  
  Anyone who implements `PoseOverrides`, or the `overrides` of a `PoseSource` stand-in or of diagram's `ParticipantScene`, has to add `read`. For a stand-in, `read: (id) => entries.get(id)` reproduces the old behavior.
  
  Core now depends on `@msb235/blits`, which does the folding.
- Updated dependencies [d24f51f]
- Updated dependencies [4db0f2e]
- Updated dependencies [c1aa1f6]
- Updated dependencies [2432ce3]
- Updated dependencies [9b1ff50]
  - @weasel-js/core@1.8.0
  - @weasel-js/geom@1.8.0

## 1.7.3

### Patch Changes

- @weasel-js/core@1.7.3
  - @weasel-js/geom@1.7.3

## 1.7.2

### Patch Changes

- Updated dependencies [06ee1e6]
- Updated dependencies [88e298e]
- Updated dependencies [0756a82]
- Updated dependencies [b18ef4a]
  - @weasel-js/core@1.7.2
  - @weasel-js/geom@1.7.2

## 1.7.1

### Patch Changes

- 3712d90: A live `force` run now finishes when the graph stops moving rather than when alpha cools. It ends once no node has moved `restDistance` world units (default 0.1) for `restTicks` ticks in a row (default 5), which on a small graph is a few dozen frames instead of three hundred. Nothing rests while a node is being dragged. `restDistance: 0` restores the old behavior. Both options, and `dragAlpha`, are now accepted through `useLiveLayout`'s `force` option.
- 27bcf57: Every op factory's argument type can now be imported by name from `@weasel-js/core`: `InsertArgs`, `DeleteArgs`, `TransformArgs`, `ReparentArgs`, `SetDataArgs`, `SetLayerArgs`, `SetPathArgs`, `SetTextArgs`, `SetSelectionArgs`, `ReorderArgs` and `MoveToIndexArgs`, with the shapes they reference, `SiblingSlot`, `PlacedNode` and `ReorderRestoreEntry`. Core also exports `KeyBinding` (the parameter of `matchesKeyBinding`), `rangeWeight` and `unboldPatch`. `@weasel-js/diagram` exports `ForceBody`, the element type of `ForceRelaxation.bodies`.
  
  The default align, distribute, boolean and edit icons are now marked `@experimental` on each component; the tag had sat on a file header where it marked nothing.
  
  Breaking: `DispatcherViewTarget` and `ViewIdResolver` are off `@weasel-js/routing/react`. They moved to `@weasel-js/routing/internal`, which is not public API. `rectsEqual` is off `@weasel-js/labkit/surface`.
- 3755e17: Refs that event handlers, timers and message listeners read no longer hold
  what an abandoned concurrent render computed. The gesture dispatcher,
  `useDepSource`, `useOngoingAction`, `ActionsProvider`, `useTools`,
  `useContributions`, the ui components with drag or dismissal handlers
  (`Callout`, `CurveEditor`, `LayerList`, `ResizeHandle`, `Timeline`'s graph
  lane), `useAsyncOptions`, `useReorderDragList`, forge's trial shell and
  `useLiveLayout` now publish their latest props on commit only.
  
  `ContributionsApi` is now rebuilt from each render's entries instead of reading
  them through a ref, so its `entries`, `overlays()` and `scopedBindings()` answer
  correctly when read during render. Its identity is kept while the entry list
  holds the same entries, and changes when an entry is added, removed or
  replaced — a consumer building its entry objects inline every render now gets a
  new API object each render.
  
  Because a dep source now publishes on commit, `ActionBar` re-checks each
  action's `enabled` after it commits and re-renders if a dep changed in the same
  render.
- Updated dependencies [6f59206]
- Updated dependencies [716ea36]
- Updated dependencies [2d7003a]
- Updated dependencies [e17fe2c]
- Updated dependencies [f457e7c]
- Updated dependencies [8635031]
- Updated dependencies [276bad1]
- Updated dependencies [efc5727]
- Updated dependencies [108551d]
- Updated dependencies [a5bc201]
- Updated dependencies [4e18c9f]
- Updated dependencies [112c781]
- Updated dependencies [ac2e76e]
- Updated dependencies [9c164e2]
- Updated dependencies [85d62a7]
- Updated dependencies [dfd926f]
- Updated dependencies [3d80c9f]
- Updated dependencies [a1ecaac]
- Updated dependencies [886fefd]
- Updated dependencies [04b0b96]
- Updated dependencies [27bcf57]
- Updated dependencies [a7f2103]
- Updated dependencies [b2fd89a]
- Updated dependencies [4212d2d]
- Updated dependencies [12263bc]
- Updated dependencies [b5cc59f]
- Updated dependencies [e2f1968]
- Updated dependencies [1524403]
- Updated dependencies [bfc4b21]
- Updated dependencies [f046160]
- Updated dependencies [9f83b33]
- Updated dependencies [3c1def2]
- Updated dependencies [ae6e8ac]
- Updated dependencies [4b570e5]
- Updated dependencies [251fb64]
- Updated dependencies [9bfdda9]
- Updated dependencies [b554ee0]
- Updated dependencies [702829d]
- Updated dependencies [9cad63b]
- Updated dependencies [b228015]
- Updated dependencies [53cdd41]
- Updated dependencies [33b7ac2]
- Updated dependencies [fa67cbf]
- Updated dependencies [8f68fa8]
- Updated dependencies [25448ee]
- Updated dependencies [88c1ae3]
- Updated dependencies [dcc9834]
- Updated dependencies [365c762]
- Updated dependencies [941e941]
- Updated dependencies [b20df31]
- Updated dependencies [55ef61f]
- Updated dependencies [712de19]
- Updated dependencies [67d95c8]
- Updated dependencies [8a68b6c]
- Updated dependencies [16a0476]
- Updated dependencies [6f03bf7]
- Updated dependencies [72379f6]
- Updated dependencies [7f7d153]
- Updated dependencies [d9cdff1]
- Updated dependencies [63d0ece]
- Updated dependencies [f8bde12]
- Updated dependencies [685a086]
- Updated dependencies [90a4686]
- Updated dependencies [7e08265]
- Updated dependencies [d60a422]
- Updated dependencies [dde2315]
- Updated dependencies [4cb55b7]
- Updated dependencies [fb21799]
- Updated dependencies [fe9a91e]
- Updated dependencies [3a68365]
- Updated dependencies [43ad590]
- Updated dependencies [4cef954]
- Updated dependencies [c4cc60f]
- Updated dependencies [6df279e]
- Updated dependencies [09ff2c1]
- Updated dependencies [637945e]
- Updated dependencies [5308126]
  - @weasel-js/core@1.7.1
  - @weasel-js/geom@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [b1142a7]
- Updated dependencies [96adc78]
- Updated dependencies [240138b]
- Updated dependencies [21ee45b]
- Updated dependencies [32bb3be]
- Updated dependencies [2e34d59]
- Updated dependencies [32c5fb4]
- Updated dependencies [0047d33]
- Updated dependencies [ad0378f]
- Updated dependencies [da20f95]
- Updated dependencies [b4227b8]
- Updated dependencies [0cecdcf]
- Updated dependencies [7c3cc5d]
- Updated dependencies [722b267]
- Updated dependencies [52078c5]
- Updated dependencies [197fdf7]
- Updated dependencies [5acf166]
- Updated dependencies [7f7b04f]
- Updated dependencies [fc3de06]
- Updated dependencies [b8f2007]
- Updated dependencies [fd178be]
- Updated dependencies [5201b8e]
- Updated dependencies [bc2a7ef]
- Updated dependencies [6819653]
- Updated dependencies [793987a]
- Updated dependencies [ca2f45f]
- Updated dependencies [082c63f]
- Updated dependencies [242e9f7]
- Updated dependencies [f8f0160]
- Updated dependencies [455e4bc]
- Updated dependencies [a028cc3]
- Updated dependencies
- Updated dependencies [667f14f]
- Updated dependencies [e442bcb]
- Updated dependencies [aad77d3]
- Updated dependencies [8999210]
- Updated dependencies [94cf4cd]
- Updated dependencies [d647c9b]
- Updated dependencies [d7aaeb1]
- Updated dependencies [38f524c]
- Updated dependencies [2336d9c]
- Updated dependencies [71d54e4]
- Updated dependencies [03e9385]
- Updated dependencies [8c1cd8d]
- Updated dependencies [d5a9fbf]
- Updated dependencies [3a20620]
  - @weasel-js/core@1.7.0
  - @weasel-js/geom@1.7.0

## 1.6.1

### Patch Changes

- Updated dependencies [b209a8e]
- Updated dependencies [7683659]
  - @weasel-js/core@1.6.1
  - @weasel-js/geom@1.6.1

## 1.6.0

### Patch Changes

- Updated dependencies [16c0da2]
- Updated dependencies [b8ebef6]
- Updated dependencies [c373af4]
- Updated dependencies [bfe6a4f]
- Updated dependencies [6857b4d]
- Updated dependencies [bbaefca]
- Updated dependencies [0cf6a0d]
- Updated dependencies [811abcd]
- Updated dependencies [7c53d1a]
- Updated dependencies [5345efb]
- Updated dependencies [87fd8a8]
- Updated dependencies [6f14f6f]
- Updated dependencies [c1f82e2]
- Updated dependencies
- Updated dependencies [97561f1]
- Updated dependencies [89926b5]
- Updated dependencies [9f86dec]
- Updated dependencies [4074270]
- Updated dependencies [debfd5d]
- Updated dependencies [d975afa]
- Updated dependencies [62d8d7c]
  - @weasel-js/core@1.6.0
  - @weasel-js/geom@1.6.0

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
- 8ffd746: State the port-curve rule once, in `@weasel-js/geom`.
  
  A routed edge leaves a port along its normal and arrives at the next against
  that port's normal, with the controls reaching 0.4 of the straight-line
  distance. That rule lived inside `@weasel-js/diagram`'s `bezier` router with
  its reach constant module-private, so a 3D consumer had no way to share even
  the number.
  
  It is now `portControls` / `portCurvePoints` / `PORT_REACH`, exported from
  both `@weasel-js/geom` and `@weasel-js/geom/3d`. One implementation over loose
  components sits behind both, so the two dimensions cannot disagree: every
  operation in it is closed on the plane z = 0, and a planar problem answered
  through the 3D entry returns the same numbers, not an approximation. Each
  barrel wraps it in its own tier's currency — scalars for 2D, matching
  `cubicEvalAt`, and `Vec3` for 3D.
  
  `bezier` is unchanged in behavior; it calls through. `@weasel-js/diagram` now
  declares the `@weasel-js/geom` peer it had been importing without.
  
  Also moves `Vec2`'s declaration out of `core/geometry/polygonHitTestRect.ts`,
  a polygon-versus-rect hit-testing helper it had been an incidental local in,
  into `core/geometry/vec2.ts`. No API change — the barrel exports the same
  type from a place you would look for it.
- Updated dependencies [1c695cb]
- Updated dependencies [24a2dae]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
- Updated dependencies [ad6c351]
  - @weasel-js/core@1.5.2
  - @weasel-js/geom@1.5.2

## 1.5.1

### Patch Changes

- a80e8db: `@weasel-js/diagram/layout` and `@weasel-js/core/math` are new subpaths that a
  Node process can import: measuring a box from its rows, ranking a graph,
  relaxing one under forces, and finding where on a box's perimeter an edge
  should leave, with no React in the module graph. A server rendering a diagram
  needed all of that and could not have it — the diagram barrel reaches `live`
  (a hook) and `connect` (an interaction), and core's reaches the canvas.
  
  `layout` exports `measureBody`/`sizeToBody`, `layered`/`ranksOf`/`backEdges`,
  `force`, `tree`, `COMPASS` and the rest of `ports`, `outline` and `onOutline`.
  A caller with its own nodes and edges implements `Graph` — an interface, not a
  class — over what it already has, so `buildGraph`, which reads one out of a
  scene, is not needed and is not there. The routers stay behind: they live with
  the scene registry, and they are typed in `Vec2`, so a consumer routing in
  three dimensions cannot call them regardless.
  
  The seven modules behind it now import `@weasel-js/core/math` rather than the
  core barrel. Every symbol they took is in the subpath, so this narrows what
  they ask for rather than moving anything.
  
  `scripts/check-react-free.mjs` (`npm run check:react-free`) walks each entry's
  **built** closure, through sibling packages' `exports` maps, and fails on a
  React specifier. Sources cannot answer this question: `core/math` re-exports
  nineteen leaf modules that each import only numbers, and its first build still
  pulled a megabyte of canvas — one leaf reached core's own barrel, and
  `splitting: true` put the result in a chunk the entry imported.
- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [626bace]
- Updated dependencies [f4049be]
- Updated dependencies [432b143]
- Updated dependencies [4f9fd3b]
- Updated dependencies [91973a7]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
- Updated dependencies [2a63f31]
- Updated dependencies [66e0e10]
- Updated dependencies [8b79c20]
- Updated dependencies [b6a5eed]
- Updated dependencies [98ad39c]
- Updated dependencies [67f3867]
- Updated dependencies [f663199]
- Updated dependencies [a80e8db]
- Updated dependencies [a7519a1]
- Updated dependencies [187593e]
- Updated dependencies [08a3aec]
- Updated dependencies [d963d14]
- Updated dependencies [edb825a]
- Updated dependencies [229a16a]
- Updated dependencies [f9feecc]
- Updated dependencies [b981856]
- Updated dependencies [0662a2d]
- Updated dependencies [c0fa540]
- Updated dependencies [21ce23e]
- Updated dependencies [ff17dd7]
- Updated dependencies [f2b8d57]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/core@1.5.1

## 1.5.0

### Patch Changes

- 9190fc9: Follow-ups a 3D lab turned up while driving core's dispatcher over a WebGL
  viewport. Each one is a place the kit assumed its own 2D renderer.
  
  **`classifyTarget` and `affordanceAt` now take the world point their types
  promise.** Both were handed the raw client point at every dispatcher call site,
  so `<SceneCanvas>` and `<CanvasView>` each wrapped their thunk in the same
  `clientToWorld` they also passed the dispatcher, and a consumer hit-tested in
  one space while reading `ctx.world` in another. The conversion happens once now,
  where the event arrives. Behavior-identical for both kit consumers; a consumer
  passing no `clientToWorld` sees identity. **If you pass either option to
  `useGestureDispatcher` yourself and convert coordinates inside it, remove your
  conversion.**
  
  **`InvocationCtx.screen` carries a screen point, and is optional.** It was
  filled from the same field as `ctx.world`, so it had never been screen-space.
  It now comes from the event's client coordinates and is absent where the event
  carries none — a keystroke, a UI-driven trigger, a synthetic probe. A
  view-mutating drag still wants `drag.screenDelta`. A click's `ctx.world` is the
  click's own position rather than the origin.
  
  **`scene.history` publishes the `History` a `Scene` already owned.** The kit's
  `undo`/`redo` actions resolve a `history` dep and a consumer had nothing to give
  them, so `<SceneCanvas>` cast the Scene itself through `unknown`. It is a façade
  rather than the private engine: mutating members route through the scene's own
  wrappers, so an action-driven undo bumps the version and notifies subscribers.
  
  **`resolveOverlays` is the overlay half of the in-flight gesture channel.**
  `resolvePreviews` already answered for the ghosts a gesture displaces; this
  answers for the chrome it draws that is no node at all — a marquee rect, a lasso
  trail, an insert outline — in world geometry, with every degenerate case
  dropped. `insertPreviewExtent` is exported alongside it.
  
  **Every overlay variant is now geometry, and the layer owns the paint.**
  `OngoingOverlay`'s `'commands'` variant — arbitrary `DrawCommand[]`, which only
  core's own 2D renderer could execute — **is gone**, along with the `opaque` flag
  on the resolved form and the `action.commands` chrome id. Its two producers
  publish the new `'polyline'` variant instead: a run of world points plus a
  one-word `OverlayRole` (`'cut'` for `slice`, `'connector'` for
  `@weasel-js/diagram`'s `connect`) that a painter maps to a stroke, falling back
  to plain chrome for a role it does not know. `useDispatcherOverlayLayer` draws
  both exactly as they were drawn before, and
  `DispatcherOverlayStyle.roles` is where a consumer restyles one.
  **`ConnectActionOptions.stroke` is removed** — an action no longer names a
  paint; use `roles: { connector: … }` on the layer's style.
  **If you produced a `'commands'` overlay**, publish a `'polyline'` for a line,
  or paint it from a render layer of your own.
  
  **labkit stacks two surface buffers around the trial DOM.** The shared buffer
  sat over the trials, which is right for a mark annotating an instrument and
  wrong for an opaque renderer that buries its own pane. `useSurfaceCanvas('under')`
  asks for the lower buffer; the default is unchanged. **`SurfaceCanvasContext`
  now carries `{ over, under }` rather than one canvas** — a consumer providing it
  directly must update the value.
  
  **labkit labs get their own chrome regions.** Every region was per-trial, so a
  lab-level control had nowhere to go and `LabPalette` existed by casting a
  two-field object through `as unknown as TrialChromeContext`. `<Lab labChrome>`
  takes contributions shaped exactly like a trial's, against a real lab context.
  
  `docs/extending.md` now states the contract for mounting tools outside
  `<SceneCanvas>`, including the half that was written down wrong: capability
  eligibility resolves through `RuleCtx.allowedCapabilities` and `getRuleCtx`, not
  the `activeTool` dep.
- 6f5ff46: Pose geometry is supplied once. `<SceneCanvas poseDescriptor={…}>` tells every
  built-in action, the selection chrome, picking and area select how to read and
  rewrite this scene's poses; it defaults to `AUTO_POSE_DESCRIPTOR` (rect and
  `Path` poses). A pose of any other shape now works end to end — before, dragging
  one into a container wrote `NaN` into it.
  
  Breaking:
  
  - `PoseProjection` is renamed `PoseDescriptor`, and gains a required
    `fromBounds(bounds, template)` and an optional `withRotation(pose, rotation)`.
  - `ResizePose` and `AlignBounds` are removed; use `Bounds`.
  - `RotateGeometry`, `AlignBoundsProjection` and `RECT_ALIGN_PROJECTION` are
    removed.
  - Removed options, replaced by the descriptor: `selectTool.resize.geometry` and
    `useResizePolicy({ projection })` (use `<SceneCanvas poseDescriptor>`);
    `UseRotateOptions.geometry` and `UseMoveOptions.translatePose` (both were
    unread); `poseBounds` on `useSelectTool`, `arrayAdapter`, `sceneToAdapter`,
    `MinimapCanvas` and `nestedHitTester` (use their `poseDescriptor` option);
    `arrayAdapter`'s `intersectsRect` and `translatePose`; the selection overlay's
    `getBounds` and `fromBounds`; the alignment behaviors' `projection`.
  - `Canvas`'s `geometry` prop is renamed `poseDescriptor`. `SceneCanvas`'s own
    `geometry` prop — the `pickEvery` / `boundsOf` hit-test overrides — is a
    different prop and keeps its name.
  - `computeFitView`'s fourth argument is a `PoseDescriptor`, not a bounds
    function.
  - `sceneToAdapter`'s `cascadeContainerPose` is a boolean; the cascade translates
    through the descriptor.
  - The kit's built-in painters only draw rect poses. A node with any other pose
    needs its own painter.
  - `Scene` has a read-only `registry`. For a custom pose kind,
    `unionOfChildrenVia(descriptor)` builds the container-union function to
    register under `UNION_OF_CHILDREN`.
- Updated dependencies [9190fc9]
- Updated dependencies [a2feeb0]
- Updated dependencies [3ecc1be]
- Updated dependencies [dd48085]
- Updated dependencies [efaf707]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [2f1ddd0]
- Updated dependencies [ea285a2]
- Updated dependencies [c758b4d]
- Updated dependencies [a41a83a]
- Updated dependencies [794b4ff]
- Updated dependencies [b65f4df]
- Updated dependencies [90f0bd8]
- Updated dependencies [b5b8b69]
- Updated dependencies [b2f2d45]
- Updated dependencies [6f5ff46]
- Updated dependencies [edd5b39]
- Updated dependencies [2e2041b]
- Updated dependencies [65806bc]
- Updated dependencies [a614be4]
- Updated dependencies [ef60ff6]
- Updated dependencies [269d432]
- Updated dependencies [486f631]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0

## 1.4.4

### Patch Changes

- fc00dae: Hand a derivation its dependencies' paths, and label an edge with one.
  
  `DerivedDep` is now `{ node, pose, path }`. The path resolves on first read and
  memoizes, so a route costs the same whether one node reads it or five, and a
  dependency nobody asks about costs nothing. `resolveDerivedPath` moves beside
  `derivedPose` in `core/scene` — a pose can now derive from a dependency's path —
  and picks up the cycle guard the pose side already had.
  
  `pointAlongPath(path, t)` is the new geometry primitive underneath: where a path
  is at a fraction of its length, and which way it heads there, measured along the
  flattened arc.
  
  In `@weasel-js/diagram`, an edge label is an ordinary leaf node with
  `dependsOn: [edge]` and `LABEL_DERIVE_POSE`. Its trait says where it sits —
  `at: 'start' | 'mid' | 'end'` or a fraction, plus an `offset` perpendicular to
  the route — and it reads the edge's resolved path rather than routing again, so
  a label and its arrowhead can never disagree about where the edge went.
- 60ba9d9: A stroke marker on a derived path is drawn.
  
  `markerStart` / `markerMid` / `markerEnd` reached the `kit:derived` painter
  intact and were then dropped: the painter emitted its stroke command and
  returned, where `kit:path` follows with a marker pass. So an arrowhead on a
  diagram edge — the whole reason markers and derived geometry landed in the same
  release — silently drew nothing. Its own `ink` had been reserving the hit-test
  reach for the marker all along, which is the shape of the bug: the pointer could
  already grab past the end of a line with no head on it.
  
  A connect-authored edge now carries `markerEnd: 'arrow'` by default. An edge
  runs *from* one node *to* another and a plain line does not say so;
  `DEFAULT_EDGE_STROKE` is exported for a consumer overriding `commit` who wants
  the rest of it.
- 6aff403: `buildBody` turns a `BodySpec` into the scene nodes that draw it.
  
  The container carrying the trait, and one leaf per row that wants drawing —
  placed by the same `layoutBody` walk the row ports anchor against, so a label
  and its ports cannot drift apart, and posed by `sizeToBody(at, measureBody())`,
  so the authored size is grown to clear the rows and never shrunk. A row's data
  is the consumer's, through one callback that is handed the row's text already
  formatted; returning `null` leaves that row undrawn, which is what a `ports` or
  `slot` row usually wants.
  
  Also fixed: a row port and a compass port could land on the same point, and one
  of them was then grabbable nowhere. `bodyTrait` anchors a `ports` row's entries
  at `u: 0` and `u: 1`, which for a row near the vertical middle put them exactly
  where `w` and `e` already were — the later region won the hit, and a node
  declaring six ports offered four. A row port on a side now takes that side's
  compass default with it: a body that says where its inputs attach has said what
  that side is for.
- edd6f53: Ports are grabbable, and dragging one onto another authors an edge.
  
  `diagramPorts` returns the two halves the gesture needs: a port affordance layer
  for `CanvasExtensionApi.registerLayer`, and a `Contribution` for `ambient`. They
  come back together because attaching one without the other fails quietly — the
  layer alone paints ports that start no gesture, and the contribution alone binds
  a hit nothing reports. `registerLayer` is the only attach route the kit
  hit-tests; a `Contribution.overlay` is painted and never hit.
  
  Connect is an ordinary drag binding gated on the port layer's affordance kind,
  not a mode and not a tool, so it starts from whatever tool is active. The
  preview is a real routed edge — the same router the committed edge will use,
  resolved by the same function, so it cannot promise something the release will
  not do. The commit is one `add`, which undoes in one step.
  
  Typed validity is `canConnect`, defaulting to "a port may not join itself, and
  two ports that both declare a `type` must declare the same one". An untyped port
  joins anything, so an untyped diagram stays fully connectable. It is applied
  where candidates are gathered rather than at the commit: an illegal port is
  never a candidate, so the edge will not snap to it and releasing over it does
  nothing.
  
  A port claims the whole `'pointer'` protocol so a port drag is never a move of
  the node underneath. That means `pointerDown` and `click` need bindings too —
  an exclusive claim bars every binding whose target does not consult the
  affordance, so a bundle that binds only `drag` leaves the press with nowhere to
  go and the dispatcher drops it, along with the drag it would have become.
  
  Also fixed: an edge's trait and a participant's trait live under the same
  `data.diagram` key, and the reader could not tell them apart. An edge read as a
  participant declares no ports, so it collected the four defaults on the
  degenerate pose an edge carries — four grabbable ports in the middle of nowhere.
  `from` and `to` are now what distinguishes the two.
- ed400a3: Edges. A `DiagramEdge` is an ordinary leaf scene node with
  `dependsOn: [from, to]` and a `derivePath` that runs a **router**, so it
  re-routes whenever either end moves and there is no parallel graph to keep in
  sync. Being a scene node is what buys it selection, hit-testing, hover,
  styling, z-order, SVG export, undo and copy/paste for free.
  
  Three routers ship: `straight`, `orthogonal` (leaves along each port's facing
  before turning) and `bezier` (leaves along one normal and arrives against the
  other, which is what makes an edge read as plugged into its port). Consumers
  register their own in the same shape. Author-dragged `waypoints` are data on
  the edge and the router routes *through* them — manual control authors
  constraints on the path, never the path itself, so a hand-tuned edge still
  follows a moved endpoint.
  
  An end that names no port resolves to the one **facing** the other end rather
  than the nearest: on a wide node the far-side port is often closer in a
  straight line, and an edge leaving through its own node reads as a bug however
  short it is.
  
  Ports are now cast from the node's bounds onto its outline. The bounds anchor
  is what makes a port survive a resize, but it is not where the ink is — a
  parallelogram's west anchor sits in the gap beside its leaning edge, and an
  edge ending there ends in empty space. `rayHit` casts the anchor back onto the
  flattened outline along the ray from the node's center, which is the direction
  an edge leaves anyway.
  
  `withDiagramRegistry` merges the edge router under a consumer's registry so an
  edge round-trips through `toJSON` without them wiring the key.
  
  Edge labels are not built yet: a label positioned along the route needs the
  routed path, which a derivation is not handed.
- 3d89141: Layout: `layered`, `tree` and `force`, and the action that runs one.
  
  A layout is a plain function of the graph — no scene, no ops, no history. It
  hands back the new top-left for every node that **moves**, and a node already
  standing where the layout wants it is absent from the answer, so re-running a
  layout on an arrangement it produced writes nothing and pushes no undo entry.
  
  Three rules keep a re-layout from scrambling a diagram someone has arranged.
  There is no RNG anywhere in the path, so the same graph always lays out the same
  way. Within-rank order is seeded from where the nodes already sit on the cross
  axis rather than from crossing-minimization, so two branches an author dragged
  into an order come back in it. And a node carrying `pinned: true` never moves,
  with the rest of the layout translated to sit around it — with no pin, the
  layout lands on the diagram's own bounding box rather than at the origin.
  
  `layered` ranks by longest path, breaking cycles with a depth-first walk in node
  order so a loop draws as an edge running back up the page. `tree` centers a
  parent over its children's block; a graph that is not a tree still lays out,
  since roots are the nodes nothing points at and anything the walk cannot reach
  becomes a root of its own. `force` is an iterative relaxation seeded from the
  current positions — **the one layout that is not idempotent**, since re-running
  it keeps relaxing.
  
  `buildGraph` reads the adjacency index from the same participant source the port
  affordance takes, per invocation rather than maintaining one. `createLayoutAction`
  rebuilds it on each press and writes the whole move as a single `scene.batch`,
  carrying a container's whole subtree — `setPose` does not cascade, and a built
  body would otherwise walk out from under its own label rows.
  
  In core, `createSimulation` is the velocity-Verlet integrator with no clock
  attached: `tick()` is the only thing that moves a node, so a pure function can
  run a whole relaxation and read the result. `useSimulation` is now that
  integrator on a frame loop and is otherwise unchanged. `SimulationCore` and
  `SimulationOptions` name the halves, and forces can be handed a seeded `random`
  in place of `Math.random`.
- 4a128c4: New package `@weasel-js/diagram` — the skeleton of weasel's node-link
  diagramming: flowcharts, pipelines, code-flow diagrams, simple visual
  programming. Arc 3 of the diagram design; edges, routing, the connect gesture
  and layout are still to come.
  
  **`DiagramNode` is a trait on an existing scene node, not a node type the
  package mints.** A text block, an image, a path, a group or a plain rect all
  become participants by carrying it, and nothing has to be authored through this
  package to take part. Two ways to attach it, both answered by the default
  reader: on the node's own `data.diagram`, or by kind — `createDiagramNodes`
  takes predicates over `data` the way `createNodeRouting` does, so a class of
  node takes part without being stamped one at a time.
  
  **Ports default to the perimeter, so a node needs to say nothing to be
  connectable.** `portsOf(node, pose)` resolves every port to a world point and
  an outward normal, reading bounds through the pose descriptor and carrying the
  node's rotation. Anchors are normalized against the bounds — `{ u, v }` from
  the top-left — so a port stays where it was put when the node is resized.
  
  **The body builder is optional**, for nodes that should look like a flowchart
  box: `rect`, `diamond`, `stadium` and `parallelogram` outlines plus a `Row[]`
  body of labels, fields, port rows and slots. Rows measure a floor, and the
  authored pose is maxed against it rather than set to it — adding a row can grow
  a node, nothing shrinks one back — which is what keeps resize, align,
  distribute, guides, snapping and undo free of a special case. Text measurement
  is a seam rather than an import; `canvasMeasure` adapts a 2D context.
  
  Rows lay out in the shape's **content box**, not its bounding box.
  `contentBox` reports the largest axis-aligned box inside an outline — a
  diamond's inscribed rect, a parallelogram minus its lean, the flat span between
  a stadium's ends — and `boxForContent` inverts it so the floor grows to suit.
  Without it a diamond's label is placed against the bounding box, lands outside
  the diamond, and the silhouette clip removes it: the label simply vanishes.
  
  `registerDiagramShape` paints a node whose trait names an outline, and reports
  the outline as its silhouette so picking and clipping follow the diamond rather
  than its box. Rows are not painted there — a built body's rows are ordinary
  scene nodes, so the kit's own text painter draws them and text editing,
  selection and styling work on them unchanged.
  
  Core exports `AUTO_POSE_DESCRIPTOR` and `isPathLike`, which were already
  general-purpose but reachable only from inside the package. A peer package
  computing a node's bounds needs the kit's own default descriptor rather than a
  second copy of it.
- b8d2940: Layout you can watch, and push against.
  
  `usePoseRun` is the transport: each frame it asks a producer for poses,
  publishes them to the scene's ephemeral override channel — the one a drag
  already writes to, which `effectivePose`, derived geometry and the pick source
  read — and commits the lot as one batch when the producer says it is done or
  the consumer stops it. Cancel drops the frames and the document is untouched.
  It runs behind `useVisibleRaf`, and it knows nothing about layout.
  
  A node carrying an override the run did not publish belongs to another gesture:
  the run never writes it, never commits it, and reports it to the producer as
  pinned. Dragging a box mid-run is therefore the consumer's ordinary move tool,
  with no gesture contributed by the diagram package.
  
  `useLiveLayout` in `@weasel-js/diagram` drives it. `force` relaxes one tick a
  frame off the same force list the one-shot `force` runs, holding a pinned node
  with `fx`/`fy` while its neighbors answer; `layered` and `tree` ease into a
  target computed once. A node or edge appearing or disappearing re-heats the run.
  
  `SceneNode.pickable: false` makes a node transparent to the hit-test walk, so a
  press lands on what is behind it. Without it the innermost hit wins and dragging
  a labeled box pulls the label out of the box.
- 2942544: Arrive along the receiving port in the `orthogonal` router. A leg whose two
  ends face the same axis now turns twice, at the midpoint of that axis, instead
  of dropping onto the port perpendicular to its facing — an edge between two
  boxes standing side by side landed on the west port from above, which put its
  arrowhead across the corner rather than into the shape.
- ca5b9f9: `layoutRowPorts` places a `ports` row's ports inside the row box, on the same
  terms `layoutBody` places one box per row. Both sides are cut into the same
  number of slots — the longer side's count — so the nth input faces the nth
  output; each port's label box is as wide as its own text and pinned to its own
  edge of the row.
  
  Two things follow. `RowPort.label` is drawn now rather than only measured:
  `buildBody` takes a `portLabel` callback and emits one text node per labeled
  port, the same way `row` emits one per row. And `bodyTrait` anchors each row
  port to its own slot instead of stacking every port on a side at the row's
  vertical center, where a second port was grabbable nowhere.
  
  `buildBody` also marks every leaf it emits `pickable: false`. The innermost hit
  wins, so a body whose rows answer a press is a body that cannot be dragged —
  which each consumer was otherwise left to discover and patch itself.
- Updated dependencies [9ce6f00]
- Updated dependencies [6f876a7]
- Updated dependencies [ed400a3]
- Updated dependencies [fc00dae]
- Updated dependencies [730da55]
- Updated dependencies [60ba9d9]
- Updated dependencies [5732951]
- Updated dependencies [2ff4824]
- Updated dependencies [3d89141]
- Updated dependencies [4a128c4]
- Updated dependencies [aee9d92]
- Updated dependencies [c067221]
- Updated dependencies [26d40bf]
- Updated dependencies [b8d2940]
- Updated dependencies [b5e2cd9]
- Updated dependencies [89276ee]
- Updated dependencies [36950d8]
- Updated dependencies [4f8c6b2]
- Updated dependencies [1240956]
  - @weasel-js/core@1.4.4
