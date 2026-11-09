---
'@weasel-js/renderer': patch
'@weasel-js/pdf': patch
'@weasel-js/svg': patch
'@weasel-js/paint': patch
---

Fixes to PDF texture fills, retained bounds, canvas readback, SVG lengths, hex colors and pattern tiles.

- `writePdf` looks a texture paint up as the renderer does, so an image paint (`{ kind: 'image', src }`) the renderer has not drawn yet, and a tile pattern evicted from its cache, export instead of being skipped. A texture paint's `width` and `height` set the tile's size in the PDF, as they do on the canvas; it used to tile at the texture's pixel size. `getTexture` and `tileExtent` are exported from `@weasel-js/renderer` for this.
- A path with no points and a sprites run of no sprites bound as empty, so neither stretches a retained surface, or a PDF group rasterized for its effects, to the whole buffer.
- `WeaselRenderer.readPixels` and `readPixelsSync` throw a `RangeError` for a rect that is not whole device pixels. Such a rect used to come back with its rows misplaced.
- `parseSvg` reads a length too large to hold (`width="1e400"`, `letter-spacing="1e400"`, `stroke-width="1e400"`) as unset, where it read an infinity.
- `byteHex`, and every hex color written through it (`rgbaToHex`, `lerpPaint`, `colorLiteralToHex`), writes a NaN channel as `00`. It used to write the letters `NaN`, which nothing parses back.
- A tile pattern whose `size` holds no whole pixel (0, a fraction below 1, negative, NaN, infinite) resolves no texture and draws nothing. In Chromium it used to throw out of the painter that resolved it.
