# Review saturation for `diagram-formats.drawXml`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 14 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Cell ID normalization and geometry reference resolution | 1 | 1 | 0 |
| 2 | Import cost across wide layers and shared parents | 1 | 2 | 0 |
| 3 | Hidden cells, relative positions, and parent cycles | 0 | 2 | 1 |
| 4 | Edge geometry, ports, labels, and style mappings | 0 | 2 | 2 |
| 5 | Compressed model decoding, page handling, and XML export | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Duplicate cell IDs can move a vertex to another vertex's position

[cells.ts](packages/diagram-formats/src/drawXml/cells.ts#L89) · Pass 1 · Medium · Source-traced

Import a graph model with two vertices sharing an explicit ID and carrying different positions. cellsOf only repairs missing IDs. readPage renames one of the outputs, but pageCells resolves origins by the original ID, so both output vertices receive the last vertex's origin and connectors resolve ambiguously. The importer should flag the duplicate or handle the ambiguity before computing geometry.

### 2. Import copies a layer's growing child list for every vertex

[pageCells.ts](packages/diagram-formats/src/drawXml/pageCells.ts#L88) · Pass 2 · Low · Source-traced

Import a flat page with a large number of shapes on one layer. Building the child index spreads the entire existing list for each shape, so one layer with n vertices costs quadratic array copying even though the shapes do not need nested classification. Large flat pages can visibly stall during import.

Source and tests were left untouched.
