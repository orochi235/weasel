---
'@weasel-js/core': minor
---

A `<SceneCanvas pathEdit>` host with a `subscribe` repaints the canvas when it notifies, so it no longer needs to be passed in `redrawOn` too.

`PathEditHost` gains an optional `subscribe(listener)`: notified when the open path or its selected anchors change.

<!-- entry: api -->
