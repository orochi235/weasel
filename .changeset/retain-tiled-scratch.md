---
'@weasel-js/renderer': patch
---

A retained surface larger than 1024 device pixels on a side is drawn in tiles of that size, each resolved into its place in the surface, so the multisampled scratch buffer a frame that redraws holds is at most 1024x1024 rather than as large as the largest surface: 38 MB at 4x, with the single-sampled copy tiles resolve through, where a surface with pan margins on a 2560x1600 buffer took 205 MB. A child whose bounds miss a tile is not drawn for it. The pixels match drawing the surface whole, except that a sample an edge passes within float rounding of can flip. A frame that redraws costs more: redrawing four layers with pan margins at 1280x800 and dpr 2 took 9.7 to 15.5 ms tiled, against 9 ms whole.
