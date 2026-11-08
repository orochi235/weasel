# @weasel-js/loupe

The magnifier's model, with no surface attached: where it is aimed, how far it
magnifies, whether it is showing re-rendered content or actual pixels, and what
color it is over.

A **painter** draws it on one kind of surface and answers the few questions the
model asks — does the lens cover this point, what color is here, repaint. The
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

## Sampling and the eyedropper

`createSampler` answers "what color is here" over an ordered stack of pixel
sources, bottom first. It composites translucent layers source-over to the
color a viewer sees, and answers `null` only where nothing is drawn. A source
can answer later (a WebGPU readback); the sampler then answers with a promise.
`canvasPixelSource` makes a `CanvasSource` one layer of that stack.

`createEyedropperModel` sits beside the loupe model and shares its sampler:
`hover(p)` keeps `color` live under the pointer, and `pick(p)` reports to
`onPick`. Given a loupe on the same surface, `hover` aims it, so the lens shows
the neighborhood and its readout is the color a click takes.

```ts
const sampler = createSampler(layers.map((l) => canvasPixelSource(l.source, l.box)));
const loupe = createLoupeModel({ surface: { ...surface, sample: (p) => sampler.sample(p) as string | null } });
const dropper = createEyedropperModel({ sample: sampler.sample, loupe, onPick: setFill });
```
