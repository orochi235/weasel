---
'@weasel-js/guides': minor
---

Rulers can run along a canvas that is not a `<SceneCanvas>`: `Rulers.follow(view, size)` reports its view and size.

Such a host installs the contribution's actions, bindings and hit layer on its own dispatcher, and calls `follow` whenever its view or size changes.

<!-- entry: api -->
