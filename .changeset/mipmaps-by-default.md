---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

Images drawn at half their size or smaller are now smoothed through mipmaps by default: `imageMinification` defaults
to `'auto'` on `WeaselRenderer` and `<Canvas>`, which builds an image's mipmaps the first time a frame draws the whole of
it that small. This changes the pixels of every image drawn small; pass `imageMinification: 'linear'` for the old
single-tap look. A draw with `source` and a `sprites` run never sample mipmaps, under any mode, so a sprite-sheet cell
drawn small no longer takes color from the cells beside it under `'mipmap'` or `'auto'`.
