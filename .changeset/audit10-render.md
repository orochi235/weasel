---
'@weasel-js/text-dom': patch
'@weasel-js/renderer': patch
'@weasel-js/dither': patch
---

Fixes to pasted tables, hatch pattern tiles and the dither protect texture.

- A paste of an HTML table drops the white space a cell opens with, as a browser collapses it, so pretty-printed markup (`<td>\n  b\n</td>`) pastes as `a⇥b` instead of `a⇥ b`.
- A `hatch` tile runs its diagonals and corner stubs far enough past the tile to cover a line wider than about 2.8 units, so a thick hatch no longer shows notches where the tiles meet. The SVG export draws the same tiles.
- `protectTexture` makes a texture for a grid of no dots instead of throwing from `ImageData`; `dither` reads it as no protect mask.
