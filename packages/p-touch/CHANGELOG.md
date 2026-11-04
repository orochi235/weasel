# @weasel-js/p-touch

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
