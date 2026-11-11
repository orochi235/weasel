---
'@weasel-js/diagram-formats': patch
---

Mermaid writes text holding a line break on lines its readers read back. A quoted string spells a line break `#10;`, so a class diagram's labels and a chart's quoted names keep it, and a class diagram spells a `#` as `#35;` and reads entities in its edge labels; a title or name a kind holds on one line (quadrant, packet, pie, radar, journey, gitGraph, requirement, ER rows, architecture titles) is written with each break as a space, with a warning. Before, the break split the statement and the file failed to read or read as something else. A flowchart's or architecture group's title that opened or ended with a line break read back with a stray space.
