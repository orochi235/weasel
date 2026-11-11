---
'@weasel-js/diagram-formats': patch
---

Mermaid writes text holding a line break so that its readers read it back.

A quoted string spells a line break `#10;`, so a class diagram's labels and a chart's quoted names keep it, and a class diagram spells a `#` as `#35;` and reads entities in its edge labels. A title or name a kind holds on one line (quadrant, packet, pie, radar, journey, gitGraph, requirement, ER rows, architecture titles) is written with each break as a space, with a warning. A flowchart's or architecture group's title that opens or ends with a line break reads back without a stray space.

<!-- entry: fix data -->
