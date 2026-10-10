---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` has a bar across its top holding the palette, Add pref, Add group, Remove, Undo, Redo, and the draft's controls, which were in the structure pane's header. A new `bar` prop sets the host's own controls first in it.

The structure pane has a filter field: the tree narrows to the rows whose name or key matches, under the branches that hold them. Rows cannot be dragged to a new place while it is filtered.

A press on a rail entry in the live preview that does not turn into a drag opens that page again.
