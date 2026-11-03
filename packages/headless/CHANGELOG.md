# @weasel-js/headless

## 1.16.2

### Patch Changes

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
  - @weasel-js/geom@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [3afef45]
- Updated dependencies [071906a]
- Updated dependencies [214d5d5]
- Updated dependencies [9533421]
- Updated dependencies [6b9d157]
- Updated dependencies [603dbc3]
- Updated dependencies [5a2e82a]
- Updated dependencies [07a8387]
- Updated dependencies [72330bf]
- Updated dependencies [3905b08]
- Updated dependencies [25a1ff7]
- Updated dependencies [6b503a5]
- Updated dependencies
  - @weasel-js/geom@1.16.1
  - @weasel-js/core@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/geom@1.16.0
  - @weasel-js/core@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [946faff]
- Updated dependencies [507f539]
- Updated dependencies [c6edab2]
- Updated dependencies [a4138b6]
- Updated dependencies [5a0375b]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [2f6b10d]
- Updated dependencies [5f6111b]
  - @weasel-js/core@1.15.2
  - @weasel-js/geom@1.15.2

## 1.15.1

### Patch Changes

- 13b0604: Breaking: `@weasel-js/headless` now holds what was announced as `@weasel-js/node-render`, which never published under that name. Its 1.15.0 contents (list, focus, slider, reorder and tree keys, and the measure/draw contract) moved to `@weasel-js/ui-logic` unchanged; import them from there.
  
  What the package does now: render a scene to pixels from Node. `createNodeRasterHost()` runs core's `renderSceneToPixels` in a headless Chromium page launched through `playwright-core` on the first render, and keeps that page, its WebGL2 context and its GPU caches across renders until `dispose()`. `render` returns the raw straight-RGBA raster and `renderPng` a PNG; the scene goes in live or as its `toJSON()` snapshot, with its paths' typed arrays tagged on the way. `@weasel-js/headless/page` is the page's script, for a consumer bundling its own page to register fonts or painters first. The browser itself is not bundled: install it with `npx playwright install chromium`.
- Updated dependencies [424ba52]
- Updated dependencies [9515681]
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
- Updated dependencies [8ad43af]
- Updated dependencies [120420a]
- Updated dependencies [e982d8a]
  - @weasel-js/core@1.15.1
  - @weasel-js/geom@1.15.1
