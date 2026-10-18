---
'@weasel-js/diagram': patch
'@weasel-js/core': patch
---

Chrome now stays off a layer the view hides with `layerVisibility` or leaves out of `layerOrder`, not only off a layer the scene itself hides. In a `<CanvasView>` panel that hides a layer, a node on it that is selected on the surface shows no outline, resize or rotate handles, path anchors, or warp handles there, and none of them can be grabbed there. A diagram's ports are not drawn on such a layer, a press there does not grab one, and a connect drag started in that view does not land on one.

To make that possible, `ChromeState` carries `layerIsPainted(layerId)` for the view it was built for, the same answer `ViewApi.layerIsPainted` gives, and its `selection` leaves out ids on a layer that view does not paint (`multiActive` and `unionBounds` follow). `buildChromeState` takes `layerIsPainted` and `layerOf` for this, and a view reads each id's layer through its adapter's `getNode`. `paintsLayer(gate, layer)` is the one test every piece of chrome uses: `gate` is a `ChromeState` or a `ViewApi`. In the diagram package, `sceneParticipants` reports each participant's `layer`, and `offersPorts` takes the view as a second argument. Additive.
