---
'@weasel-js/core': patch
---

Add `<CanvasView>`: a second camera over a rect of an existing canvas, drawn
through the same GL context, with input routed to it.

Declare one through `<SceneCanvas views={[...]}>`, or mount the component as a
child — the same declaration either way, with children landing after every prop
entry in paint and hit order. A view paints the surface's own layer stack
through its camera, or a narrowed slice of it via `layers`, and owns its camera
in the same hybrid controlled/uncontrolled mode `<Canvas>` uses. Wheel and drag
inside its rect move that camera rather than the canvas's, and a gesture that
wanders out of the rect stays with the camera it began under.

Two supporting changes: `createViewportLayer`'s `source` accepts a thunk, so a
viewport can paint a stack assembled elsewhere rather than one closed over at
construction; and `<SceneCanvas>` mounts a view registry, which is how a view
and its surface find each other.

A canvas with no views declared is unchanged — no registry entries, so every
point resolves to the canvas as before.

Not yet per-view: selection and chrome, affordance hit-testing, and pinch-zoom.
A gesture inside a view reaches the ambient viewport actions and nothing else.
