---
'@weasel-js/paint': patch
'@weasel-js/renderer': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
'@weasel-js/ui': patch
---

A fill or stroke can now tile a picture: `{ kind: 'image', src, width, height }`, a new pattern paint kind beside the built-in tiles. `src` is anything an `<img>` loads, and a `data:` URI makes the paint carry the picture itself, so it saves, copies and exports with nothing stored beside the document. `width` and `height` are the tile's size in paint units; left out, the picture's pixel size is used. The fill draws nothing until the picture has decoded, then repaints.

This adds API. `@weasel-js/paint` exports `ImagePatternPaint`, `TileExtent`, `ResolvablePatternKind` and `isImagePatternPaint`, and `isPatternPaint` now answers true for an image paint. `TexturePaint` takes an optional `width` and `height`, which set its tile size in place of the texture's pixel size. `resolveFillPattern` resolves an image paint to a `texture` paint. Code that switches over every `Paint` kind meets a new member.

`@weasel-js/svg` writes an image paint as a `<pattern>` holding one `<image>` that fills the tile, and reads that structure back from any editor's SVG, `xlink:href` included. An image paint with no `width` and `height` cannot be sized as an SVG pattern and is left out with a warning.

`PatternPicker` gains an image swatch after the tiles that opens a file picker. The picked file is stored as a `data:` URI, re-encoded down to 1024 px on its longest side if larger (an SVG is kept as it is), and the size switch then sets the tile's longest side to 32, 64, 128 or 256 units. A new `readImage` prop replaces that step for an app that stores images elsewhere. `readImageFile`, `seedImagePattern` and `MAX_STORED_IMAGE_SIDE` are exported.
