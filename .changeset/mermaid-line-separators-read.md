---
'@weasel-js/diagram-formats': patch
---

Mermaid readers read a line or paragraph separator (U+2028, U+2029) inside a statement as text. Gantt, xychart, quadrant, radar, gitGraph, and other readers threw a `TypeError` on one, and a front matter title holding one was cut at it.
