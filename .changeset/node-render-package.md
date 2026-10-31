---
'@weasel-js/node-render': patch
---

New package, `@weasel-js/node-render`: render a scene to pixels from Node. `createNodeRasterHost()` runs core's `renderSceneToPixels` in a headless Chromium page launched through `playwright-core` on the first render, and keeps that page, its WebGL2 context and its GPU caches across renders until `dispose()`. `render` returns the raw straight-RGBA raster and `renderPng` a PNG; the scene goes in live or as its `toJSON()` snapshot, with its paths' typed arrays tagged on the way. `@weasel-js/node-render/page` is the page's script, for a consumer bundling its own page to register fonts or painters first. The browser itself is not bundled: install it with `npx playwright install chromium`.
