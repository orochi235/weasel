# @weasel-js/loupe

The magnifier's model, with no surface attached: where it is aimed, how far it
magnifies, whether it is showing re-rendered content or actual pixels, and what
colour it is over.

A **painter** draws it on one kind of surface and answers the few questions the
model asks — does the lens cover this point, what colour is here, repaint. The
painters ship with the surfaces they know: `@weasel-js/hud` draws one into a
WebGL canvas, `@weasel-js/labkit` draws one over a lab's own content.

```ts
import { createLoupeModel } from '@weasel-js/loupe';

const loupe = createLoupeModel({ surface, factor: 8 });
loupe.aimAt({ x, y });
```

`createCanvasSource` makes any canvas — 2D or WebGL, yours or someone else's —
something a pixel lens can read. A WebGL canvas without `preserveDrawingBuffer`
is blank once composited, so its drawing code calls `capture()` in the same task
as the draw:

```ts
const source = createCanvasSource(gl, { requestRedraw: draw });
function draw() {
  renderer.render(scene, camera);
  source.capture(); // copies only while a lens is reading
}
```
