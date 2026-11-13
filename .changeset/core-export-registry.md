---
'@weasel-js/core': minor
---

Core keeps a registry of export formats, and writes any world-space region of a scene through it: a page, the view, or a selection.

`registerExportFormat(format)` adds a format and returns its disposer; `exportFormats()` lists them, and `exportFormatRegistry` is their reflection. `exportRegions(scene, regions, formatId, opts)` writes `ExportRegion`s (`{ x, y, width, height, name? }`) in one, and `exportPages(scene, pages, formatId, opts)` writes `PlacedPage`s, each named for its page. Core registers `png`, which is `exportRegionPng`; `selectionRegion(scene, ids)` is the region a selection draws, and `regionRenderArgs` the render a region draws with, which `@weasel-js/headless`'s raster host takes as it is. Every format takes `background`, default none, and `onWarn`.

```ts
const png = await exportPages(scene, [placedPagesOf(scene)[0]], 'png', { scale: 2, background: '#ffffff' });
```

<!-- entry: rank=10 new api -->
