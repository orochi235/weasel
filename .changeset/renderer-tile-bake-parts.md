---
'@weasel-js/renderer': minor
---

A tile can be baked over several calls: `renderer.tiles.begin(size)` starts one, each `draw` adds to it, and `finish` keeps it.

`begin` answers a `TileBake` holding a multisampled buffer of its own, cleared to transparent; `draw(commands)` draws over it and answers false once the context was lost, `finish()` resolves it into a pooled tile texture as `bake` does, and `cancel()` frees it.

<!-- entry: new api -->
