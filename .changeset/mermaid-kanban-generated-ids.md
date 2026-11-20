---
'@weasel-js/diagram-formats': patch
---

The Mermaid kanban writer keeps a `column-N` or `card-N` id across a round trip. It leaves one out only where the reader gives the same id back.

<!-- entry: fix data -->
