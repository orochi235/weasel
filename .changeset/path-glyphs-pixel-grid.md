---
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

`core:symmetricHandles`, `core:simplifyBrush`, `core:harmonize`, `path-tools:spiro`, `path-tools:spiroSmooth`, `path-tools:spiroG4`, and the warp tools' `path-tools:distort`, `path-tools:envelope` and `path-tools:puppetWarp` are redrawn on the 16px pixel grid at a one-pixel stroke. The spiro S-curves now run level and along the pixel diagonal, so at 1x they no longer render as a gray diagonal. `simplifyBrush` is now a zigzag path that runs straight from inside the brush's ring, and `harmonize` is a circular arc under two equal curvature-comb teeth.
