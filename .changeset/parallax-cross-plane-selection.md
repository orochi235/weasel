---
'@weasel-js/core': patch
---

Editing a selection that spans parallax planes lands every node where it was drawn. Move, resize, rotate and clone used to measure the whole selection in one plane — the handle's target's, else the first selected node's — so a node on a plane that scales differently drifted off the pointer. Each node is now carried into that plane as the gesture starts and back into its own as it lands. A move that reparents a node onto another plane's layer, or drops it into a layout container there, carries its pose across, so it lands where it was drawn.

`ViewApi` gains an optional `planeOf(layer)`, which `inPlane` sets: how the world an invocation edits in maps into the world a layer's nodes are stored in. `inPlane` now wraps an action whenever the scene has any parallax layer, not only when the edited layer has one.
