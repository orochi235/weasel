---
'@weasel-js/text-dom': patch
---

Ending a text edit and starting one on the same node in the same event, as a press on the node outside the overlay can, opens a fresh overlay from the node, so what is typed next is committed.

<!-- entry: fix -->
