# Mermaid's other diagram kinds

**Status: unbuilt (2026-10-31).** Being built in arcs; each arc's section is deleted as it merges, and
this file goes when the last does.

For whoever builds or reviews an arc. It says how weasel reads and writes every Mermaid diagram kind,
not just flowcharts, and what engine surface that needs. Decided with Mike on 2026-10-31.

## Pages have kinds

`DocumentPage` (`@weasel-js/diagram-formats`) is a union on a required `kind`:

```ts
type DocumentPage = GraphPage | SequencePage | PlotPage;
interface PageBase { id: string; name?: string; width: number; height: number }
interface GraphPage    extends PageBase { kind: 'graph';    data: DiagramData;  direction?: LayoutDirection; notation?: string }
interface SequencePage extends PageBase { kind: 'sequence'; data: SequenceData }
interface PlotPage     extends PageBase { kind: 'plot';     data: PlotData }
```

- The JSON reader reads a page with no `kind` as `'graph'`; nothing else carries a compat path.
- `crossPageEdges` joins graph pages only.
- `documentSpecs` dispatches to `graphSpecs`, `sequenceSpecs`, `plotSpecs`, so SVG, PNG and PDF export
  work for every kind.
- `DiagramFormat.kinds` lists the page kinds a format reads and writes. A graph-only writer skips other
  pages with a warning each, and throws when the page it was asked to write is not a graph.
- `notation` names what a graph models (`'class'`, `'state'`, `'er'`, `'mindmap'`, `'requirement'`, …).
  The Mermaid writer picks its diagram kind from it, `flowchart` when unset; other formats ignore it.

Rejected (2026-10-31): lowering sequence and charts into pinned graph nodes, which loses messages and
values on export and edits geometry instead of data; and a separate document per kind, which splits
import and save in two.

## Graph kinds

| Mermaid | Nodes | Edges |
| --- | --- | --- |
| `classDiagram` | name row (`<<stereotype>>`, `~T~`), divider, attribute rows, divider, method rows; `namespace` → group; `note` → `note` outline | `<\|--` `triangle-hollow`, `*--` `diamond`, `o--` `diamond-hollow`, `-->`, `..>` dashed `arrow-open`, `..\|>` dashed `triangle-hollow`, `--`; cardinalities as end labels |
| `stateDiagram-v2` | state rounded; `[*]` → `start` / `end` outline; `<<fork>>`/`<<join>>` → `bar`; `<<choice>>` → diamond; `state X { }` → container; `--` → lanes in it | labeled transitions |
| `erDiagram` | name row, divider, one `field` row per attribute (type as label, name as value, keys and comment kept) | crow markers at both ends; `--` solid, `..` dashed |
| `mindmap` | indentation tree, shapes `[]` `()` `(())` `))((` `{{}}` | unmarked links, laid out by `radial` |
| `requirementDiagram` | requirement and element blocks as `field` rows | dashed arrow labeled `<<satisfies>>` etc. |

Engine surface: `DataEdge.endLabels?: { from?: string; to?: string }` through the label trait at
`start`/`end`; outlines `start`, `end`, `bar`. Mind maps lay out with the existing `radial`, which already is a two-sided tree (decided in arc 2, 2026-10-31, over a second two-sided option on `tree`).

## Codec and app

`mermaid/common/` holds front matter, `%%` comments, `accTitle`/`accDescr`, `classDef`/`style`; each kind
has its own directory with lex, parse, read and write. `DIAGRAM_MERMAID` stays one format: `read`
dispatches on the header keyword, `write` on page kind and `notation`, one page per file.

apps/chart opens each page in its kind's editor (`DiagramView`, `DiagramView` with sequence ops,
`PlotView`) under one page list, theme, undo and import/export; Save As greys out formats whose `kinds`
cannot hold the document.

## Arcs

1. Document union.
2. Graph kinds.
3. Sequence (built).
4. Plot foundation.
5. Plot kinds (built).

Each lands with engine, codec, app support, tests and a site demo per kind. 2–4 depend only on 1.
