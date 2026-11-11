---
"@weasel-js/editor": patch
"@weasel-js/core": patch
---

A malformed snapshot is refused with an error naming what is wrong, rather than a `TypeError`. That covers a node that is not an object or lacks a string `id`, `layer` or `kind` (`specsFromSerialized`), `systemLayers` that are not a list of layers (`sceneFromJSON`), and a `core:pages` value that is not a `PagesDoc` (`adoptSnapshotPages`).

<!-- entry: fix -->
