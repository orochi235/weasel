---
'@weasel-js/diagram-formats': patch
---

The Mermaid kanban writer leaves out a `column-N` or `card-N` id only where the reader gives the same id back, so a board keeps its ids across a round trip.

<!-- entry: fix data -->
