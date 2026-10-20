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
| 13 | Mermaid and Graphviz DOT | `diagram-formats`, app | 12 | 4 |

Pieces are numbered by topic; build them by wave. Piece 6 needs nothing from piece 3 to compile,
so it is built alongside it, but a page export is only right once cross-page connectors stop
drawing across the gap, so it merges second.

Shared files, and who makes room in them first:

| File | Lines now | Touched by | Split first, by |
|---|---|---|---|
| `packages/diagram/src/edge.ts` | 218 | 3 | done: the four routers are in `routers.ts` |
| `packages/diagram/src/fromData.ts` | 264 | 12 | done: the data types are in `dataTypes.ts`, re-exported |
| `packages/diagram/src/effect/EffectEditor.tsx` | 181 | 11 | done: `editHandlers` moved to `effect/editorHandlers.ts` |

Every piece also: writes `patch` changesets; keeps files under 400 lines and functions under 120
(`npm run check:size`); exports only public surface to the app; updates the diagram README and
`docs/TODO.md`'s weaselchart entry in its merge; and deletes its own section of this doc when it
merges (the doc goes with the last piece). Points, offsets, and boxes here are `Vec2` and plain
boxes on purpose: everything in this arc lives on the page plane, and kernel3d hosts route no
connectors (the second arc's call, kept).


## 13. Mermaid and Graphviz DOT

Both carry a graph's topology and labels, not its geometry (DOT's only when every node has `pos`),
so import lays out with `layered`, which the package already does well.

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
| direction | `flowchart TD/LR/BT/RL` | `rankdir` |
| colors | `style` and `classDef` fill and stroke | `fillcolor`, `color`, `fontcolor` |
| ports | — | `node:port:compass`, compass only |

Unknown Mermaid shapes read as rect with a warning; other Mermaid diagram kinds are refused with an
error naming the kind. DOT reads the full grammar (strict, graph and digraph, attribute statements,
edge chains, subgraphs); HTML labels are read as their text. Pools and lanes have no equivalent in
either and export as nested containers.

### Engine surface (`packages/diagram-formats/src/`)

`mermaid/` and `dot/`, each `lex.ts`, `parse.ts` (to a syntax tree), `read.ts`, and `write.ts`,
registered in `DIAGRAM_FORMATS` with extensions `.mmd`/`.mermaid` and `.dot`/`.gv`. Export writes
the current page. Saving and undo are piece 12's: an import is one entry, an export writes nothing.

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
