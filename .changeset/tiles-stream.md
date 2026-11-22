---
'@weasel-js/tiles': minor
---

`TileStream` loads the tiles of one level around a moving view: nearest first, a few at once, aborting what the view leaves.

`new TileStream({ scheme, level, load(key, signal), release(key, payload), maxConcurrent: 4, maxHeld: 256 })`; `update(view, ahead?)` wants what `view` shows and its ring, then what `ahead` shows, and releases held tiles past `maxHeld`, the longest unwanted first. An aborted load counts against the cap until it settles.

<!-- entry: new api -->
