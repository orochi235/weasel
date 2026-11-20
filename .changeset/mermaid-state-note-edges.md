---
'@weasel-js/diagram-formats': patch
---

Mermaid state notes write back as notes, never as phantom states. A note joined from its state sits beside it; one beside only a start or end, and a note's connectors past its first, are dropped with a warning.

<!-- entry: fix data -->
