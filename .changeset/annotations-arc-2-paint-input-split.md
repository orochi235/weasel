---
'@weasel-js/core': patch
'@weasel-js/hud': patch
---

Split a canvas's paint target from its input target.

`<SceneCanvas paintInto={{ canvas, x, y }} inputElement={el}>` paints into a
rect of a canvas you own and takes pointer input from an element you own, so N
canvases share one GL context and one buffer. Each needs its own
`<WeaselProvider isolate>`.

The ref handle names both elements: `element` is where input, focus and the
cursor live, and is now typed `HTMLElement` because detached it is not a canvas;
`surface` is where pixels land. Attached, they are the same `<canvas>` and
`element` keeps working as before. The HUDs render when detached too, anchored
to the input box rather than to the shared surface every pane sits in.

Breaking, narrowly: `createLoupe`'s `element` option is now `canvas`, with an
optional `input` for the element aim is measured against.
`CanvasExtensionApi.element` no longer satisfies an `HTMLCanvasElement` — read
`surface` for pixels. And `clientToWorld`'s first parameter widens to
`HTMLElement`, which stops compiling for a consumer who annotated that parameter
as `HTMLCanvasElement`; one who let it infer is unaffected.
