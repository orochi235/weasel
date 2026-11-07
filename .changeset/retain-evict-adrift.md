---
'@weasel-js/renderer': patch
---

A retained layer that follows a pan now gets its margin when the retain budget is full but holds surfaces of layers that cannot follow the pan. Such a layer (a custom shader, a paint in screen units, or effects that do not say how far they reach) is drawn straight through while it moves and drawn again once it holds, so its kept pixels are dead weight for the pan; the renderer now frees them, largest first, before it refuses a margin or any other surface. Before, the margin went to whichever layer asked first, and the layers past the budget were drawn straight through for the rest of the pan. A layer refused a margin earlier in the pan gets one as soon as freeing those surfaces would make room.
