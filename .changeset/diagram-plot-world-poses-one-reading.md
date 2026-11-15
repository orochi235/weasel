---
'@weasel-js/diagram': patch
'@weasel-js/plot': patch
---

Diagram sequences, the avoid router's scene input, and plot handles read a node's world pose through core's `worldPoses`, with no change to what they read.

<!-- entry: internal -->
