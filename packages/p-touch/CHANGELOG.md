# @weasel-js/p-touch

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
