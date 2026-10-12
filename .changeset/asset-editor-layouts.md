---
'@weasel-js/ui': patch
---

`AssetEditor` lists the settings of a layout's dialog under the layout's structure tree. A setting dragged from the list lands in the layout as a pointer to it, and a group as a heading over a pointer to each setting it holds; a setting the layout already points at is drawn muted. The list is left out for a dialog and for a read-only layout. A host's `rowMark` is asked about a layout's pointer by the path of the setting it names, and about no other row of a layout.

The asset list files a layout whose root is drawn `as: 'bar'` under Toolbars.

Adds API on `AssetEditor`: `elsewhere`, assets another editor holds, listed after its own under the same headings, with `onElsewhere(id)` for a pick of one; `startOn`, the id of the asset shown when it mounts; and `preview(asset, over)`, which draws an asset's preview in place of the editor's own. The `ListedAsset` and `AssetHeading` types are exported, and `headingOf(asset)`, the heading the list files an asset under, for a host that lists another editor's.
