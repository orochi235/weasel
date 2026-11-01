# @weasel-js/headless

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
