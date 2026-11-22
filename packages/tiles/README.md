# @weasel-js/tiles

Tile pyramids over any space. A **scheme** names tiles by key and answers each one's parent,
children, level and bounds, and which tiles a view wants; `createPlaneScheme(tilePx)` is the one for
a plane, with `z/x/y` keys. A `TilePyramid` holds the tiles in a cache bounded by count and bytes
together, least recently drawn evicted first, with the floor (the content at a level where it fits a
few tiles a side) pinned. Each frame, `run(view, now, bake, budget)` bakes what the budget allows,
floor first, then what is missing on screen nearest the center, then what an edit made stale, then
the level a zoom out lands on and a ring past the screen. It answers what to draw: each tile on
screen, or a coarser tile's matching part with any finer tiles held over it, a new tile fading in.

No GPU and no DOM: the payload and how it is baked are the caller's. `@weasel-js/core` bakes a
canvas layer into renderer textures with it.

```ts
import { createPlaneScheme, planeFloor, TilePyramid } from '@weasel-js/tiles';

const scheme = createPlaneScheme(512);
const pyramid = new TilePyramid({
  scheme, bytesOf: (t) => t.bytes, release: (t) => t.free(), maxBytes: 256 << 20,
  floor: () => planeFloor(scheme, 512, contentBounds),
});
const frame = pyramid.run({ box: [x0, y0, x1, y1], pxPerUnit }, performance.now(), bakeTile,
  { ms: 10, tiles: 4, clock: () => performance.now() });
```
