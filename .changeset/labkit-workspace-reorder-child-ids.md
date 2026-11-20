---
'@weasel-js/labkit': patch
---

A `<Workspace>`'s `onReorder` lists only its children's ids, leaving tile panels out. A child whose id starts with `lk-panel-` draws as itself rather than as an empty panel.

<!-- entry: fix -->
