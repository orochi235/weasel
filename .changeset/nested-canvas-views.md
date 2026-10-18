---
"@weasel-js/core": patch
"@weasel-js/hud": patch
---

A `<CanvasView>` can nest in another through `parent`: its `bounds` are measured from that view's
rect, a thunked `bounds` or `view` receives that view's camera and size, it paints cut to that view
and only the layers that view paints, and input inside it lands in its world before that view's.
`SceneCanvasApi.viewAt` names the innermost view under a canvas point. An interactive or
view-backed loupe now magnifies the camera of the view under its aim, so over a panel it shows and
edits the panel's world. `createViewportLayer` and `ResolvableView` take an optional `clip`.
