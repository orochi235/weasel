# @weasel-js/export

Regions of a scene written to a file: a page, a selection or any world-space
rect, as PNG or any format another package registers.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic
scene-graph engine for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/export).

```sh
npm install @weasel-js/export
```

A registry of export formats, each writing one or more world-space rectangles
of a `@weasel-js/core` scene to a file. This package registers `png`;
`@weasel-js/svg` registers `svg` (`registerSvgExport()`) and
`@weasel-js/pdf/export` registers `pdf` (`registerPdfExport()`), so it depends
on neither.

```ts
import { placedPagesOf, viewportWorldRect } from '@weasel-js/core';
import { exportPages, exportRegions, selectionRegion } from '@weasel-js/export';

const pages = placedPagesOf(scene);
const png = await exportPages(scene, [pages[0]], 'png', { scale: 2, background: '#ffffff' });
const shown = await exportRegions(scene, [viewportWorldRect(view, { width, height })], 'png');
const picked = await exportRegions(scene, [selectionRegion(scene, selection.get())!], 'svg');
```

A region is an `ExportRegion`: `{ x, y, width, height, name? }` in world
units. `exportPages` makes one of each `PlacedPage`, named as the page order
shows it; `viewportWorldRect(view, size)` is the one a view shows;
`selectionRegion(scene, ids)` is the box the ids draw, strokes included.
`name` labels a PDF page and titles an SVG.

A region is of the document: every format draws each layer at its document
pose, a parallax layer's included, so what a page or selection holds lands
inside it at any `scale`. Parallax is the camera's, and a region export has
none. To capture what a camera shows, planes and all, render with that camera:
`renderSceneToPixels({ scene, sourceRect: viewportWorldRect(view, size), scale, camera: view })`
places each plane as `view` does, and its `scale` changes only the resolution.

`exportRegions(scene, regions, formatId, opts)` writes them in the format
registered under `formatId` and answers a `Blob`. It rejects for an id nothing
registered, and for several regions handed to a format that is not
`multiRegion`. Every format takes `background` (default none: core holds no
page color), `onDiagnostic`, and `strict`; the rest of `opts`
goes to the format (`scale` for `png`, `title` for `svg` and `pdf`).
`exportFormats()` lists what is registered, `png` first, the same array until
the registry changes; `exportFormatRegistry` is its reflection, with
`subscribe` for a menu that lists them. `registerExportFormat(format)` adds
one and returns its disposer; registering an id that is held overrides it.

Each export draws the document, not what an open gesture or edit is showing,
writes nothing to the scene, and leaves annotation layers out. It draws one
revision of it: `captureExport` loads what the regions need, and reads them
only if no content changed meanwhile, or starts again, up to
`EXPORT_CAPTURE_ATTEMPTS` times before rejecting with `ExportRevisionError`.
Regions may be a function of the document, `(doc) => regions`, read again each
time, so bounds measured from it belong to the revision drawn: `exportPages`
places its pages that way, by id, through `pageRegionsSource(pages)`, and
`pageRegionSource(page)` is the same for one page. A format of your own goes through
`captureExport` too, warming in `warm` and reading everything it writes in
`read`.
What an export draws without reaches `onDiagnostic` once each, as an
`ExportDiagnostic`: `{ kind, subject, message }`, where `kind` is `image` (a
picture that failed to load, drawn as a placeholder), `font` (a face that
failed, or glyphs a format could not carry), `paint-kind` (a kind nothing
registered, or one whose load failed), `shader` (a program with no source the
target draws), or `unsupported` (what the format cannot hold), and `subject`
names the source, family, kind or program. An export is best-effort: it
writes the file without them, so a caller that heard nothing has a complete
file. With `strict: true` it writes nothing when it hears anything and rejects
with `ExportIncompleteError`, whose `diagnostics` lists them. Nothing goes to
the console. A format of your own reports through `exportReporter(opts)`, and
`warmRender({ render, report })` reports a headless render's losses the same way.

`exportRegionPng(scene, region, { scale, background })` is the `png` format
on its own: the renderer's pixels, `region × scale` in size. It needs WebGL2.

`regionRenderArgs(scene, region, { scale, background })` is the render a
region draws with, which the PNG and PDF exports build on. Handed to
`@weasel-js/headless`'s raster host as they are, they render a region from
Node.
