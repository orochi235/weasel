# weaselchart (`apps/chart`), third arc — design

**Unbuilt as of 2026-10-20.**

For whoever builds each piece of the third arc. For each piece it says what the user does and sees
in weaselchart, which engine surface the piece adds and where, how it saves and undoes, how it
meets the second arc's code, and which tests prove it. Read `CLAUDE.md` ("Scope", "What gets its
own package", "Module shape", "Terminology") and `docs/taxonomy.md` first; this doc does not
restate them.

The first two arcs are merged and their specs deleted (readable at
`git show 89e332f4d:docs/superpowers/specs/2026-10-19-chart-app-design.md` and
`git show e9f49874d:docs/superpowers/specs/2026-10-19-chart-arc-2-design.md`). Their rules hold:
every editing ability is engine surface in `@weasel-js/diagram` or core, each editing action has a
swappable commit (scene ops by default, a report for a data-backed host such as `DiagramView` or
`EffectEditor`), and the app only proves it. labkit will reuse all of it.

## Build order

Each piece lands in its own worktree and merges on its own green `npm run test:fleet` and
`npm run test:gate`. A wave's pieces are built in parallel; a piece starts once what it needs has
merged.

| # | Piece | Package | Needs | Wave |
|---|---|---|---|---|
| 9 | Pipeline groups as editable containers | diagram, app | — | 3 |
| 13 | Mermaid and Graphviz DOT | `diagram-formats`, app tests | — | 4 |

Pieces are numbered by topic; build them by wave. Piece 6 needs nothing from piece 3 to compile,
so it is built alongside it, but a page export is only right once cross-page connectors stop
drawing across the gap, so it merges second.

Shared files, and who makes room in them first:

| File | Lines now | Touched by | Split first, by |
|---|---|---|---|
| `packages/diagram/src/edge.ts` | 218 | 3 | done: the four routers are in `routers.ts` |
| `packages/diagram/src/effect/EffectEditor.tsx` | 154 | 9, 11 | done: `editHandlers` moved to `effect/editorHandlers.ts` |

Every piece also: writes `patch` changesets; keeps files under 400 lines and functions under 120
(`npm run check:size`); exports only public surface to the app; updates the diagram README and
`docs/TODO.md`'s weaselchart entry in its merge; and deletes its own section of this doc when it
merges (the doc goes with the last piece). Points, offsets, and boxes here are `Vec2` and plain
boxes on purpose: everything in this arc lives on the page plane, and kernel3d hosts route no
connectors (the second arc's call, kept).


## 9. Pipeline groups as editable containers

### What the user sees

Under Node graph, a pipeline group is a titled box like a chart container: drag a stage in or out
to change membership, drag the box to carry its stages, resize it, double-click its title to
rename. Arrange › Group (⌘G) groups the selected stages; Arrange › Ungroup (⇧⌘G) dissolves the
picked group. Under Rack and Lanes, groups draw as today, and Group, Ungroup, and renaming in the
Params sidebar work; dragging membership does not.

**Decision (2026-10-20).** Groups become data containers only under `nodeGraph`: rack and lanes
place every stage, so an authored box would contradict the look, while a box fitting its members
holds in every look.

### Engine surface (`packages/diagram/src/effect/`)

- `EffectDoc.groupBoxes?: Readonly<Record<groupId, Box>>`, a sidecar like `places`.
- `editorMapping.ts`: under `nodeGraph`, each `EffectGroup` maps to a `DataContainer` with
  `box: doc.groupBoxes?.[id]` (fitting its members while unset); other looks keep mapping
  it to a `DataGroup`.
- `groupEdit.ts`: `groupStages(doc, ids, label?)` (nested inside the group all of them share, if
  any), `ungroup(doc, id)` (members go to its parent group), `renameGroup`, `moveToGroup(doc, ids,
  group | null)`, `setGroupBox(doc, id, box | null)`, and `moveGroup(doc, id, offset)`, which moves
  member places, the box, and inner wires' `routes` together; `removeStages` prunes `groupBoxes`.
- `EffectEditor`: `selectedGroup` and `onSelectGroup` beside the stage pick; `onMove` with
  `parent` and `onEditContainer` map to the edits above. Labels: "Move", "Resize group", "Group",
  "Ungroup", "Rename group".
- App: `apps/chart/src/pipeline/pipelineCommands.ts` gains the Arrange items; `ParamPanel.tsx`
  shows a picked group's name field.

### Save, load, undo

Membership saves in `EffectPipeline.groups`, as now, and boxes in `groupBoxes`; older files load
with every group fitting its members. Each edit is one `onChange`, one entry in the pipeline history.
A dragged group is one `moveGroup` (below): its stages, its box, and the routes of wires with both
ends inside move by one offset, the rule `waypointFollower` keeps in chart mode.

### Tests

- `groupEdit.test.ts`: nesting, ungroup to parent, pruning.
- `editorMapping.test.ts`: a container under `nodeGraph`, a group under the others.
- `EffectEditor.groups.browser.test.tsx`: drag a stage into a group box; resize it; undo through
  the app's pipeline history (`usePipelineDoc.ts`).

## Formats on the interchange document

Pieces 13 and 14 are codecs on the interchange document already in `@weasel-js/diagram-formats`
(its README, "The interchange document" and "Formats"): each is a `DiagramFormat` added to
`DIAGRAM_FORMATS`, reading to and writing from a `DiagramDocument`, with warnings both ways.
weaselchart's File › Import… and File › Export › As … list every registered format, so neither
piece touches the app beyond its tests. A writer reads an item's drawn colors with diagram's
`dataNodeStyle`, `dataEdgeStyle`, and `dataRegionStyle` under the document's theme, and a route as
`waypoints ?? routed`.

## 13. Mermaid and Graphviz DOT

Both carry a graph's topology and labels, not its geometry (DOT's only when every node has `pos`),
so import leaves `at` unset and `documentSpecs` lays the page out with `layered`, the way the
page's `direction` says.

### Mappings

| Diagram | Mermaid flowchart | Graphviz DOT |
|---|---|---|
| rect | `A[text]` | `shape=box` |
| stadium | `A([text])` | `shape=box, style=rounded` |
| diamond | `A{text}` | `shape=diamond` |
| ellipse | `A((text))` | `shape=ellipse` |
| hexagon | `A{{text}}` | `shape=hexagon` |
| parallelogram | `A[/text/]` | `shape=parallelogram` |
| trapezoid | `A[/text\]` | `shape=trapezium` |
| edge, label | `A -->|text| B` | `A -> B [label=…]` |
| container | `subgraph` | `subgraph cluster_*` |
| page `direction` | `flowchart TD/LR/BT/RL` | `rankdir` |
| colors | `style` and `classDef` fill and stroke | `fillcolor`, `color`, `fontcolor` |
| ports | — | `node:port:compass`, compass only |

Unknown Mermaid shapes read as rect with a warning; other Mermaid diagram kinds are refused with an
error naming the kind. DOT reads the full grammar (strict, graph and digraph, attribute statements,
edge chains, subgraphs); HTML labels are read as their text. Pools and lanes have no equivalent in
either and export as nested containers.

### Engine surface (`packages/diagram-formats/src/`)

`mermaid/` and `dot/`, each `lex.ts`, `parse.ts` (to a syntax tree), `read.ts`, and `write.ts`,
registered in `DIAGRAM_FORMATS` with extensions `.mmd`/`.mermaid` and `.dot`/`.gv`, each with
`onePage`, so export writes the page in view. An import is one undo entry, "Import"; an export
writes nothing to the scene.

### Tests

- Parser tests over fixtures in `__fixtures__/`; read tests per row of the table; write then read
  gives the same topology, labels, shapes, and containers; warnings for each unsupported construct.
- Chart test: import a `.mmd`, the canvas holds the laid-out nodes.

## Fourth arc (not designed)

- PDF export, as its own package.
- Playing an audio pipeline through `@weasel-js/audio`: a graph built once on the audio clock and
  patched as the pipeline is edited.
- Pages in a data-backed `DiagramView`, and off-page markers there.
- Dragging an edge label by hand, which label placement then keeps.
- Authored group boxes under the `rack` and `lanes` looks.
