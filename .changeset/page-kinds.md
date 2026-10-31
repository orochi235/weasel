---
"@weasel-js/diagram-formats": patch
---

Pages in a `DiagramDocument` now carry a required `kind`, today always `'graph'`, so documents can later hold other kinds of page. `DocumentPage` is a union (`GraphPage` is its graph member, with an optional `notation`), every `DiagramFormat` lists the page `kinds` it holds, and `formatHolds`, `graphPageOf`, and `graphPagesOf` help a writer that holds only graphs. Breaking for code that builds pages by hand: add `kind: 'graph'`. The JSON reader reads a page with no `kind` as a graph.
