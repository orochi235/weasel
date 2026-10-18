---
'@weasel-js/renderer': patch
---

`retainBudget` now counts only the surfaces retained groups keep between
frames. The multisampled buffer they are drawn in is transient: it is freed
after the first frame that redraws nothing, so a still canvas holds only its
surfaces. It used to count against the budget and took 131 MB of the 256 MB
default at 4x on a 2560x1600 canvas, leaving room for about 8 canvas-sized
surfaces; about 16 now fit. On a frame that redraws a surface, GPU memory can
reach the budget plus that buffer, at most one canvas-sized multisampled
buffer.
