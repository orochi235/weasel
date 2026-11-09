# @weasel-js/p-touch

## 1.18.1

### Patch Changes

- 21957cc: Fixes from a bug audit of the storage, loupe, P-touch, hud and labkit packages.
  
  - `createIndexedDbAdapter` now creates its `store` in a database that already exists without it, by upgrading the database one version, so two adapters can keep separate stores in one database (the default `'weasel'` included). It also opens a database some other code has taken past version 1, which used to fail with a `VersionError` and leave every read and write rejected. The upgrade waits, as any IndexedDB upgrade does, until other connections to the database close; this adapter's own connections close for it.
  - A captured `CanvasSource` read after its canvas grew answers `null` for a point past the last captured frame, instead of the pixel the previous read left behind.
  - `writeLbx` and `sceneToLbx` place `lbxObjects` inside a rect clip whose width or height is negative, which they used to skip as cut by the clip.
  - A loupe aimed where nothing is drawn now reports no color: `color` becomes `null` and `onColorChange` is called with `null`, where it used to keep showing the last color it read. Its readout then matches what an eyedropper click there takes, which is nothing. Breaking for TypeScript callers: `onColorChange` is typed `(hex: string | null) => void` on `createLoupeModel`, hud's `createLoupe` and `LoupeEvents`, and labkit's loupe options, so a handler typed for `string` alone needs widening.
- Updated dependencies [7a33153]
- Updated dependencies [f2a1845]
- Updated dependencies [7537af5]
- Updated dependencies [f4d2261]
- Updated dependencies [112f6bb]
- Updated dependencies [860ab3b]
  - @weasel-js/core@1.18.1
  - @weasel-js/renderer@1.18.1
  - @weasel-js/text@1.18.1
  - @weasel-js/dither@1.18.1
  - @weasel-js/geom@1.18.1
  - @weasel-js/paint@1.18.1

## 1.18.0

### Patch Changes

- b93c1dd: Fixes from an audit of ui-logic, editor and the icon packages, and one definition each for decisions several packages answered separately:
  
  - The icons plugin reads the namespace of an `icons.gen` compiled to JavaScript, so its `icon()` calls are rewritten as a TypeScript one's are.
  - Releasing an icon table a second time no longer bumps the registry's version and notifies its subscribers.
  - `envPx` reads a token set to a bare `0` as 0px, as CSS does, instead of using its fallback or throwing.
  - New in geom: `trimNumber(n, places = 6)`, which pathToD, svg and the renderer's mesh writer now share. The mesh writer kept four decimal places where its comment said it matched svg's six; it now writes six.
  - New in geom: `rectBetween(ax, ay, bx, by)`, the rect two corners span, used by core's drag rect, marquee, area select, anchor marquee, insert extent, measurement and parallax, and by diagram's segment boxes.
  - New in registry: `freshId(base, taken, opts)`, the first free numbered id, used by core's `nextPageId`, diagram's stage, wire, group and sequence ids, and labkit's snapshot names.
  - paint exports `byteHex` and `lerpHueDeg`. core's `withAlpha01` and p-touch's lbx colors write hex through the first. theme's ramps blend hues through the second, so two anchors exactly opposite now blend the positive way round, as CSS's `shorter` does, where before they went the negative way.
  - gestures' `matchKey` takes a readonly key list, and routing's key bindings match through it.
  - ui-logic's `clampTo` is now geom's `clamp` under another name, and is deprecated.
- d83476e: Fix edge cases in quantity formatting, color parsing and paint keys, and in `.lbx` output.
  
  - A `compact` value that shows as `1.00K` (999.6, say) is now spoken `1 thousand`, not `1.00K`.
  - `nearestFraction` reads a denominator cap under 1 as 1 instead of returning a fraction over 0.
  - `parseColor` throws on an empty or non-decimal channel: `rgb(255, 0, 0,)` used to parse as transparent red, `rgb(1 2 3 / foo)` as opaque, and `rgb(0x10, 0, 0)` as hex.
  - `paintKey` gives two solids one key when their colors are the same color spelled differently (`#fff`, `#FFFFFF`, `white`).
  - `sampleGradientStops` reads a NaN position as the first stop instead of writing `#NaNNaNNaNNaN`, and answers an empty stop list in hex (`#00000000`) like every other answer.
  - `hexToColorLiteral` leaves `alpha` off a fully opaque `#rrggbbaa`, as `cssColorLiteral` does.
  - `writeLbx` frames a rect drawn with a negative width or height where it lies, and writes a cut position given twice only once.
- Updated dependencies [4161bcd]
- Updated dependencies [fe6a382]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [c148384]
- Updated dependencies [206b78d]
- Updated dependencies [e405e70]
- Updated dependencies [a78c393]
- Updated dependencies [c02f028]
- Updated dependencies [0f72734]
- Updated dependencies [cfe8a8a]
- Updated dependencies [082fa2f]
- Updated dependencies [324322e]
- Updated dependencies [b93c1dd]
- Updated dependencies [12c538a]
- Updated dependencies [d83476e]
- Updated dependencies [14aa7a8]
- Updated dependencies [b53a3ef]
- Updated dependencies [67d207f]
- Updated dependencies [bdf1a62]
- Updated dependencies [b616cad]
- Updated dependencies [89b2c65]
- Updated dependencies [d025e1b]
- Updated dependencies [27d8adb]
- Updated dependencies [02eb957]
- Updated dependencies [5dbf225]
- Updated dependencies [c675905]
- Updated dependencies [1e0adbb]
- Updated dependencies [2455bb4]
- Updated dependencies [e3ce292]
- Updated dependencies [a1f2242]
  - @weasel-js/core@1.18.0
  - @weasel-js/paint@1.18.0
  - @weasel-js/renderer@1.18.0
  - @weasel-js/geom@1.18.0
  - @weasel-js/text@1.18.0
  - @weasel-js/dither@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [f9e1b14]
- Updated dependencies [49cd9bb]
- Updated dependencies [13c6f66]
- Updated dependencies [778f26d]
- Updated dependencies [56446ad]
  - @weasel-js/core@1.17.3
  - @weasel-js/geom@1.17.3
  - @weasel-js/dither@1.17.3
  - @weasel-js/renderer@1.17.3
  - @weasel-js/text@1.17.3
  - @weasel-js/paint@1.17.3

## 1.17.2

### Patch Changes

- Updated dependencies [d15e917]
- Updated dependencies [32e0dd5]
- Updated dependencies [3dfa153]
- Updated dependencies [36a16c0]
- Updated dependencies [2e4ad49]
- Updated dependencies [883dfcd]
- Updated dependencies [561322a]
- Updated dependencies [54dc458]
- Updated dependencies [dd926dc]
- Updated dependencies [cda0a20]
- Updated dependencies [c089c61]
- Updated dependencies [cc591ff]
- Updated dependencies [e6e7a72]
- Updated dependencies [d162fbb]
- Updated dependencies [f15f881]
- Updated dependencies [35c291a]
- Updated dependencies [019b877]
- Updated dependencies [47679f8]
- Updated dependencies [e13e539]
- Updated dependencies [fce3d09]
- Updated dependencies [d12d868]
- Updated dependencies [2121adb]
- Updated dependencies [b81f560]
- Updated dependencies [060b0ee]
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
- Updated dependencies [d3654a1]
- Updated dependencies [03f87f4]
- Updated dependencies [2af51ff]
  - @weasel-js/core@1.17.2
  - @weasel-js/paint@1.17.2
  - @weasel-js/dither@1.17.2
  - @weasel-js/geom@1.17.2
  - @weasel-js/text@1.17.2
  - @weasel-js/renderer@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [f45b9b5]
- Updated dependencies [629d02b]
  - @weasel-js/core@1.17.1
  - @weasel-js/dither@1.17.1
  - @weasel-js/geom@1.17.1
  - @weasel-js/paint@1.17.1
  - @weasel-js/renderer@1.17.1
  - @weasel-js/text@1.17.1

## 1.17.0

### Patch Changes

- 1730e51: `.lbx` objects carried by `lbxObjects` now honor the opacity above them: at alpha 0 they are left out, and under partial opacity they are reported in `skipped`, since an `.lbx` object cannot be translucent.
  
  A carried object under a clip, which is every node inside a clipping container, used to vanish without a word. It now goes in the file when it lies wholly inside axis-aligned rect clips, with the clipped paint around it rasterized in order; otherwise it is reported in `skipped`, as is one under a group with an effect, isolate, color matrix or blend.
- Updated dependencies [d28ff77]
- Updated dependencies [13ca1ea]
- Updated dependencies [d3820c9]
- Updated dependencies [217246e]
- Updated dependencies [a161c0b]
- Updated dependencies [34f7531]
- Updated dependencies [bf27898]
- Updated dependencies [533bb6a]
- Updated dependencies [436da9e]
- Updated dependencies [3c517d9]
- Updated dependencies [7e3d359]
- Updated dependencies [6539d70]
- Updated dependencies [c5f7685]
- Updated dependencies [7c26f2b]
- Updated dependencies [ce7e8b5]
- Updated dependencies [b497b07]
- Updated dependencies [75ef6d9]
- Updated dependencies [12e9c39]
- Updated dependencies [9d25103]
- Updated dependencies [3b08834]
- Updated dependencies [ceff0c3]
- Updated dependencies [d5cc782]
- Updated dependencies [e3a95da]
- Updated dependencies [ee9bc7f]
- Updated dependencies [0af766f]
- Updated dependencies [52fd33e]
- Updated dependencies [e989ef7]
- Updated dependencies [e6cf896]
- Updated dependencies [3517855]
- Updated dependencies [2ebc73f]
- Updated dependencies [b606ef9]
- Updated dependencies [8e888a9]
- Updated dependencies [5f43e16]
- Updated dependencies [71f0ad6]
- Updated dependencies [ee7d8ce]
- Updated dependencies [cb58393]
- Updated dependencies [5b39acd]
- Updated dependencies [454e8e1]
- Updated dependencies [e78e03c]
- Updated dependencies [70113d3]
- Updated dependencies [e95d9fc]
- Updated dependencies [9f29268]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [59ddef2]
- Updated dependencies [df080bc]
  - @weasel-js/core@1.17.0
  - @weasel-js/renderer@1.17.0
  - @weasel-js/dither@1.17.0
  - @weasel-js/geom@1.17.0
  - @weasel-js/paint@1.17.0
  - @weasel-js/text@1.17.0

## 1.16.2

### Patch Changes

- 12caf33: Add `@weasel-js/p-touch`, Brother P-touch labels from a scene. `renderLabel` draws a label at one pixel per
  printer dot over the band the printhead reaches, and `printLabel` dithers it through `@weasel-js/dither` and
  sends it over WebUSB or Web Serial through obwat, split into pages at cut marks. `labelGrid` is the printer's
  dot grid in scene units, for `protectRects`. `sceneToLbx` and `writeLbx` write an `.lbx` file with rects, open
  polylines and plain text boxes as objects P-touch Editor can edit, and the rest drawn and placed as images.
  A `drawOne` can return `lbxObjects([...])` to write a node as an object its paint cannot say, such as a
  barcode.
  
  Core gains `commandRasterizer`, the hook that draws commands a file format cannot express through a
  `RasterSession`. It was `diagram-formats`' private `pageRasterizer`, which `exportPagesPdf` now uses from core.
- Updated dependencies [65d2e7c]
- Updated dependencies [db1eb4e]
- Updated dependencies [944faa2]
- Updated dependencies [6c0b311]
- Updated dependencies [f6f69c8]
- Updated dependencies [8f2e1e1]
- Updated dependencies [12d3c17]
- Updated dependencies [6e3b081]
- Updated dependencies [847875c]
- Updated dependencies [12caf33]
- Updated dependencies [f285e56]
- Updated dependencies [6ecee1a]
  - @weasel-js/core@1.16.2
  - @weasel-js/dither@1.16.2
  - @weasel-js/renderer@1.16.2
  - @weasel-js/geom@1.16.2
  - @weasel-js/text@1.16.2
  - @weasel-js/paint@1.16.2
