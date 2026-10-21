---
"@weasel-js/core": patch
---

Pressing a node inside a selected group no longer selects that node on the press. A drag that starts
there moves the group, and a click that ends without a drag selects the node, as a press on one member
of a multi-selection already did. It used to select the member on the press, so the drag moved the
member alone and left the rest of the group behind.
