---
'@weasel-js/ui': patch
---

An asset another editor holds can be listed as changed. `ListedAsset` takes `changed`, which draws its row in `AssetEditor`'s list as a changed asset of the editor's own is drawn, and `AssetEditor` takes `onChangedAssets`, called with the ids of the assets that differ from the baseline when it mounts and whenever that set changes. A host showing one editor at a time keeps what each reported and marks it in the others' `elsewhere`; until now an asset lost its mark the moment the reader picked one held by another editor.
