---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`'s Structure pane has "Expand all" and "Collapse all" buttons at the right of its header, which open or fold every branch of the tree. Both are disabled while the filter is set, since a filter opens every branch it shows.
