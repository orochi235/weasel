---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

Moving or nudging a node whose pose is derived from an id list (`derivePose` with a `dependsOn` list) now moves the nodes it derives from, through however many derived nodes that takes; a pose written to the derived node itself was overwritten on the next read. A diagram group's box is pickable again, so dragging it, or its title, moves the group's members.
