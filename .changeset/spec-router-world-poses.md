---
'@weasel-js/diagram': patch
---

`createSpecRouter` reads each shape and port where it draws, folding its pose through the containers above it, so `router="avoid"` routes an edge to and around a container's members where they are. Since specs began storing a member's pose in its container's frame, it read that pose as a world box: an edge to a member started off its shape, and the members between two others were no obstacle. It takes a `composition` option, which must match the one `diagramScene` was given; the default is the same.
