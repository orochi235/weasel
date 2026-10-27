---
'@weasel-js/core': patch
---

The layout pass lays a turned container's children out along the container's own axes. `childPoses`, `arrive` and `depart` now see a turned container upright, in its own frame placed where its unturned box sits, with its children in that same frame; before, they got the container's unturned box beside children in their turned world poses, so a stack or tile grid in a rotated container placed its children off its axes and outside it. A size `arrive` or `depart` asks for grows the container along its own axes. Upright containers are seen in world exactly as before.
