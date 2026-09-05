# Mega view — an interactive surface at 10⁴–10⁶ items

Design for a pan/zoom surface that stays interactive when the item count is far
past what one draw call per item can carry. For whoever implements it; assumes
familiarity with `WeaselRenderer` and its draw commands, not with level-of-detail
or texture atlasing.

The question it answers: **what has to exist so that zooming a grid of 10,000
drawings is smooth, when the drawings themselves are 547MB?**

## The invariant everything follows from

Visible items × pixels per item ≈ viewport area, and viewport area is constant.

Zooming out shrinks each item but adds more of them; zooming in does the
reverse. The product never moves. Every decision below is a way of spending that
fixed budget, which is why the scheme does not degrade at either end of the zoom
range — there is no zoom level at which more work is required than at any other.

## What already exists

- **`WeaselRenderer` is WebGL2** (`packages/core/src/renderer/`), takes a list of
  draw commands, and already draws textured image quads — `imageFill` shaders,
  `GLImageCache`, `GLTextureCache`.
- **`GLImageCache` already does GPU mipmapping.** `ImageMinification` is
  `'linear' | 'mipmap'`; `'mipmap'` runs `generateMipmap` and filters
  `LINEAR_MIPMAP_LINEAR`. It was added for the print/export path because
  "bilinear-only minification undersamples and produces moiré" — the same
  problem a wall of shrunken thumbnails has.
- **`spriteSheet.ts` and `solidBatch.ts`** are in `packages/core/src/renderer/`.
  A sprite sheet is the atlas this design needs.
- **`labkit/src/surface/`** hosts a renderer labkit does not own: it publishes
  rects, dirtiness, DPR and one rAF, and its guide already notes that browsers
  cap WebGL contexts at 8–16 so tiles must share one surface.

`packages/ui` is React and DOM, and sits *below* labkit in the dependency graph
(`ui → core, svg, font, modes`; `labkit → core, ui, …`). It is the wrong home:
it cannot reach labkit's camera, and a DOM component cannot hold this item
count. This belongs beside `core`'s renderer, hosted through labkit's surface
seam.

## Two different things are called mipmapping

Separating them is most of the design.

**Baked levels — residency, and this package's job.** Which pre-rendered
artifact to fetch and upload. The GPU cannot help: it cannot sample what is not
in VRAM, and the full-resolution set does not fit. This is a CPU decision made
per frame from the camera.

**The GPU mip chain — sampling, and already built.** Within a resident texture,
the GPU picks a mip per fragment from UV derivatives. Set
`imageMinification: 'mipmap'` and write nothing. It covers the continuous range
between the discrete baked levels.

## Choosing a level: derive, never detect

The surface owns the camera, so world-units-per-screen-pixel is a scalar it
already has. Level selection is a function of that scalar, not a measurement of
the framebuffer.

For a uniform layout every cell has the same density, so **one level serves the
whole view** and is recomputed only when zoom changes. This is what makes the
problem materially easier than a map: a map's projection puts different regions
of one view at different densities, so it must resolve level per region. A flat
orthographic layout has exactly one.

A layout that varies scale across the view — perspective, or a receding pile —
needs a level per item. That is still derived, from the item's own placement.

## The atlas: composition is about draw calls, not memory

10,000 items at 4×4px is 640KB whether it is one texture or ten thousand. But a
batch spans one texture, so ten thousand textures is ten thousand binds and ten
thousand draw calls — at 10µs of CPU overhead each, 100ms per frame. Memory is
never the reason to atlas; binds are.

For 10,000 items, holding all of them in one square page:

| cell | single page | size | visible in 1600×1000 | pages needed |
|---|---|---|---|---|
| 4px | 400×400 | 0.6 MB | all 10,000 | 1 |
| 16px | 1600×1600 | 9.8 MB | 6,200 | 1 |
| 32px | 3200×3200 | 39 MB | 1,550 | 1 |
| 64px | 6400×6400 | 156 MB | 375 | 1 |
| 128px | 12800×12800 | 625 MB | 84 | 1 |
| 256px | 25600×25600 | 2.5 GB | 18 | 1 |

The third column is what you would need to hold everything and never do; the
last is what the viewport actually demands. Coarse levels are trivial — the
whole corpus is one small texture, uploaded once and never touched. Fine levels
need many pages but only ever one or two resident. Pages are a residency
problem, not a composition problem.

## Per-sprite quads, not composed blocks

One atlas means one draw call either way: 10,000 quads sharing a texture batch
into a single `drawElements`. The choice is not how many draws but what the
vertex buffer holds.

**Per-sprite** puts one quad per item, UVs indexing the atlas. 10,000 quads is
625KB of vertex data, ~61us to upload, and only on layout change.

Per-sprite is the default because it is strictly more general: it is the only
one of the two that leaves layout free. Blocks are a compression that costs that
generality, so they have to be justified by a measurement rather than assumed.

**Composed blocks** — rendering a 16x16 arrangement of sprites into one texture
and drawing it as a single quad — cuts that to 40 quads, 250x fewer. This is how
map tiles work, and it is the wrong default here for one reason: a block bakes
the *relative arrangement* of the items in it. Maps can afford that because maps
never re-sort. A view whose whole purpose is re-ordering a corpus cannot.

At 625KB the per-sprite cost is not worth trading layout freedom for. Blocks
become the escape hatch somewhere past 10^5-10^6 items, where the buffer is tens
of megabytes rather than hundreds of kilobytes. The version to build then
composes blocks at runtime into a framebuffer, keyed on (layout, level), so a
re-sort costs one re-composite pass instead of a rebake -- map tiles, made
dynamic. Do not build it before the item count demands it.

## Layout is not baked

An atlas cell answers *what item i looks like at level L*. Where item i sits is
the layout's answer, supplied per frame as a quad position. The two are
independent:

- **Atlas**: item id → UV rect. Baked ahead of time, keyed by content hash, so a
  re-render invalidates exactly one cell.
- **Layout**: item id → world rect. Computed at runtime, free to change every
  frame.

So re-sorting the whole grid by any key, filtering it, or swapping a grid for
piles rebakes **nothing** — it emits different positions against the same UVs.

Three things layout does decide:

1. **How visible items are found.** A uniform grid is integer arithmetic and
   needs no spatial index. Arbitrary placements need one. This is the only thing
   that would justify a quadtree, and it is a consequence of pluggable layout
   rather than of scale.
2. **Whether one level serves the view**, per the section above.
3. **Page locality.** Atlas page membership is fixed at bake time. If the layout
   orders items differently, the visible set scatters across pages and more get
   bound. It cannot bite at the coarse end (one page holds everything) or the
   fine end (few items are visible); it bites in the middle of the ladder.

Layout should therefore be a strategy — a pure function from items and a
viewport to placements — rather than a mode. `windease` already publishes
exactly that shape, and `slopboard` already calls it per frame while explicitly
refusing its `ContainerHost` and store, which would mean 60 store writes a
second. Take the same half. A strategy returning placements for all N is O(N)
per frame, which is nothing at 10⁴ and is the thing to revisit at 10⁵.

## Baking

Rasterizing to thumbnails is cheap enough not to design around: measured on
brick-icons' store, 49 SVGs to 64px PNGs took 0.38s — about 7.7ms each, so
~80 seconds for 10,000, single-threaded. The output is ~2.5KB per thumb, ~24MB
for 10,000 loose, and far less composited.

Bake to a content hash. A consumer that already stores one — brick-icons keeps a
`sha256` per render — gets cache invalidation for free.

## Traps

**Swap levels with hysteresis.** At an exact threshold, a zoom parked on the
boundary re-uploads textures every frame. Swap up at ~1.5× and down at ~0.67× so
the levels overlap.

**Mipmapping an atlas bleeds neighbours.** Each reduction averages across cell
boundaries, so a cell picks up the one beside it and the result reads as halos —
a rendering fault, not a data fault. Pad cells with an edge-replicated gutter and
stop the chain before cells merge. Decide this before baking: retrofitting
gutters means rebaking every atlas. The coarsest level needs no gutter, because
the chain stops there anyway.

**Do not size the atlas from the item count.** The table's third column is a trap
for exactly that reason; size it from the viewport.

## What the renderer costs at this scale

Measured 2026-09-05 on an M2 Max, ANGLE Metal, 800×600 at dpr 1, via
`tests/perf/image-quad.spec.ts` (`WEASEL_PERF_N` sets the quad count,
`WEASEL_PERF_SIZE` the quad edge). Median of 3 runs.

| quads | `renderer/image` | `raw/preloaded` |
|---:|---:|---:|
| 512 | 3.05 ms | 0.015 ms |
| 4,000 | 19.6 ms | 0.68 ms |
| 20,000 | 51.3 ms | 3.83 ms |

**Per-quad overhead dominates, so the batching path has to be built first.**
20,000 image commands is 51 ms — three frames' budget for one frame's work, and
it is all CPU: rerunning 20,000 at 8px instead of 48px drops overdraw from 96×
to 2.7× and moves the number by 0.05 ms. Fill rate is free here; the draw calls
are not.

The cause is `drawImage` in `packages/core/src/renderer/draw.ts`. It is one
`drawElements` per command, and each one re-sets the program, the projection and
model matrices, the color matrix, the texture bind and filter, three uniforms,
and the clip test — plus a `flushSolids` before it. Nothing about the image path
batches today.

**The design's target path is affordable.** `raw/preloaded` — 20,000 draws
against a vertex buffer written once, no per-quad write and no per-quad uniform
— is 3.83 ms, and one batched `drawElements` over that same buffer is strictly
less. That is the shape this design calls for, and it is ~13× cheaper than what
the renderer does now. The atlas and LOD work is not what needs proving; a
batched image path is.

**Do not build the vertex buffer with `bufferSubData` per quad.** `raw/arena`
does exactly that — one persistent buffer, each quad written at its own rising
offset — and it is the only variant that gets *worse* per quad as N grows: 8.6
µs at 512, 12.8 at 4,000, 33.9 at 20,000, which is 668 ms for one frame. Build
the whole array CPU-side and upload it in one `bufferData`.
