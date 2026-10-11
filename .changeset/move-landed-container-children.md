---
'@weasel-js/core': patch
---

A container dragged into a layout container, or landed by a move behavior that answers `onEnd` with ops such as `snapToContainer`, takes its children with it on a scene with absolute poses. The container used to land where the layout or behavior put it while each child kept its old pose. Each child now moves by the container's landed pose less its start pose, in the same undo step.
