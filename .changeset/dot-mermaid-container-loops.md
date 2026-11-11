---
'@weasel-js/diagram-formats': patch
---

The DOT and Mermaid writers write the nodes of containers that hold each other in a loop, with a warning, rather than dropping them.

<!-- entry: fix -->
