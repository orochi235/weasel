---
'@weasel-js/ui': patch
---

Additive: `draftChangedAssets(key, original, codec, storage?)` reads a stored `AssetEditor` draft and returns the ids of the assets it changes from `original`, which is what the editor reports through `onChangedAssets` once it mounts. A host that shows one editor at a time can mark another editor's assets `changed` in `elsewhere` before that editor has been opened. It only reads: a draft the source has caught up with stays in storage for the editor to drop.
