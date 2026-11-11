---
"@weasel-js/editor": patch
"@weasel-js/core": patch
---

A document saved through `serializeReplacer` reads back equal through `reviveTypedArrays` whatever its data holds: a plain object shaped like a tagged typed array, or plain numbers under a `commands` or `coords` key, had come back as a typed array. Such a value is now written inside a `{ "__raw": … }` wrapper that the reader takes off; older saves read as before. A malformed snapshot is refused with an error naming what is wrong rather than a `TypeError`: a node that is not an object or lacks a string `id`, `layer`, or `kind` (`specsFromSerialized`), `systemLayers` that are not a list of layers (`sceneFromJSON`), and a `core:pages` value that is not a `PagesDoc` (`adoptSnapshotPages`).
