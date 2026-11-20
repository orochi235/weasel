---
'@weasel-js/renderer': patch
---

A WGSL program's own uniform member named like a kit member, such as `bounds` or `resolution`, keeps its own value.

The kit's value reaches the kit's member, in effects, custom programs, and paint kinds alike.

<!-- entry: fix visual -->
