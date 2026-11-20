# Tile-pyramid layer

**Status: designed 2026-11-19, unbuilt.** Arc 3 of the scale arcs (`docs/TODO.md`, "Scale", the entry
"A tile-pyramid layer", which holds its closing condition). For whoever builds it. It rests on arc 1
(`2026-11-19-render-visibility.md`): the touched-ids feed and reach boxes. pezlie's wall
(`wall/src/tiles.ts`, read at 62f87a5, 2026-11-19) is the prior art, and its numbers are the defaults
below.

## The problem

`retain` keeps a layer's pixels only while the view holds its zoom. A pan by whole device pixels
moves the kept surface. Any zoom draws the layer again: `retainedId` (`core/layers/retain.ts`) gives
up when the scale changes, and `RetainedSurfaces` keys a surface on the exact transform. So a heavy,
mostly static layer (a map, a page of scanned art, a 100k-node backdrop) costs a full draw on every
frame of a zoom. That is when frames matter most.

A tile pyramid keeps the layer's pixels at power-of-two scales, in square tiles in the layer's own
world space. A zoom draws tiles it already holds, resampled. It bakes the missing ones under a frame
budget, and a coarser tile stands in until a finer one is ready.

## What it adds

### 1. Opting in

Tiling is a choice about how a view paints. It is not a fact about the document, so it is not saved,
it does not cross undo, and two views of one scene can differ (a minimap can tile while the main
view draws live).

- A scene layer opts in from the view: `<SceneCanvas tiles={{ backdrop: {} }}>` and the same prop on
  `<SceneViewCanvas>`, keyed by scene layer id. A worker view sends the prop with the view settings,
  as it sends layer visibility now.
- A consumer `RenderLayer` sets `tiles: TileOptions`. Its only change signal is `deps`: when they
  move, every tile of the layer goes stale. A scene layer gets per-tile dirtying (section 4).
- A screen-space layer cannot tile, and declaring `tiles` on one throws. A layer with effects tiles
  only when `effectsReach` is finite and no effect is `screenAnchored`, the same test
  `movesWithView` makes. A layer holding a custom shader or a screen-unit paint draws live.

| `TileOptions` | Default | What it sets |
|---|---|---|
| `tilePx` | 512 | A tile's side in texels |
| `maxLevel` | none | The finest level. Past it the layer draws live, so a deep zoom stays vector-sharp |
| `floorTiles` | 2 | The pinned floor level holds the layer's whole reach in at most this many tiles a side |
| `fadeMs` | 160 | Crossfade length |

The frame budget is the canvas's, shared by every tiled layer on it: `tileBudgetMs`, default 10.

### 2. Key, pyramid, and level

A tile is `z/tx/ty`. At level `z` a tile covers `tilePx / 2^z` world units a side, so `2^z` texels
per world unit, with its corner at `(tx, ty) × that size`. The level for a view is the coarsest one
at least as sharp as the screen: `z = ceil(log2(max(|scale.x|, |scale.y|) × dpr))`. A tile is then
drawn at between 1 and 2 device pixels per texel, which bilinear sampling handles without mipmaps.
A zoom parked on a level boundary would flip between two levels, so the level changes only once
`log2` passes the boundary by 1/16 of a level.

A parallax layer picks its tiles through its own plane view. The tiles themselves stay in the
layer's world space, so a parallax camera move is an ordinary pan or zoom over them.

Each tile is baked with a one-texel gutter of its neighbors' content and sampled inset. Its quad's
edges are rounded to device pixels, as pezlie's `placed` does, so neighboring tiles meet with no
hairline. Bilinear filtering clamped at the tile edge would otherwise show the seam.

### 3. What bakes a tile, and the budget

The canvas's own renderer bakes tiles: on the main thread for a page canvas, in the worker for a
worker view. The worker already holds the scene mirror and the renderer, so nothing new crosses.

| Baker | 😇 / 😈 |
|---|---|
| The canvas's renderer | 😇 The texture is already where the frame samples it. 😇 It shares the retained path's multisampled scratch buffer and its `resolve`, which already works around ANGLE Metal's blit overreach (`docs/traps/rendering.md`) |
| `renderSceneToPixels` | 😈 Reads 1 MiB back to the CPU per tile and uploads it again. 😈 It draws on a second context, whose textures the canvas cannot sample |
| A helper worker sending `ImageBitmap`s | 😈 A third copy of the scene, and an upload per tile. A canvas that needs its bakes off the main thread uses the worker view |

The TODO entry says tiles bake "through `renderSceneToPixels`". The planning half of that holds: a
bake is the scene walk for a source rect at a scale, as `planPixelRender` builds one, culled by the
visibility index. Its pixel half (a separate context and a readback) does not.

The renderer gains two things:
- `TileTextures`, beside `RetainedSurfaces`: `bake(key, commands, rect, scale)` draws into a pooled
  texture through the shared scratch buffer and returns a handle. `release(key)` returns the texture
  to the pool, because a fresh texture costs about four times a reused one (pezlie measured this for
  canvases; check it for textures).
- `image` takes a texture handle in place of a bitmap, with `source` and `opacity` as now. Tile quads
  join the batch's image runs, so tiles do not get a second quad path.

Each frame, before `drawLayers`, the canvas's tile host spends the budget in this order. It always
bakes at least one tile.
1. Floor tiles under the view, so something can always stand in.
2. Missing tiles on screen, nearest the center first.
3. With time left: the level above (where a zoom out lands), then a ring of one or two tiles past the
   screen, ordered toward where the view is heading (its last motion × 12 frames).

The clock measures CPU time, and a bake's GPU work lands later, where that clock cannot see it. So
the budget also caps a frame's baked texels, at 4 tiles' worth to start; measure that number. While
anything in step 3 is left, the host asks for another frame through `useVisibleRaf`, and it stops
asking once none is left. A background tab bakes nothing.

### 4. What an edit dirties

A tile has four states: missing, in flight, held, and stale. An edit never drops a tile. It marks
the tile stale, and the stale tile keeps standing in until a new one replaces it.

The visibility index reports damage: for each touched node whose own box it recomputes, the box
before and the box after. A tile is dirtied when it meets the union of the two, padded by one texel
at its level for antialiasing. The ids come from arc 1's touched-ids feed, so the cases are already
covered:

| Change | Damage |
|---|---|
| A pose, paint or data edit | old own box ∪ new own box |
| An add / a remove | new box / old box |
| A reorder or a layer change | the boxes of the nodes that moved in paint order |
| Inherited paint, a composed frame, a derived path | each touched descendant or dependent's boxes (the feed lists them) |
| `'unknown'`, an unbounded box, or a `RenderLayer`'s `deps` moving | every tile of the layer |

Damage marks only tiles that are held. A tile not yet baked has nothing to mark.

A stale tile on screen draws through live, clipped to the stale tiles' union, when the visibility
index counts no more than 2,000 visible nodes in that region (measure this threshold). It is rebaked
once its damage has held still for a frame, the rule `retain` already applies to a fractional pan.
So a drag paints exactly every frame, and it bakes once it stops. A larger stale region, such as a
theme change over a zoomed-out view, shows its stale pixels and rebakes under the budget.

### 5. Stand-ins and crossfade

A missing tile is drawn from the nearest held ancestor, searching up to 8 levels up and sampling the
ancestor's matching sub-rect. Any held children are drawn over that. A zoom out shows the finer
level below, and a zoom in shows the coarser level above.

The screen shows one level at a time. While the wanted level is incomplete, the last level that
covered the screen stays up, if it is within 2 levels. When the shown level changes, the whole view
crossfades over `fadeMs`. A tile baked after its level came up fades in over its stand-in. Both
fades run on the frame clock, so `onResume` rebases them like any other timed loop. While a fade is
running, the layer keeps asking for frames.

### 6. The cache bound

Tiles live in GPU textures owned by the renderer that baked them, which is the worker's renderer for
a worker view. Two limits hold together:
- **Count:** twice the working set (the tiles on screen, the ring, and the level above), and never
  fewer than 128.
- **Bytes:** tiles count against the renderer's single GPU budget, which grows from `retainBudget`
  (384 MiB today) into a budget shared by retained surfaces and tiles.

Eviction is least recently drawn first. It never evicts the floor or a tile drawn this frame. If the
tiles on screen alone would break the byte bound (a 2560 × 1600 drawing buffer needs up to 88 tiles of 1 MiB each),
the screen drops one level, which needs a quarter of the tiles at half the sharpness, rather than
evicting what it is drawing. Removing a layer from tiling, unmounting the canvas, or losing the
context frees every tile. A change of drawing-buffer size keeps them, unlike retained surfaces,
because tiles are in world space. A change of `dpr` keeps them too: they serve as stand-ins until
the new level bakes.

### 7. Beside `retain`, not replacing it

The two sit side by side, and a tiled layer is never retained. `retain` keeps exact pixels under one
transform, while a tile is resampled at a power-of-two scale. Folding either into the other would
cost `retain` its exactness or cost tiles their zoom. What they share is the scratch buffer and its
`resolve`, the texture pool, and the byte budget.

| | `retain` | Tiles |
|---|---|---|
| Kept | One surface per group, in device pixels | Many tiles per layer, in world space |
| Survives | Still frames and whole-pixel pans | Any pan or zoom |
| Fidelity | Matches a live draw to within 8-bit rounding | Resampled 1–2× per axis |
| Invalidated by | A new `children` array, or any change above the group | Damage boxes, tile by tile |

### 8. What a 3D host reuses

The pyramid logic goes in a new package, `@weasel-js/tiles` (tier `base`), with no GPU code and no
`{x, y}` in it. A tile scheme answers the parent, children, level and bounds of a key. It also
answers the wanted keys for a view, with their priorities. The cache, the scheduler, the stand-in
walk, the fade timing and box-based dirtying work over any scheme, and the payload type is generic.

| Part | Plane (core) | Globe (kernel3d) |
|---|---|---|
| Scheme | A quadtree over the layer's world | A quadtree per cube face, or Web Mercator |
| Level choice | From `scale × dpr` | From screen-space error, with tiles culled by arc 1's frustum half-spaces |
| Payload source | A synchronous bake | An async load of terrain or imagery: the in-flight state, with concurrent loads capped |
| Shared | Key handling, LRU with a pinned floor and a byte bound, the budgeted scheduler, the parent stand-in with its sub-rect UVs, crossfade, damage by box ||

Arc 4's streaming source caps concurrent loads too, through the same in-flight state.

## How it's measured

A spec in `tests/perf/`, run on the fleet as a perf job, not a test run. The backdrop is 100k nodes
in one tiled scene layer. A scripted path zooms from fit-all to 64× and back over 600 frames, then
pans. Each frame records its time, tiles baked, bake time, stand-ins drawn, live commands submitted
for the layer, and tile bytes held. The counts are pinned the way `pickIndexBuildCount` pins builds.
Each run's raw records go to disk.

The entry closes when all three of these hold:
- **Marked tiled:** a layer can be marked tiled through both opt-ins.
- **No full redraw:** once the floor is in, no frame of the zoom submits the layer's live commands,
  and the frame time stays within the budget plus compositing. The same zoom untiled is the
  baseline.
- **Bound tested:** a unit test drives a long random walk of views through the cache with a fake
  baker. On every frame it asserts the count and bytes held stay within their bounds and the floor
  stays in. A browser test checks that the renderer's reported bytes agree.

Two browser tests guard correctness:
- **Seams:** a tiled layer at a fractional zoom matches a live draw across tile seams.
- **Damage:** moving a node dirties exactly the held tiles its old and new boxes meet, at every
  level.

## Order of work

1. `@weasel-js/tiles`: the scheme interface, plane scheme, cache, scheduler, stand-in walk and fade
   timing, with the bound test against a fake baker.
2. The renderer: `TileTextures` and the texture handle on `image`. Then the seam test.
3. Core: the opt-ins, the canvas's tile host ahead of `drawLayers`, and a `RenderLayer` dirtied by
   `deps`.
4. The damage feed from the visibility index, stale draw-through, and the damage test.
5. The worker view, and the perf spec. Then retire the TODO entry.

## What it leaves for later arcs

- **Level of detail** (arc 2) needs nothing new. A tile at level `z` bakes under a view of scale
  `2^z`, so it already gets the representation for that size.
- **Streaming** (arc 4) reports a load landing as a structural touch, and the touch dirties the tiles
  it covers.
- **A globe** (kernel3d) supplies its scheme and an async source. The terrain and imagery tiles that
  scheme drives are kernel3d's to build.
