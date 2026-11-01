# @weasel-js/node-render

Render a weasel scene to pixels from Node — on a server, in a build script, in a CLI. The host
runs core's `renderSceneToPixels` in a headless Chromium page, so the pixels come from the same
WebGL2 renderer a browser draws with. Node itself has no WebGL2 binding the renderer can rely on.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/node-render).

## Install

```sh
npm install @weasel-js/node-render
npx playwright install chromium
```

The second line downloads the Chromium the host launches. `playwright-core` comes with this
package; the browser does not.

## Usage

```ts
import { writeFile } from 'node:fs/promises';
import { createNodeRasterHost } from '@weasel-js/node-render';

const host = createNodeRasterHost();
try {
  const { png } = await host.renderPng({
    scene,                                   // a live Scene, or its toJSON() snapshot
    sourceRect: { x: 0, y: 0, width: 800, height: 600 },
    scale: { x: 2, y: 2 },
    background: '#ffffff',
  });
  await writeFile('page.png', png);
} finally {
  await host.dispose();
}
```

`render` returns the raw raster instead: `{ width, height, data }`, straight RGBA, top-down, the
bytes `renderSceneToPixels` returns. `renderPng` encodes in the page through a 2D canvas, which
stores premultiplied color, so a translucent pixel can move by a step; use `render` when the exact
bytes matter.

Nothing launches until the first render. Every render after it reuses the page, its WebGL2 context
and its compiled programs, so open one host for a batch and `dispose` it at the end (or hold it in
`await using`). `dispose` closes the browser the host launched. Pass `browser` to render in one you
launched yourself; the host then closes only its own page.

## What crosses into the page

The scene and the arguments go as JSON. What `renderSceneToPixels` takes as a function stays
behind: `drawOne`, `resolveImage`, `alphaFor` and `colorOverrides`. Nodes draw through the
painters registered in the page, which by default are core's built-ins. A path's typed arrays
are tagged on the way over (`tagTypedArrays` from `@weasel-js/geom`), so a snapshot saved that way
passes as it is.

The default page registers no fonts, so text draws nothing. To render text, or a paint kind or
node shape of your own, bundle a page script that registers it and then imports
`@weasel-js/node-render/page`, as one classic script, and pass its source as `pageScript`.

## Pixels and the browser's

On one machine, the host's pixels equal the ones a page in Playwright's Chromium draws for the
same scene: one WebGL2 implementation, given the same commands, draws the same bytes. Across GPUs
and drivers they need not match, so don't compare a render against committed pixels.

## License

MIT
