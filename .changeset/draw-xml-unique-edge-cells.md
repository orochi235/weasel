---
'@weasel-js/diagram-formats': patch
---

Draw-style XML gives every edge a cell id of its own. Two edges with the same ends, ports, and label, or an edge whose own id another cell had, were written under one id, so the file held duplicate cells and an end label read back on the wrong edge; the later one is now numbered on (`edge:a->b-2`).
