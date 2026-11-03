# Dithering — design

**Status: designed 2026-11-03, not built.** This is the first of three arcs: dither, then
output-grid clamping (`2026-11-03-output-grid-clamping-design.md`), then multiple render targets (`docs/TODO.md`,
"Multiple render targets").

For whoever builds `@weasel-js/dither`. It answers what the package contains, how a scene uses it
live and at export, and how artwork such as a barcode is kept out of the dither.

The model is lbx-editor's print path (`src/ditherProtect.ts`, `src/usePrintPreview.ts`) and obwat's
`src/dither.ts`, read at lbx-editor `09d2998` and obwat `39e51ab`. obwat stays standalone and keeps
its own copy (2026-11-03); weasel's is written fresh and does not depend on it.

## What it does

Turns rendered pixels into 1-bit ink, either on the canvas while you work or on the pixels an export
produces. It quantizes on one of two grids:

- **the output grid**, where one cell is one dot of the target (a printer at 180 dpi, a 1-bit
  panel), so cells grow as you zoom and the canvas shows the dots the export will produce;
- **the screen**, where one cell is one device pixel, for the look rather than a target.

## Package

`@weasel-js/dither`, depending on `@weasel-js/renderer` (for `Effect`) and `@weasel-js/geom` only.

| Export | What it is |
|---|---|
| `OutputGrid` | `{ pitch: number; origin: { x: number; y: number } }` in document units: one dot's size, and where dot (0, 0)'s corner sits. Lives in `@weasel-js/geom`, so core's clamping arc uses the same type without depending on dither. lbx's grid is `pitch: 72 / dpi`, `origin: { x: 0, y: printableBandTop }`. |
| `DitherMethod` | `'threshold' \| 'bayer' \| 'floyd-steinberg' \| 'atkinson'` |
| `ditherPixels(rgba, options)` | CPU. Returns a 1-bit mask (`Uint8Array`, 1 = ink). Every method. |
| `dither(options)` | GPU. Returns `Effect[]`. `threshold` and `bayer` only; an error-diffusion method throws, since each of its pixels depends on the one before and no fragment shader can compute it. |
| `protectMask(rects, width, height)` | Rectangles in pixel space to the per-pixel mask both paths take. Rects round outward and clip to the image. |
| `protectRects(nodes, isProtected, grid)` | Nodes to rectangles in pixel space, from each node's painted bounds. `isProtected` returns `false` to leave a node to the dither, or a rect to protect (which may be larger than the node: lbx returns a barcode's quiet zone). |

Shared by both paths, defined once: the 4×4 Bayer matrix, luminance (Rec. 601, as obwat), and the
default threshold, 128.

### Options

| Option | Default | Meaning |
|---|---|---|
| `method` | `'threshold'` | |
| `threshold` | `128` | Gray below it is ink. |
| `background` | white | What transparency composites over before luminance is taken. obwat hardcodes white tape. |
| `ink`, `blank` | black, transparent | The two output colors. lbx draws ink in the cassette's color and leaves blank transparent so the tape shows through. |
| `grid` | `'screen'` | An `OutputGrid`, or `'screen'`. |
| `protect` | none | A per-pixel mask (CPU: `Uint8Array`; GPU: a `TextureHandle`). Inside it, pixels quantize at plain `threshold`, and error diffusion neither enters nor leaves it, so no specks land in a quiet zone. |

`protect` is a mask rather than a list of rects (2026-11-03) so that the multiple-render-targets arc
can later supply exact coverage through the same input. Rects are one way to build a mask.

## How a scene uses it

**Dithering is opt-in, by group, and a protect mask covers the rest (2026-11-03).** Both, not one
or the other:

- **By group.** A photo's group carries `dither({ method: 'bayer', grid })`. The page ends with a
  `threshold` pass, so everything outside a dithered group comes out 1-bit and crisp, with nothing
  to protect. Diffusion cannot cross a group's edge.
- **By mask.** One dither runs over the whole page, and flagged regions quantize at threshold. This
  covers what grouping cannot: a dithered photo drawn *over* a barcode.

Live, both attach through core's existing effect slots: a layer's `effects`, and a `LayerGroup`'s
`effects` thunk `(view, dims) => Effect[]`, which is re-read each frame and is how an output-grid
dither learns the current zoom (`packages/core/src/core/layers/layerGroup.ts`). A node's own dither
comes from its draw returning a group command with `effects`.

At export: `renderSceneToPixels` at the grid's resolution, then `ditherPixels` with the chosen
method and `protect`. The export can use error diffusion; the canvas shows Bayer or threshold.

### The live output grid

At one dot per device pixel the GPU and CPU agree exactly. Away from that:

- **A dot larger than a device pixel** (zoomed in) takes the mean of its footprint, sampled on at most
  a 4×4 tap grid, then quantizes once and fills the whole dot. Up to 4 device pixels per dot the taps
  cover every pixel and the result is exact; beyond that, dots straddling an edge can differ from the
  export, while interiors cannot.
- **A dot smaller than a device pixel** (zoomed out) cannot be shown. The pass quantizes on the
  screen grid instead.

The group's texture is offset from the page, so a shader finds its dot through `u_fragOrigin`, as any
shader reading `gl_FragCoord` must (`packages/renderer/src/shaders/registerProgram.ts`).

## Tests

- CPU: each method against fixtures with known output, including obwat's protect cases (no ink inside
  a protected blank region next to a diffused gray; a protected edge identical on every row under
  Bayer).
- `dither.browser.test.ts`: GPU against CPU, pixel for pixel, for `threshold` and `bayer` at 1, 2, 3
  and 4 device pixels per dot, with and without a protect mask, and with a group offset from the page.

## Not in this arc

- Exact-coverage protection: waits on multiple render targets.
- lbx-editor adopting the package: lbx consumes weasel from npm, so that is lbx's change after a
  release.
- Clamping poses to the output grid: the next arc.
