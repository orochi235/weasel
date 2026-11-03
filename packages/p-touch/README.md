# @weasel-js/p-touch

Brother P-touch labels from weasel scenes: `.lbx` files P-touch Editor opens, and printing from
the browser over WebUSB or Web Serial.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/p-touch).

```sh
npm install @weasel-js/p-touch
```

A label is a region of a scene in points: it runs along x for its length and down y across the
tape, from `origin` (default `(0, 0)`). `TAPES` lists the cassette widths; `tapeForWidthMm(12)`
picks one.

## Printing

```ts
import { createBrotherPrinter, Printers, printLabel, renderLabel, tapeForWidthMm } from '@weasel-js/p-touch';

const printer = createBrotherPrinter();
const tape = tapeForWidthMm(12)!;
const media = (await printer.queryMedia()) ?? Printers.ptP710bt.media(tape.widthMm);

const image = await renderLabel({ scene, drawOne, length: 144, tape, media });
await printLabel({ printer, image, media, cuts: [72], requestDevice: true });
```

`renderLabel` draws the label through the same renderer as the canvas, at one pixel per printer
dot, over the band the printhead reaches (`printableBand`); content outside it does not print.
`printLabel` turns gray into dots through `@weasel-js/dither` (`dither`, default a plain
threshold; `labelRaster` is that step alone). To keep a barcode and its quiet zone out of the
dither, pass a `protect` mask: `protectRects(items, rectOf, labelGrid({ tape, media }))` puts rects
in dots, and `protectMask` fills them. It then splits the label into
pages at `cuts`, and sends one job; with `requestDevice` it shows the browser's picker when no
printer has been granted, which only works inside a user gesture. The printer session, its
status and the device picker are [obwat](https://github.com/orochi235/obwat)'s
`createBrotherPrinter`, re-exported here.

## `.lbx` files

```ts
import { sceneToLbx, tapeForWidthMm } from '@weasel-js/p-touch';

const { bytes, skipped } = await sceneToLbx({ scene, drawOne, length: 144, tape: tapeForWidthMm(12)! });
```

Written as objects P-touch Editor can edit:

| Draw command | `.lbx` object |
|---|---|
| a rect path, solid fill and stroke, mitered | `draw:rect`, framed at the stroke's outer edge |
| an open polyline, solid stroke, no fill | `draw:poly` |
| text in one face, size and solid color, in a box of known size | `text:text` |

Each holds only under a transform with no rotation, skew or mirror, at full opacity. Everything
else — curves, gradients, images, translucency, clips, effects — is drawn through a raster session
at `rasterDpi` (default 180) and placed as an image, one per run of such commands, so the file keeps
the scene's paint order. P-touch sets text again in its own copy of the face, so lines can break
where the canvas did not.

A node whose object its paint cannot say, such as a barcode drawn as bars, is written as that
object by the `drawOne` passed to `sceneToLbx` returning `lbxObjects([...])`: a command that draws
nothing and puts bil-lbx `LabelObject`s in the file where it stands. Their positions are in the
frame the command is drawn in and go through the transforms above it; under a rotation they are
skipped. The canvas keeps its own `drawOne`, which draws the bars.

```ts
const exportDrawOne = (node, pose, view, ctx) => node.data.kind === 'barcode'
  ? [lbxObjects([{ type: 'barcode', protocol: 'CODE128', data: node.data.value, position: pose }])]
  : drawOne(node, pose, view, ctx);
```

`writeLbx(page, { rasterize })` does the same from draw commands with no scene, as `writePdf`
does; `commandRasterizer` from `@weasel-js/core` is the `rasterize` hook. Without one, what it
cannot draw comes back in `skipped`. `lbxConfig` returns the label without building the file.
