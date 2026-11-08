---
'@weasel-js/core': patch
'@weasel-js/editor': patch
---

`usePages().add` puts a new page after the page shown, so a view sitting between pages adds after the one it was last on rather than at the end. It takes an optional `make`, which adds a page of its own at the place and size `add` picked and answers its id. `snapToContainer` no longer offers a drop into a dragged node or one of its descendants, which the scene refused by throwing. Deserialization reads a registry key, and `isLayerVisible` a layer's visibility, only as an own property, so a key or layer id like `toString` no longer resolves through the object's prototype.
