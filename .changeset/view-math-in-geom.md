---
'@weasel-js/geom': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/loupe': patch
---

`View`, `ZOOM_FLOOR`, and a pure `normalizeZoom` live in `@weasel-js/geom`; routing and core re-export them under the names they had. `@weasel-js/loupe` depends on geom and no longer peers on core, so its framework-free model installs without core or React. routing gains a dependency on geom. loupe's model no longer logs core's dev warning for an invalid zoom factor; it still clamps it.
