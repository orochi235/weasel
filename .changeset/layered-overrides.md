---
"@weasel-js/core": patch
"@weasel-js/diagram": patch
---

Several writers can now override one node at once. Each entry set on `scene.overrides` is a layer over the ones set before it: for each field the most recently set layer that gives it wins, `alpha` multiplies through every layer, and `data` runs each layer's function on what the layers under it show. Releasing a layer shows what lies under it. So a gesture's published preview no longer gives way where another writer holds the node: the data a move previews for a transform follower shows while the move holds the follower's pose, and an edge whose live route is eased shows the drag's reroute beside the route, so what derives from either follows every frame.

`has` and `clear` take an optional entry, to check or release one writer's layer: `has(id, entry)`, `clear(id, entry)`. `clear(id)` still drops the node's every layer. `get(id)` answers the top layer. This is a behavior change for a writer that set an entry over another's to replace it, or that checked `get(id) === entry` to know its own was still installed: the earlier entry now stays and shows again when the later one goes, and `get` answers only the top one. A hold's `show` no longer leaves an id another writer holds to that writer; it lays its frame over it.
