---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` keeps a catalog for its Actions list, so the reader can sort, group, and edit the host's actions there as `AssetEditor` lets them. Additive: `actionCatalog` starts the list from a catalog the host kept, and `onActionCatalogChange` hands back each edit of it. The catalog is kept in the draft beside the schema with its steps, a draft saved before still opens, and a submission still holds the schema's changes alone.

In both editors, a step back over an edit made in the Actions list picks again the rows that were picked there when the edit was made.
