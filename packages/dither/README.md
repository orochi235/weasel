# @weasel-js/dither

Turns pixels into 1-bit ink: on the CPU for the pixels an export produces,
and as a renderer effect that shows the dither live on the canvas.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/dither).

```sh
npm install @weasel-js/dither
```

## Export

`ditherPixels(image, { method, threshold, background, protect })` takes
straight RGBA (what `renderSceneToPixels` returns) and answers one byte per
pixel, 1 for ink. `method` is `'threshold'`, `'bayer'`, `'floyd-steinberg'`
or `'atkinson'`. Transparency composites over `background` (white by default)
before gray is taken. `maskToRgba` paints the result in two colors.

## Live

`dither({ method, grid, ink, blank })` is an `Effect[]` for a group or a
layer group: threshold or Bayer, since error diffusion cannot run in a
shader. On the screen grid each device pixel is a dot. On an output grid, a
printer's or a 1-bit panel's, each dot is one dot of the target, so the
canvas shows what the export will print at any zoom:

```ts
const grid = { pitch: 72 / 180, origin: { x: 0, y: 0 } }; // 180 dpi, in points
const layerGroup = {
  id: 'print',
  layers: ['scene'],
  effects: (view, dims) => dither({ method: 'bayer', grid: gridOnScreen(grid, view, dims.dpr) }),
};
```

The live result matches the export exactly when a dot is a whole number of
device pixels, up to 4, and the grid's origin lands on a whole pixel. A dot
smaller than a device pixel cannot be shown, so each pixel quantizes alone.

## Keeping things out of the dither

Put the dither on the groups that have tone (a photo) and end the page with a
`threshold` pass, and a barcode or a line of type stays crisp with nothing to
protect. Where tone must be dithered over such artwork, protect it:
`protectRects` maps items to rects on the grid, `protectMask` turns rects
into the mask `ditherPixels` takes, and `protectTexture` uploads that mask
for `dither`, which needs an output grid to read it. Inside it pixels quantize
at plain threshold, and error diffusion neither enters nor leaves it.

## Whole-dot marks

Plain threshold still gives each edge to whichever dot it covers more than
half of, so two bars of one module can print a dot apart and a hairline can
vanish. Keep the marks on the dots in the document instead, with core's
quantize rule:

```ts
import { OUTPUT_GRID_KEY, createScene, quantizeSize } from '@weasel-js/core';
import { alignToGrid, snapToPitch } from '@weasel-js/geom';

const scene = createScene({
  systemLayers,
  doc: { [OUTPUT_GRID_KEY]: { pitch: 72 / 180, origin: { x: 0, y: 0 } } },
  quantize: {
    // What the document holds: here a rule's thickness in whole dots, never under one.
    stored: ({ data, pose }, grid, anchor) => data.mark === 'rule'
      ? { pose: quantizeSize(pose, pose.width, snapToPitch(pose.height, grid.pitch), anchor) }
      : null,
    // Where it is drawn: its corner on a dot. Picking keeps the stored pose.
    drawn: ({ data, pose }, grid) => (data.mark ? alignToGrid(pose, grid) : pose),
  },
});
```

The grid is a document value, `kit:outputGrid` in `scene.doc`, so setting it
is an undoable edit, and the stored values re-snap inside that same edit
(2026-11-03). `stored` runs on every committed write, whatever made it (a
resize, typed W/H, align's match size, a paste, a data edit such as a stroke
width), on a document as it is built or loaded, and on the live preview of a
resize, a move or an insert, so a release lands where its preview showed. It answers data as well as a pose, since a stroke 1.5 dots wide
prints as ragged as a barcode module (2026-11-03). Which values are stored
and which only drawn is the rule's choice, per field (2026-11-03): a size that
must still read true after the grid changes belongs in `stored`, so W and H
show what prints; a position that moves with the grid's origin belongs in
`drawn`.

A barcode stores its module as a whole number of dots, and its width as that
module times its modules: every module then prints alike wherever the code
sits, and its W is the width it prints, which can be well off the width it was
asked for when the module rounds down. The site's dither demo does this.
