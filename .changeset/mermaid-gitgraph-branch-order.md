---
'@weasel-js/diagram-formats': patch
---

The Mermaid git graph writer rounds a branch order that is not a whole number, and drops one below zero or not a number, with a warning.

<!-- entry: fix -->
