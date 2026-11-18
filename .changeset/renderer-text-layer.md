---
'@weasel-js/renderer': minor
'@weasel-js/core': minor
'@weasel-js/pdf': minor
'@weasel-js/font': minor
---

A `text-layer` draw command keeps text on the GPU: `{ kind: 'text-layer', texts }` draws its `TextDrawCommand`s as drawing each in turn would, but uploads every glyph once, as one instance, and draws it with one call a frame however the view moves.

At 114,400 glyphs, a frame of unchanged text drops from about 11 ms of CPU to a draw call, still or moving (`tests/perf/text-wall.spec.ts`). The layer is kept by the identity of `texts` and freed at the end of a frame that does not draw it. A layer holding an underline, a stroke, a fill that is not a solid color, a color glyph, or a glyph big enough on screen for the outline tier is drawn text by text instead.

```ts
const wall: DrawCommand = { kind: 'text-layer', texts: lines.map((l, i) => textCommandFromRuns(0, i * 16, l, style)) };
renderer.render([wall], view);
```

`GpuDevice.draw` takes an instance count, and a vertex buffer layout's `step: 'instance'` advances once an instance. `@weasel-js/core` exports `TextLayerDrawCommand`, and `renderNeeds` reads a layer's fonts and paints. `@weasel-js/pdf` writes a layer's texts. `@weasel-js/font` exports `GLYPH_AREA_FROM`.

<!-- entry: api perf -->
