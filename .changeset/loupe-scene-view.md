---
'@weasel-js/labkit': patch
---

`TrialLoupe` takes a `sceneView` option: a bare `@weasel-js/core` scene — a host with no `<CanvasStack>`
of its own, the common case for a weasel consumer app — can now get a true circular, vector-sharp
magnifier in one prop, painted by the new `SceneLoupe` through `SceneViewCanvas`. Previously such a
host had to either hand-assemble `useLoupe` + `LoupeBubble` + `LoupeGestures` + `SceneViewCanvas`
itself, or reach for the much heavier `<LensOverlay>` multi-lens system to get both a circle and
real vector redraw together.

`LoupeOptions`, `ResolvedLoupe`, `TrialLoupeProps` and `useLoupe` are now generic over
`<TData, TLayer, TPose>`, defaulted so every existing caller is unaffected.
