---
'@weasel-js/core': patch
'@weasel-js/diagram-formats': patch
---

A core `Page` can carry `meta`: values other packages keep on the page, each under its owner's key. Every page edit
(`addPage`, `removePage`, `movePage`, `resizePage`, `renamePage`, `setPages`) and `layoutPages` carry it, and undo
restores it with the page.

`documentSpecs` writes a graph page's `notation`, `layout`, and `direction` to its page's `meta['diagram:graph']`, and
`documentFromScene` reads them back, so a Mermaid class, state, C4, block, or other non-flowchart page drawn into a
scene exports as the same kind, a block diagram keeps its columns, spans, and spaces, and a flowchart keeps its
direction. `GRAPH_PAGE_META_KEY`, `graphPageSettingsOf`, and `GraphPageSettings` are exported. This adds API.
