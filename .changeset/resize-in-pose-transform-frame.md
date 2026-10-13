---
'@weasel-js/core': patch
---

Fixes: resizing a node whose pose carries a `transform` took the drag in the unskewed box's axes, so the dragged corner left the pointer and the opposite corner slid. The drag is taken in the frame the node is drawn in: the dragged corner follows the pointer and the opposite one stays where it is drawn. A resize still writes the box and keeps the `transform`. A point snap is told where the corners are drawn, and lands the drawn corner on the point it names.
