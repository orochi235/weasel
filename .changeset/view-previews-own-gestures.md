---
'@weasel-js/core': patch
---

Read a view's gesture previews from the view's own dispatcher.

`<CanvasView>` builds its helpers with a `GestureSource` and preview extras
over the dispatcher it owns, rather than inheriting the surface's. A view has
had its own dispatcher since routing landed, so a gesture inside a panel put
its in-flight handles somewhere the panel's own chrome was not looking: no
ghost, no tracking resize handles, no gesture bounds.

The dispatcher's contribution to those lookups is now one factory
(`createDispatcherPreviewSources`) next to `createGestureSource`, instead of
two closures inlined in `<SceneCanvas>`. The context a surface publishes to its
views narrows to the scene-shaped half — adapter, geometry, bounds resolver,
tools.
