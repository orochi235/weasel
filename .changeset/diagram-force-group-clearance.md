---
"@weasel-js/diagram": patch
---

The force layout pushes a node or group sitting inside another group's box past that box's far edge, by the padding. It pushed by how far the two overlapped, which for a box inside the other was only its own size, so one tick left it still inside.
