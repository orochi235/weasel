---
'@weasel-js/ui': patch
---

`prefDropTargetAt` takes `{ railInto: false }`: over a rail entry the drop then lands beside it from either half, never into its group. `PrefSchemaEditor` asks for that when a page is dragged, so a page from the palette or the tree goes above or below the rail's entries, at the top level. A tab, panel, section, or leaf over the rail lands as before.
