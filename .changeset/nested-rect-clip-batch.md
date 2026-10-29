---
'@weasel-js/renderer': patch
---

Nested rect clips stay in the batch. Clipping in the batch shader now merges planes that face the same way, so any depth of nested axis-aligned clips keeps four planes, and a slanted item across them no longer falls back to the stencil. 512 such items across three nested clips went from 3,584 draws to 32.
