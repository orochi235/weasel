---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`: undoing a move dropped after the drag opened a rail page goes back to the selection the drag began with, so the preview shows the page the node returned to. It used to select the group whose page the drag had opened.
