---
"@weasel-js/diagram": patch
---

A self-edge on a node with no east-facing port loops at the same corner however the node's ports are listed. `selfLoop` took the first of two sides facing east alike, north or south, so reordering the ports moved the loop; it now takes the one facing north.
