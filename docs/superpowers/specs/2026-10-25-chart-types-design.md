# Chart types and stencil libraries

**Status: in progress on branch `chart-types` (2026-10-25). Delete this file when the branch merges.**

For whoever builds or reviews the `chart-types` arcs. It says what a chart type is, where each part
lives, and what each arc delivers. Decisions made in conversation (2026-10-25): a chart type is a
Visio-style diagram kind, not a data chart; a chart records its type, but the type is a starting
point (any stencil group can be added beside it); the first pass ships org chart, network, UML
class, ERD, mind map, and BPMN beside the existing flowchart.

## What a chart type is

A **stencil group** is a named list of stencils: the flowchart symbols, the containers, the network
devices. A **diagram type** names the groups a new chart opens with, and the defaults its new
connectors take (router and end markers), and optionally the layout Arrange › Auto layout runs.

```ts
// packages/diagram/src/diagramTypes/types.ts
interface StencilGroup {
  id: string;
  label: string;
  stencils: readonly (DiagramStencil | ContainerStencil)[];
}

interface DiagramType {
  id: string;
  label: string;
  icon?: IconRef;
  /** Group ids, in Shapes-panel order, that a new chart of this type opens with. */
  groups: readonly string[];
  /** What a new connector is drawn with. Unset fields fall to the theme. */
  edge?: { router?: RouterName; markerStart?: MarkerRef | null; markerEnd?: MarkerRef | null };
  /** A key of `LAYOUTS`; Arrange › Auto layout runs it. Unset: no auto layout. */
  layout?: string;
}
```

Both are plain data in `@weasel-js/diagram`: `STENCIL_GROUPS` and `DIAGRAM_TYPES` are exported
catalogs, each stencil set in its own module under `packages/diagram/src/stencils/`. There is no
global registry; a host composes the catalogs it wants and passes them down.

A chart stores its choice in a document value, `DIAGRAM_TYPE_DOC_KEY`, holding
`{ type: string; groups: string[] }` — the type, and the groups its Shapes panel shows. A chart with
no such value (every chart saved before this) reads as flowchart with the flowchart and container
groups. Adding or removing a group is a doc write, so it is undoable and saved with the chart.

## Named outlines

`Outline` stops being a closed union. It becomes `BuiltinOutline | (string & {}) | Path`, and a
named outline resolves through an outline table:

```ts
interface OutlineDef {
  path(bounds: Bounds): Path;          // filled and stroked; also the silhouette
  detail?(bounds: Bounds): Path;       // stroked only, drawn over the fill (a cylinder's rim)
  content?(bounds: Bounds): Bounds;    // where rows lay out; default the bounds
  boxForContent?(content: Size): Size; // the inverse; default the content size
}
registerOutline(name: string, def: OutlineDef): () => void;
outlineFromD(d: string, opts?: { detail?: string; content?: Bounds }): OutlineDef; // unit-square SVG path data
```

The current seven built-ins move into the table, unchanged. A saved name that is not registered
paints as `rect` and warns once. Arc 2 adds the outlines the later arcs need (cylinder, document,
cloud, note, rounded rect, triangle, octagon, folder, cube, and an actor figure, plus the
double ellipse BPMN's intermediate events use).

New stroke markers go in `@weasel-js/stroke`'s built-ins: the crow's-foot family (`crow-one`,
`crow-many`, `crow-zero-one`, `crow-one-many`, `crow-zero-many`) and `triangle-hollow` for UML
generalization.

## The arcs

Each arc is a branch off `chart-types`, merged back when its scoped tests and the typecheck pass;
`chart-types` merges to `main` after a green `test:fleet`, `test:gate`, and `test:fleet:postbuild`.

| Arc | Delivers |
|---|---|
| 1. Types and groups | `StencilGroup`, `DiagramType`, the doc value and its reader/writer, `flowchart` and `containers` groups and the `flowchart` type. In weaselchart: File › New… opens a type picker; the Shapes panel shows one collapsible section per open group and a "More shapes" menu that adds or removes groups; new connectors take the type's edge defaults; Arrange › Auto layout runs the type's layout when it has one. |
| 2. Outlines and markers | The outline table, `registerOutline`, `outlineFromD`, `detail` painting, the new built-in outlines, the crow's-foot markers, and `triangle-hollow`. |
| 3. Network and BPMN | `network` and `bpmn` groups and types. Device outlines authored as unit-square SVG path data. BPMN end events draw a heavier stroke, so `DiagramStencil` gains an optional `style` override. |
| 4. UML class and ERD | A `divider` body row (a rule across the body). Class, interface, package, note, actor, and use case; entity, weak entity, relationship, and attribute. Types default their edges: UML to `arrow-open`, ERD to `crow-one` → `crow-many`. |
| 5. Org chart and mind map | Person cards and topic shapes; `orgChart` lays out with `tree`; `mindMap` with a new `radial` layout that balances branches left and right of the central topic. |
