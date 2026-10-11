---
'@weasel-js/labkit': patch
'@weasel-js/d3': patch
---

labkit no longer lists `@weasel-js/kernel3d` as a dependency: only its unpublished 3D example imports it, so installing labkit stops installing kernel3d. d3 drops its `react` peer, which none of its source imports. labkit's lightbox button takes its size from `--wzl-control-h-sm`, so it follows the density.
