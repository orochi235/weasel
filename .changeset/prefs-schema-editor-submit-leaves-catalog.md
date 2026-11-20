---
'@weasel-js/prefs-editor': minor
---

Sorting the Actions list in `PrefSchemaEditor` no longer turns Submit on or lists the catalog under Changes.

`AssetEditor` takes `sends(asset)` to pick which assets' changes the Changes pane lists and Submit hands over; left out, every asset's are.

<!-- entry: fix api -->
